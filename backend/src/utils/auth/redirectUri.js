const env = require('../../../config/env');
const { listOwnedTunnelOrigins } = require('../../utils/network/publicUrl');

/**
 * Validates whether an OAuth redirectUri is allowed:
 *   1. Exact match in APP_REDIRECT_URIS
 *   2. Custom app scheme (<appScheme>://google-auth)
 *   3. (Dev only) Expo Go exp:// URLs
 *   4. (Dev only) Active local ngrok HTTPS tunnels
 */

const CALLBACK_PATH = 'google-auth';

async function isAllowedRedirectUri(redirectUri) {
  if (!redirectUri || typeof redirectUri !== 'string') return false;

  if (env.appRedirectUris.includes(redirectUri)) return true;

  let parsed;
  try {
    parsed = new URL(redirectUri);
  } catch (err) {
    return false;
  }

  const appScheme = env.appScheme ? `${env.appScheme}:` : null;
  if (appScheme && parsed.protocol === appScheme) {
    const target = (parsed.host || parsed.pathname.replace(/^\/+/, '')).replace(/\/+$/, '');
    return target === CALLBACK_PATH;
  }

  if (process.env.NODE_ENV !== 'production') {
    if (parsed.protocol === 'exp:' || parsed.protocol.startsWith('exp+')) {
      return parsed.pathname.endsWith(`/${CALLBACK_PATH}`);
    }
  }

  if (process.env.NODE_ENV !== 'production' && parsed.protocol === 'https:') {
    const onCallback = parsed.pathname.replace(/\/+$/, '') === `/${CALLBACK_PATH}`;
    if (!onCallback) return false;

    let owned = await listOwnedTunnelOrigins();
    if (!owned.has(parsed.origin)) owned = await listOwnedTunnelOrigins({ force: true });
    return owned.has(parsed.origin);
  }

  return false;
}

module.exports = { isAllowedRedirectUri, CALLBACK_PATH };
