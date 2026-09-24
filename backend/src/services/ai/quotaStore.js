
// Uses server midnight, might not line up with actual quota resets
function nextLocalMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

const state = new Map();

function blank() {
  return {
    cooldownUntil: 0,
    requestsToday: 0,
    tokensToday: 0,
    consecutiveFailures: 0,
    resetsAt: nextLocalMidnight(),
    lastError: null,
  };
}

function get(provider) {
  let entry = state.get(provider);
  if (!entry) {
    entry = blank();
    state.set(provider, entry);
  }
  // Reset is checked on-access
  if (Date.now() >= entry.resetsAt) {
    const preserved = entry.cooldownUntil;
    Object.assign(entry, blank());
    // A short cooldown (a per-minute limit) should survive the daily rollover;
    // a day-length one is exactly what the rollover is meant to clear
    entry.cooldownUntil = preserved > entry.resetsAt ? 0 : preserved;
  }
  return entry;
}

/**
 * @param {string} provider
 * @param {{ requestsPerDay?: number, tokensPerDay?: number }} limits
 * @returns {{ ok: boolean, reason?: string }}
 */
function canAttempt(provider, limits = {}) {
  const entry = get(provider);

  if (entry.cooldownUntil > Date.now()) {
    const seconds = Math.ceil((entry.cooldownUntil - Date.now()) / 1000);
    return { ok: false, reason: `cooling down for ${seconds}s` };
  }
  // Check requests and tokens against limts before 
  // attempting a call to a specific model
  if (limits.requestsPerDay && entry.requestsToday >= limits.requestsPerDay) {
    return { ok: false, reason: 'daily request budget spent' };
  }
  if (limits.tokensPerDay && entry.tokensToday >= limits.tokensPerDay) {
    return { ok: false, reason: 'daily token budget spent' };
  }
  return { ok: true };
}

// Provider-reported token count, reports that default to 0
// can't really enforce limit checks
function recordSuccess(provider, usage) {
  const entry = get(provider);
  entry.requestsToday += 1;
  entry.tokensToday += Number(usage?.total_tokens) || 0;
  entry.consecutiveFailures = 0;
  entry.lastError = null;
}

/**
 * Benches a provider.
 *
 * @param {string} provider
 * @param {number} ms how long to skip it for
 * @param {string} [reason] kept for logging and the /coach/health endpoint
 */
function cooldown(provider, ms, reason) {
  const entry = get(provider);
  entry.cooldownUntil = Math.max(entry.cooldownUntil, Date.now() + ms);
  entry.consecutiveFailures += 1;
  entry.lastError = reason || null;
  // Failed calls still consume provider-side quota
  entry.requestsToday += 1;
}

// Diagnostics for stale data such as requestsToday, tokensToday, cooldownUntil.
function snapshot() {
  const out = {};
  for (const [provider, entry] of state.entries()) {
    out[provider] = {
      available: entry.cooldownUntil <= Date.now(),
      cooldownSeconds: Math.max(0, Math.ceil((entry.cooldownUntil - Date.now()) / 1000)),
      requestsToday: entry.requestsToday,
      tokensToday: entry.tokensToday,
      consecutiveFailures: entry.consecutiveFailures,
      lastError: entry.lastError,
    };
  }
  return out;
}

// Test clear provider state
function reset() {
  state.clear();
}

module.exports = { canAttempt, recordSuccess, cooldown, snapshot, reset, get };
