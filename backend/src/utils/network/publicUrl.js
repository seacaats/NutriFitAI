const { getLanIp } = require('./lanIp');
const env = require('../../../config/env');

/**
 * Resolves the reachable public base URL at boot in priority order:
 *   1. Explicit PUBLIC_BASE_URL
 *   2. Active local ngrok HTTPS tunnel
 *   3. Local LAN IPv4 address
 *   4. localhost
 */

const NGROK_API = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';
const NGROK_TIMEOUT_MS = Number(process.env.NGROK_TIMEOUT_MS || 1500);

async function detectNgrokUrl() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NGROK_TIMEOUT_MS);

  try {
    const response = await fetch(NGROK_API, { signal: controller.signal });
    if (!response.ok) return null;

    const body = await response.json();
    const tunnels = Array.isArray(body.tunnels) ? body.tunnels : [];

    const https = tunnels.find(
      (t) => typeof t.public_url === 'string' && t.public_url.startsWith('https://'),
    );
    return https ? https.public_url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{ baseUrl: string, source: string, lanIp: string|null, ngrokUrl: string|null }>}
 */
async function resolvePublicBaseUrl() {
  const lanIp = getLanIp();
  const explicit = (process.env.PUBLIC_BASE_URL || '').trim();

  if (explicit) {
    env.publicBaseUrl = explicit.replace(/\/+$/, '');
    return { baseUrl: env.publicBaseUrl, source: 'PUBLIC_BASE_URL', lanIp, ngrokUrl: null };
  }

  const ngrokUrl = await detectNgrokUrl();
  if (ngrokUrl) {
    env.publicBaseUrl = ngrokUrl.replace(/\/+$/, '');
    return { baseUrl: env.publicBaseUrl, source: 'ngrok', lanIp, ngrokUrl };
  }

  if (lanIp) {
    env.publicBaseUrl = `http://${lanIp}:${env.port}`;
    return { baseUrl: env.publicBaseUrl, source: 'lan', lanIp, ngrokUrl: null };
  }

  env.publicBaseUrl = `http://localhost:${env.port}`;
  return { baseUrl: env.publicBaseUrl, source: 'localhost', lanIp: null, ngrokUrl: null };
}

let resolved = null;

function setResolved(value) {
  resolved = value;
}

function getResolved() {
  return resolved || { baseUrl: env.publicBaseUrl, source: 'unresolved', lanIp: null, ngrokUrl: null };
}

const NGROK_APIS = (process.env.NGROK_API_URLS
  || 'http://127.0.0.1:4040/api/tunnels,http://127.0.0.1:4041/api/tunnels,http://127.0.0.1:4042/api/tunnels')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

async function fetchTunnelOrigins(apiUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NGROK_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok) return [];
    const body = await response.json();
    return (Array.isArray(body.tunnels) ? body.tunnels : [])
      .map((t) => t && t.public_url)
      .filter((u) => typeof u === 'string' && u.startsWith('https://'))
      .map((u) => new URL(u).origin);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const OWNED_TTL_MS = 15000;
let ownedCache = { at: 0, origins: new Set() };

/**
 * Returns the HTTPS origins of active local ngrok tunnels (cached for 15s unless `force` is true).
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<Set<string>>}
 */
async function listOwnedTunnelOrigins({ force = false } = {}) {
  if (!force && Date.now() - ownedCache.at < OWNED_TTL_MS) return ownedCache.origins;
  const results = await Promise.all(NGROK_APIS.map(fetchTunnelOrigins));
  ownedCache = { at: Date.now(), origins: new Set(results.flat()) };
  return ownedCache.origins;
}

module.exports = {
  resolvePublicBaseUrl,
  listOwnedTunnelOrigins,
  setResolved,
  getResolved,
};
