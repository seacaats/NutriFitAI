const jwt = require('jsonwebtoken');
const env = require('../../../config/env');

const UNIT_MS = {
  ms: 1, msec: 1, msecs: 1, millisecond: 1, milliseconds: 1,
  s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
  m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
  h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
  d: 86400000, day: 86400000, days: 86400000,
  w: 604800000, week: 604800000, weeks: 604800000,
  y: 31557600000, yr: 31557600000, yrs: 31557600000, year: 31557600000, years: 31557600000,
};


// Convert jsonwebtoken expiresIn duration string to ms
function durationToMs(value) {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]*)$/i.exec(String(value).trim());
  const factor = match && UNIT_MS[match[2].toLowerCase() || 'ms'];
  if (!factor) {
    throw new Error(`Unsupported token lifetime "${value}" (expected e.g. "30d", "12h", "15m")`);
  }
  return Math.round(parseFloat(match[1]) * factor);
}

// Sliding window, refreshing constantly through activity
const REFRESH_TTL_MS = {
  remembered: durationToMs(env.jwt.refreshExpiresIn),
  session: durationToMs(env.jwt.refreshExpiresInShort),
};

// Longest a session may live after being used
const SESSION_MAX_MS = {
  remembered: durationToMs(env.jwt.sessionMax),
  session: durationToMs(env.jwt.sessionMaxShort),
};

// Validate session max as never being shorter than sliding window
for (const key of ['remembered', 'session']) {
  if (SESSION_MAX_MS[key] < REFRESH_TTL_MS[key]) {
    throw new Error(
      `Session maximum for "${key}" (${SESSION_MAX_MS[key]}ms) is shorter than its idle `
        + `window (${REFRESH_TTL_MS[key]}ms). Raise JWT_SESSION_MAX${key === 'session' ? '_SHORT' : ''}.`,
    );
  }
}

/**
 * Access token: short-lived, carried in Authorization header, used to
 * authenticate normal API requests. Payload is intentionally minimal.
 * @param {{ id: string, email: string }} user
 */
function signAccessToken(user) {
  return jwt.sign(
    // User role is embedded on the access token.
    // Access tokens are short-lived (15m by default), which
    // bounds how long a revoked/demoted role stays usable.
    { sub: user.id, email: user.email, role: user.role || 'user', type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  );
}

/**
 * Refresh token: long-lived, httpOnly cookie, exchanged for access tokens at
 * /api/auth/refresh.
 *
 *   rmb  the rememberMe choice made at login
 *
 *   sxp  the max session deadline, as epoch ms, fixed at login and
 *        carried unchanged through every rotation.
 *
 * @param {{ id: string }} user
 * @param {boolean} rememberMe
 * @param {number} [sessionExpiresAt] epoch ms; pass through on rotation
 */
function signRefreshToken(user, rememberMe = false, sessionExpiresAt = null) {
  const idleMs = rememberMe ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
  const maxMs = rememberMe ? SESSION_MAX_MS.remembered : SESSION_MAX_MS.session;
  // Set once at login; every rotation passes the original value straight back
  const absolute = sessionExpiresAt || Date.now() + maxMs;

  // Never issue a token that outlives the session deadline\
  const remainingMs = Math.max(absolute - Date.now(), 0);
  const expiresInSeconds = Math.max(Math.floor(Math.min(idleMs, remainingMs) / 1000), 1);

  return jwt.sign(
    { sub: user.id, type: 'refresh', rmb: Boolean(rememberMe), sxp: absolute },
    env.jwt.refreshSecret,
    { expiresIn: expiresInSeconds },
  );
}

// Token minted before 'sxp' existed — fall back to the full 
// idle window instead of failing on the missing field
function refreshSessionRemainingMs(payload) {
  if (!payload || !payload.sxp) {
    return payload && payload.rmb ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
  }
  return Math.max(payload.sxp - Date.now(), 0);
}

/**
 * Lifetime of the refresh cookie, in ms. Uses the same config as
 * signRefreshToken so the cookie and the token it carries expire together
 * @param {boolean} rememberMe
 */
function refreshTokenMaxAgeMs(rememberMe = false) {
  return rememberMe ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

/**
 * Short-lived authorization returned after a password-reset OTP is verified
 * Proves the caller already passed the OTP challenge, without re-sending it
 * @param {{ userId: string, challengeId: string }} payload
 */
function signResetToken({ userId, challengeId }) {
  return jwt.sign({ sub: userId, cid: challengeId, type: 'password_reset' }, env.resetToken.secret, {
    expiresIn: env.resetToken.expiresIn,
  });
}

function verifyResetToken(token) {
  return jwt.verify(token, env.resetToken.secret);
}

function signOauthExchangeToken({ userId }) {
  return jwt.sign({ sub: userId, type: 'oauth_exchange' }, env.oauthExchange.secret, {
    expiresIn: env.oauthExchange.expiresIn,
  });
}

function verifyOauthExchangeToken(token) {
  return jwt.verify(token, env.oauthExchange.secret);
}

// Prevent scenarios where cookies outlive the idle window or a set sxp,
// where a token would continue to sit in the browser when that cookie
// doesn't actually work anymore, returning invalid diagnostics for the user
function refreshCookieMaxAgeMs(payload) {
  const idleMs = payload && payload.rmb ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
  return Math.min(idleMs, refreshSessionRemainingMs(payload));
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  refreshSessionRemainingMs,
  refreshCookieMaxAgeMs,
  refreshTokenMaxAgeMs,
  verifyAccessToken,
  verifyRefreshToken,
  signResetToken,
  verifyResetToken,
  signOauthExchangeToken,
  verifyOauthExchangeToken,
};