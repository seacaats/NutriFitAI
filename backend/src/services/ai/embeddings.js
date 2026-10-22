const env = require('../../../config/env');
const quotaStore = require('./quotaStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');

// Embedding calls for the coach's semantic search. Registered under its own
// quota name, outside the chat chain, so a 429 here never benches the chat or
// recommendation providers

const NAME = 'gemini-embed';
const cfg = env.ai.embed;

const CACHE_MAX = 200;
const MAX_QUERY_CHARS = 200;
const COOLDOWN_MS = 60 * 1000;
// The build script sends big batches, so it gets longer than a chat message does
const BUILD_TIMEOUT_MS = 30 * 1000;
// A rejected key or request won't fix itself in a minute
const REJECTED_COOLDOWN_MS = 10 * 60 * 1000;

// text -> vector, oldest dropped first
const cache = new Map();

const isConfigured = () => Boolean(cfg.baseUrl && cfg.model && cfg.apiKey);

// Cut to cfg.dims and back to unit length (the model allows truncating),
// so a dot product is the cosine similarity
function prepare(values) {
  const v = Float32Array.from(values.slice(0, cfg.dims));
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i += 1) v[i] /= norm;
  return v;
}

function retryAfterMs(headers) {
  const seconds = Number(headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 60 * 60 * 1000) : null;
}

// One request for one or more texts. Throws with .status on failure
async function request(input, timeoutMs = cfg.timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, input }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw Object.assign(new Error(`embeddings ${res.status}`), { status: res.status, retryAfterMs: retryAfterMs(res.headers) });
    }
    const body = await res.json();
    const rows = [...(body?.data || [])].sort((a, b) => a.index - b.index);
    if (rows.length !== input.length || rows.some((r) => !Array.isArray(r.embedding))) throw new Error('embeddings: unexpected response');
    return rows.map((r) => prepare(r.embedding));
  } catch (err) {
    if (err?.name === 'AbortError') throw Object.assign(new Error('embeddings timed out'), { status: 0 });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * For the build script: throws on failure, no cache, no cooldown
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
const embedTexts = (texts) => request(texts, BUILD_TIMEOUT_MS);

/**
 * For chat: the vector for a short user message, or null on ANY problem
 * (no key, cooling down, 429, timeout), so the caller falls back to keywords
 * @param {string} text
 * @returns {Promise<Float32Array|null>}
 */
async function embedQuery(text) {
  const key = String(text || '').trim().toLowerCase().slice(0, MAX_QUERY_CHARS);
  if (!key || !isConfigured()) return null;

  if (cache.has(key)) {
    // Re-inserted so the most recently used stays last
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  if (!quotaStore.canAttempt(NAME).ok) return null;

  try {
    const [vec] = await request([key]);
    quotaStore.recordSuccess(NAME);
    cache.set(key, vec);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return vec;
  } catch (err) {
    const rejected = err.status >= 400 && err.status < 500 && err.status !== 429;
    const ms = rejected ? REJECTED_COOLDOWN_MS : err.retryAfterMs ?? COOLDOWN_MS;
    quotaStore.cooldown(NAME, ms, err.message);
    // Once per cooldown: the gate above skips calls until it ends. Not awaited, logSystemAction never throws
    logSystemAction({
      action: 'coach.embeddings.paused',
      targetType: 'system',
      details: {
        reason: err.status === 429 ? 'rate_limited' : rejected ? 'rejected' : 'unavailable',
        status: err.status,
        resumesAt: new Date(Date.now() + ms).toISOString(),
      },
    });
    return null;
  }
}

module.exports = { embedQuery, embedTexts, isConfigured };