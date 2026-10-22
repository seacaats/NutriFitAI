const env = require('../../../config/env');
const { ApiError } = require('../../utils/httpResponse');
const quotaStore = require('./quotaStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');
const { createOpenAICompatibleProvider, ProviderError } = require('./openaiCompatible');

// Ordered failover across configured AI providers with proactive quota and rate-limit cooldowns.

const LIMITS = {
  ollama: {},
  groq: {},
  cerebras: {},
  cloudflare: {},
};

const BURST_COOLDOWN_MS = 20 * 1000;
const DAILY_COOLDOWN_MS = 60 * 60 * 1000;
const SERVER_ERROR_COOLDOWN_MS = 60 * 1000;

function classifyRateLimit(err) {
  if (err.retryAfterMs !== null && err.retryAfterMs !== undefined) {
    return Math.min(err.retryAfterMs, DAILY_COOLDOWN_MS);
  }
  return BURST_COOLDOWN_MS;
}

function buildRegistry() {
  return {
    ollama: createOpenAICompatibleProvider({
      name: 'ollama',
      baseUrl: env.ai.ollama.baseUrl,
      apiKey: null,
      model: env.ai.ollama.model,
      timeoutMs: env.ai.ollama.timeoutMs,
      maxTokens: env.ai.maxOutputTokens,
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
    cloudflare: createOpenAICompatibleProvider({
      name: 'cloudflare',
      baseUrl: env.ai.cloudflare.baseUrl,
      apiKey: env.ai.cloudflare.apiKey,
      model: env.ai.cloudflare.model,
      timeoutMs: env.ai.cloudflare.timeoutMs,
      maxTokens: env.ai.cloudflare.maxOutputTokens,
    }),
  };
}

function buildChain(registry, names, label) {
  const chain = names
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
    console.warn(`[ai] no providers configured for ${label}`);
  }

  return chain;
}

const registry = buildRegistry();
const providers = buildChain(registry, env.ai.chain, '/api/coach (503)');
// Separate chain for recommendations so they do not consume chat quota
const recProviders = env.ai.recChain.length
  ? buildChain(registry, env.ai.recChain, 'recommendations')
  : providers;

/**
 * @param {{ system: string, messages: Array<{role: string, content: string}>, signal?: AbortSignal }} request
 * @returns {Promise<{ text: string, provider: string, model: string, usage: object|null }>}
 */
async function run(chain, request) {
  const attempts = [];

  for (const provider of chain) {
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

      // Do not fail over on non-transient errors (e.g., 400/401)
      if (!err.transient) throw err;

      const cooldownMs = err.status === 429
        ? classifyRateLimit(err)
        : SERVER_ERROR_COOLDOWN_MS;

      quotaStore.cooldown(provider.name, cooldownMs, err.message);

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

  throw new ApiError(503, 'The AI coach is unavailable right now. Please try again shortly.', {
    code: 'AI_UNAVAILABLE',
    details: attempts,
  });
}

const chat = (request) => run(providers, request);
const chatRec = (request) => run(recProviders, request);

function health() {
  return {
    chain: providers.map((p) => ({ name: p.name, model: p.model })),
    recChain: recProviders.map((p) => ({ name: p.name, model: p.model })),
    state: quotaStore.snapshot(),
  };
}

module.exports = { chat, chatRec, health };
