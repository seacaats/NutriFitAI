const env = require('../../../config/env');
const quotaStore = require('./quotaStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');

// Embedding calls for semantic search, tracked under an isolated quota key.

const NAME = 'gemini-embed';
const cfg = env.ai.embed;

const CACHE_MAX = 200;
const MAX_QUERY_CHARS = 200;
const COOLDOWN_MS = 60 * 1000;
const BUILD_TIMEOUT_MS = 30 * 1000;
const REJECTED_COOLDOWN_MS = 10 * 60 * 1000;

// LRU cache: text -> vector
const cache = new Map();

const isConfigured = () => Boolean(cfg.baseUrl && cfg.model && cfg.apiKey);

// Truncates to cfg.dims and normalizes to unit length for dot-product cosine similarity
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
 * Batch embedding helper for build scripts (throws on failure, bypasses cache/cooldown).
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
const embedTexts = (texts) => request(texts, BUILD_TIMEOUT_MS);

/**
 * Returns the embedding vector for a user query, or null on any failure so callers can fall back to keywords.
 * @param {string} text
 * @returns {Promise<Float32Array|null>}
 */
async function embedQuery(text) {
  const key = String(text || '').trim().toLowerCase().slice(0, MAX_QUERY_CHARS);
  if (!key || !isConfigured()) return null;

  if (cache.has(key)) {
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
