const env = require('../../../config/env');
const { listOwnedTunnelOrigins } = require('../../utils/publicUrl');

/**
 * Decides whether an OAuth redirectUri may be used.
 *   - production / dev client :  nutrifitai://google-auth
 *   - Expo Go over LAN        :  exp://192.168.1.42:8081/--/google-auth
 *   - Expo Go tunnel          :  exp://<random>.exp.direct/--/google-auth
 *
 * The function below therefore accepts:
 *   1. any exact entry in APP_REDIRECT_URIS
 *   2. the app's own custom scheme
 *   
 *   Dev only:
 *   3. exp:// development URLs
 *   4. an https ngrok tunnel THIS MACHINE is running,
 *      verified against the loca ngrok agent 
 */

const CALLBACK_PATH = 'google-auth';

async function isAllowedRedirectUri(redirectUri) {
  if (!redirectUri || typeof redirectUri !== 'string') return false;

  // 1. Exact allowlist match
  if (env.appRedirectUris.includes(redirectUri)) return true;

  let parsed;
  try {
    parsed = new URL(redirectUri);
  } catch (err) {
    return false;
  }

  // 2. The app's own scheme, e.g. nutrifitai://google-auth
  // to accomodate custom deep links against standard web URLs
  const appScheme = env.appScheme ? `${env.appScheme}:` : null;
  if (appScheme && parsed.protocol === appScheme) {
    const target = (parsed.host || parsed.pathname.replace(/^\/+/, '')).replace(/\/+$/, '');
    return target === CALLBACK_PATH;
  }

  // 3. Expo Go
  if (process.env.NODE_ENV !== 'production') {
    if (parsed.protocol === 'exp:' || parsed.protocol.startsWith('exp+')) {
      return parsed.pathname.endsWith(`/${CALLBACK_PATH}`);
    }
  }

  // 4. This machine's own ngrok tunnels
  if (process.env.NODE_ENV !== 'production' && parsed.protocol === 'https:') {
    // Path must exactly be the Google Auth callback
    const onCallback = parsed.pathname.replace(/\/+$/, '') === `/${CALLBACK_PATH}`;
    if (!onCallback) return false;

    let owned = await listOwnedTunnelOrigins();
    // Recheck tunnels if they just started and 
    // requests towards it were prematurely rejected
    if (!owned.has(parsed.origin)) owned = await listOwnedTunnelOrigins({ force: true });
    return owned.has(parsed.origin);
  }

  return false;
}

module.exports = { isAllowedRedirectUri, CALLBACK_PATH };