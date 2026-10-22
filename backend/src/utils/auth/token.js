const crypto = require('crypto');
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

function durationToMs(value) {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]*)$/i.exec(String(value).trim());
  const factor = match && UNIT_MS[match[2].toLowerCase() || 'ms'];
  if (!factor) {
    throw new Error(`Unsupported token lifetime "${value}" (expected e.g. "30d", "12h", "15m")`);
  }
  return Math.round(parseFloat(match[1]) * factor);
}

const REFRESH_TTL_MS = {
  remembered: durationToMs(env.jwt.refreshExpiresIn),
  session: durationToMs(env.jwt.refreshExpiresInShort),
};

const SESSION_MAX_MS = {
  remembered: durationToMs(env.jwt.sessionMax),
  session: durationToMs(env.jwt.sessionMaxShort),
};

for (const key of ['remembered', 'session']) {
  if (SESSION_MAX_MS[key] < REFRESH_TTL_MS[key]) {
    throw new Error(
      `Session maximum for "${key}" (${SESSION_MAX_MS[key]}ms) is shorter than its idle `
        + `window (${REFRESH_TTL_MS[key]}ms). Raise JWT_SESSION_MAX${key === 'session' ? '_SHORT' : ''}.`,
    );
  }
}

/**
 * Short-lived access token for authenticating API requests.
 * @param {{ id: string, email: string, role?: string }} user
 */
function signAccessToken(user, sid = null) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'user', type: 'access', ...(sid ? { sid } : {}) },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  );
}

/**
 * Long-lived refresh token carrying `rmb` (rememberMe), `sxp` (absolute session expiry), and `sid` (session ID).
 * @param {{ id: string }} user
 * @param {boolean} rememberMe
 * @param {number|null} [sessionExpiresAt]
 * @param {string|null} [sid]
 */
function signRefreshToken(user, rememberMe = false, sessionExpiresAt = null, sid = null) {
  const idleMs = rememberMe ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
  const maxMs = rememberMe ? SESSION_MAX_MS.remembered : SESSION_MAX_MS.session;
  const absolute = sessionExpiresAt || Date.now() + maxMs;

  const remainingMs = Math.max(absolute - Date.now(), 0);
  const expiresInSeconds = Math.max(Math.floor(Math.min(idleMs, remainingMs) / 1000), 1);

  return jwt.sign(
    { sub: user.id, type: 'refresh', rmb: Boolean(rememberMe), sxp: absolute, ...(sid ? { sid } : {}) },
    env.jwt.refreshSecret,
    { expiresIn: expiresInSeconds },
  );
}

function refreshSessionRemainingMs(payload) {
  if (!payload || !payload.sxp) {
    return payload && payload.rmb ? REFRESH_TTL_MS.remembered : REFRESH_TTL_MS.session;
  }
  return Math.max(payload.sxp - Date.now(), 0);
}

/**
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
 * Short-lived token issued after verifying a password-reset OTP.
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

function passwordFingerprint(passwordHash) {
  return crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 16);
}

// Short-lived MFA challenge token bound to the current password hash fingerprint (`pv`)
function signMfaToken(user, rememberMe = false, via = 'password') {
  return jwt.sign(
    { sub: user.id, type: 'mfa', rmb: Boolean(rememberMe), via, pv: passwordFingerprint(user.passwordHash) },
    env.mfa.tokenSecret,
    { expiresIn: env.mfa.tokenExpiresIn },
  );
}

function verifyMfaToken(token) {
  const payload = jwt.verify(token, env.mfa.tokenSecret, { algorithms: ['HS256'] });
  if (payload.type !== 'mfa') throw new Error('Wrong token type');
  return payload;
}

function signOauthExchangeToken({ userId }) {
  return jwt.sign({ sub: userId, type: 'oauth_exchange' }, env.oauthExchange.secret, {
    expiresIn: env.oauthExchange.expiresIn,
  });
}

function verifyOauthExchangeToken(token) {
  return jwt.verify(token, env.oauthExchange.secret);
}

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
  passwordFingerprint,
  signMfaToken,
  verifyMfaToken,
  signOauthExchangeToken,
  verifyOauthExchangeToken,
};
