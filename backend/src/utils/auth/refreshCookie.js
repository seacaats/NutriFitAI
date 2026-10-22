const env = require('../../../config/env');
const { refreshTokenMaxAgeMs } = require('./token');

const REFRESH_COOKIE_NAME = 'nf_refresh';

function isRequestSecure(req) {
  if (env.nodeEnv === 'production') return true;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwarded === 'https' || req.secure === true || req.protocol === 'https';
}

function refreshCookieOptions(req, maxAge) {
  const https = isRequestSecure(req);
  return {
    httpOnly: true,
    secure: https,
    sameSite: https ? 'none' : 'lax',
    ...(env.cookie.domain ? { domain: env.cookie.domain } : {}),
    maxAge,
    path: '/api/auth',
  };
}

// Clear cookie using matching options so the browser removes it
function clearRefreshCookie(res, req) {
  const { maxAge, ...options } = refreshCookieOptions(req, 0);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function setRefreshCookie(res, token, rememberMe, req) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(req, refreshTokenMaxAgeMs(rememberMe)));
}

module.exports = { REFRESH_COOKIE_NAME, refreshCookieOptions, clearRefreshCookie, setRefreshCookie };
