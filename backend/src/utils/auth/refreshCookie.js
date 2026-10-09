const env = require('../../../config/env');
const { refreshTokenMaxAgeMs } = require('./token');

// The refresh-token cookie, for every route that signs in, refreshes or
// ends a session (authController, profileController's account deletion)
const REFRESH_COOKIE_NAME = 'nf_refresh';

// Check per request if it came in secure or not, and returns
// the proper cookie that's correct. No secure cookies on http,
// only returning to users that access ON https
function isRequestSecure(req) {
  if (env.nodeEnv === 'production') return true;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwarded === 'https' || req.secure === true || req.protocol === 'https';
}

// Centralized cookie settings for login, OAuth, and token-refresh
function refreshCookieOptions(req, maxAge) {
  const https = isRequestSecure(req);
  return {
    httpOnly: true,
    // SameSite=None can only work with Secure, so both toggled together
    secure: https,
    sameSite: https ? 'none' : 'lax',
    // No Domain unless COOKIE_DOMAIN is set: the cookie is then host-only
    // (sent back only to the exact host that set it), the narrowest and
    // safest scope, and it works unchanged across local/LAN/tunnel hosts.
    // Set COOKIE_DOMAIN only if several subdomains must share this cookie
    ...(env.cookie.domain ? { domain: env.cookie.domain } : {}),
    maxAge,
    path: '/api/auth',
  };
}

// Cookie deletion must match cookie's original settings/configuration,
// else the browser keeps the supposedly dead cookie indefinitely
function clearRefreshCookie(res, req) {
  const { maxAge, ...options } = refreshCookieOptions(req, 0);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function setRefreshCookie(res, token, rememberMe, req) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(req, refreshTokenMaxAgeMs(rememberMe)));
}

module.exports = { REFRESH_COOKIE_NAME, refreshCookieOptions, clearRefreshCookie, setRefreshCookie };