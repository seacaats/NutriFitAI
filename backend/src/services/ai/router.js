const env = require('../../../config/env');
const { ApiError } = require('../../utils/httpResponse');
const quotaStore = require('./quotaStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');
const { createOpenAICompatibleProvider, ProviderError } = require('./openaiCompatible');

/**
 * Ordered failover across the configured providers:
 *   1. Classify 429s. Per-minute and per-day limits look identical on the wire
 *      (both are HTTP 429), but the right response differs by four orders of
 *      magnitude. Retry-After decides; a heuristic covers providers that omit it.
 *   2. Skip proactively. Consult the budget before spending a request to learn
 *      the budget is gone.
 *   3. Never fail over on 4xx that aren't 429. A 401 is a wrong key and a 400 is
 *      a malformed payload; quietly downgrading to the next model turns a
 *      five-minute fix into a mystery.
 *   4. Report who answered. Stored on the message row.
 */

// Quota ceilings
const LIMITS = {
  ollama: {}, // self-hosted, no ceiling
  // Free-tier limits change; Groq's 429s set the cooldown
  // (classifyRateLimit) instead of a guessed ceiling here
  groq: {},
  cerebras: {}, // same reasoning as groq
};

// Fallback for 429 status codes with no Retry-After header
const BURST_COOLDOWN_MS = 20 * 1000;
const DAILY_COOLDOWN_MS = 60 * 60 * 1000;
const SERVER_ERROR_COOLDOWN_MS = 60 * 1000;

// Cooldown duration for 429s, fetching it once more
// depending on whether it has a Retry-After header or not
function classifyRateLimit(err) {
  if (err.retryAfterMs !== null && err.retryAfterMs !== undefined) {
    return Math.min(err.retryAfterMs, DAILY_COOLDOWN_MS);
  }
  return BURST_COOLDOWN_MS;
}

function buildProviders() {
  const registry = {
    ollama: createOpenAICompatibleProvider({
      name: 'ollama',
      baseUrl: env.ai.ollama.baseUrl,
      apiKey: null,
      model: env.ai.ollama.model,
      // Local models don't run as fast as hosted ones
      timeoutMs: env.ai.ollama.timeoutMs,
      maxTokens: env.ai.maxOutputTokens,
      // Through a tunnel: the basic-auth policy's credentials
      headers: env.ai.ollama.basicAuth
        ? { Authorization: `Basic ${Buffer.from(env.ai.ollama.basicAuth).toString('base64')}` }
        : {},
    }),
    groq: createOpenAICompatibleProvider({
      name: 'groq',
      baseUrl: env.ai.groq.baseUrl,
      apiKey: env.ai.groq.apiKey,
      model: env.ai.groq.model,
      timeoutMs: env.ai.groq.timeoutMs,
      maxTokens: Math.min(env.ai.groq.maxOutputTokens, env.ai.maxOutputTokens),
    }),
    cerebras: createOpenAICompatibleProvider({
      name: 'cerebras',
      baseUrl: env.ai.cerebras.baseUrl,
      apiKey: env.ai.cerebras.apiKey,
      model: env.ai.cerebras.model,
      timeoutMs: env.ai.cerebras.timeoutMs,
      maxTokens: Math.min(env.ai.cerebras.maxOutputTokens, env.ai.maxOutputTokens),
    }),
  };

  // Drop unconfigured providers
  const chain = env.ai.chain
    .map((name) => registry[name])
    .filter((provider) => {
      if (!provider) return false;
      if (!provider.isConfigured()) {
        console.warn(`[ai] skipping "${provider.name}": missing base URL, model or API key`);
        return false;
      }
      return true;
    });

  if (chain.length === 0) {
    console.warn('[ai] no providers configured -- /api/coach will return 503');
  }

  return chain;
}

const providers = buildProviders();

/**
 * @param {{ system: string, messages: Array<{role: string, content: string}>, signal?: AbortSignal }} request
 * @returns {Promise<{ text: string, provider: string, model: string, usage: object|null }>}
 */
async function chat(request) {
  const attempts = [];

  for (const provider of providers) {
    const gate = quotaStore.canAttempt(provider.name, LIMITS[provider.name]);
    if (!gate.ok) {
      attempts.push({ provider: provider.name, skipped: gate.reason });
      continue;
    }

    try {
      const result = await provider.chat(request);
      quotaStore.recordSuccess(provider.name, result.usage);

      if (attempts.length > 0) {
        console.warn(`[ai] answered by "${provider.name}" after ${attempts.length} skipped/failed`, attempts);
        // Only when a provider actually failed on this call. Skips during a
        // cooldown would otherwise write one row per message
        const failed = attempts.filter((a) => a.status);
        if (failed.length > 0) {
          logSystemAction({
            action: 'coach.provider.failover',
            targetType: 'system',
            details: {
              fromProvider: failed[failed.length - 1].provider,
              toProvider: provider.name,
              reason: failed[failed.length - 1].status === 429 ? 'rate_limited' : 'provider_error',
              status: failed[failed.length - 1].status,
            },
          });
        }
      }

      return {
        text: result.text,
        provider: provider.name,
        model: provider.model,
        usage: result.usage,
      };
    } catch (err) {
      if (!(err instanceof ProviderError)) throw err;

      // Surface non-transient failures immediately
      if (!err.transient) throw err;

      const cooldownMs = err.status === 429
        ? classifyRateLimit(err)
        : SERVER_ERROR_COOLDOWN_MS;

      quotaStore.cooldown(provider.name, cooldownMs, err.message);

      // Once per cooldown: the gate above skips this provider until it ends.
      // Not awaited, logSystemAction never throws
      if (err.status === 429) {
        logSystemAction({
          action: 'coach.quota.exhausted',
          targetType: 'system',
          details: {
            provider: provider.name,
            limitKind: cooldownMs >= DAILY_COOLDOWN_MS ? 'daily' : 'burst',
            resumesAt: new Date(Date.now() + cooldownMs).toISOString(),
          },
        });
      }
      attempts.push({ provider: provider.name, status: err.status, error: err.message });
    }
  }

  // Message returns to users, details stay on the server
  throw new ApiError(503, 'The AI coach is unavailable right now. Please try again shortly.', {
    code: 'AI_UNAVAILABLE',
    details: attempts,
  });
}

// Check live providers
function health() {
  return {
    chain: providers.map((p) => ({ name: p.name, model: p.model })),
    state: quotaStore.snapshot(),
  };
}

module.exports = { chat, health };