// One generic adapter handles every OpenAI-compatible provider via configuration

class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, retryAfterMs?: number|null, provider?: string, transient?: boolean }} opts
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = opts.status ?? 0;
    this.retryAfterMs = opts.retryAfterMs ?? null;
    this.provider = opts.provider;
    // Flags transient or non transient errors (400 or 401)
    this.transient = opts.transient ?? true;
  }
}

// Convert Retry-After header into amount of time 
// to wait to send requests to a specific model
function parseRetryAfter(headers) {
  const raw = headers?.get?.('retry-after');
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

/**
 * Builds a chat client.
 *
 * @param {{ name: string, baseUrl: string, apiKey?: string|null, model: string, timeoutMs?: number, maxTokens?: number }} config
 */
function createOpenAICompatibleProvider(config) {
  const { name, baseUrl, apiKey, model, timeoutMs = 30000, maxTokens = 700 } = config;

  return {
    name,
    model,

    // Checks model configurations for the router to resolve at server startup
    isConfigured() {
      return Boolean(baseUrl && model && (apiKey || name === 'ollama'));
    },

    /**
     * @param {{ system: string, messages: Array<{ role: 'user'|'assistant', content: string }>, signal?: AbortSignal }} request
     * @returns {Promise<{ text: string, usage: object|null }>}
     */
    async chat(request) { 
      // Force a definitive pass/fail for each chat request with an enforced timeout deadline
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Upstream cancellation has to reach the socket too, killing the underlying provider request
      const onAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onAbort, { once: true });

      let response;
      try {
        response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.6,
            messages: [{ role: 'system', content: request.system }, ...request.messages],
          }),
          signal: controller.signal,
        });
      } catch (err) {
        const aborted = err?.name === 'AbortError';
        throw new ProviderError(
          aborted ? `${name} timed out after ${timeoutMs}ms` : `${name} is unreachable`,
          { provider: name, status: 0, transient: true },
        );
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        // Defines and distinguishes from transiesnt and non-transient status codes/bugs
        const transient = response.status === 429 || response.status >= 500;
        throw new ProviderError(`${name} returned ${response.status}: ${body.slice(0, 300)}`, {
          provider: name,
          status: response.status,
          retryAfterMs: parseRetryAfter(response.headers),
          transient,
        });
      }

      const payload = await response.json().catch(() => null);
      const text = payload?.choices?.[0]?.message?.content;

      // Treat every non-useful successful request
      if (typeof text !== 'string' || text.trim() === '') {
        throw new ProviderError(`${name} returned an empty completion`, {
          provider: name,
          status: 200,
          transient: true,
        });
      }

      return { text: text.trim(), usage: payload.usage ?? null };
    },
  };
}

module.exports = { createOpenAICompatibleProvider, ProviderError, parseRetryAfter };
