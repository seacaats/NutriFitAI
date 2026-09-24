const { getLanIp } = require('./lanIp');
const env = require('../../config/env');

/**
 * Decides, at boot, what URL this server is actually reachable at:
 * 
 *   1. PUBLIC_BASE_URL, currently overridden
 *   2. The live ngrok tunnel, read from ngrok's own local API
 *   3. The LAN IP, detected per boot by lanIp.js
 *   4. localhost
 * 
 */

// Only processes on this same machine can ever reach ngrok's inspection API
const NGROK_API = process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels';

// Server boot delay
const NGROK_TIMEOUT_MS = Number(process.env.NGROK_TIMEOUT_MS || 1500);

// Returns null on every undetected tunnel rather than an error
async function detectNgrokUrl() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NGROK_TIMEOUT_MS);

  try {
    const response = await fetch(NGROK_API, { signal: controller.signal });
    if (!response.ok) return null;

    const body = await response.json();
    const tunnels = Array.isArray(body.tunnels) ? body.tunnels : [];

    // Cookie security flags depend on properly reflecting a TLS-terminated connection (TLS)
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
 * Resolves and installs the base URL onto .env because the value can
 * only depend on whether a tunnel is active and the network of the machine
 *
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


// Cache GET /health results to avoid probing ngrok on every heatlh check
let resolved = null;

function setResolved(value) {
  resolved = value;
}

function getResolved() {
  return resolved || { baseUrl: env.publicBaseUrl, source: 'unresolved', lanIp: null, ngrokUrl: null };
}


// ---------------------------------------------------------------------------
// Tunnels owned by THIS machine
// ---------------------------------------------------------------------------

// Allow running three separate ngrok processes
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

// Short-lived cache for ngrok inspection results (15s)
const OWNED_TTL_MS = 15000;
let ownedCache = { at: 0, origins: new Set() };

/**
 * The https origins of every ngrok tunnel running on this machine.
 * Force bypasses the cache for missed tunnels upon startup/boot
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
  detectNgrokUrl,
  listOwnedTunnelOrigins,
  setResolved,
  getResolved,
};