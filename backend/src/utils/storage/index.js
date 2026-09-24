const env = require('../../../config/env');
const keys = require('./keys');

/**
 * Storage adapter. Callers never branch on driver when another is configured
 *
 * Driver contract:
 *   save(buffer, { key, contentType })  -> Promise<{ key, bytes }>
 *   remove(key)                         -> Promise<void>  (never throws)
 *   removePrefix(prefix)                -> Promise<void>  (never throws)
 *   exists(key)                         -> Promise<boolean>
 *   urlFor(key)                         -> Promise<string | null>
 * 
 */

const drivers = {
  local: () => require('./localStore'),
};

const selected = drivers[env.storage.driver];
if (!selected) {
  throw new Error(`Unknown STORAGE_DRIVER "${env.storage.driver}" (expected "local")`);
}

const store = selected();

// Size check at the adapter
function assertWithinLimit(buffer) {
  if (buffer.length > env.storage.maxUploadBytes) {
    const mb = (env.storage.maxUploadBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`upload exceeds ${mb} MB limit`);
  }
}

async function save(buffer, { key, contentType }) {
  assertWithinLimit(buffer);
  return store.save(buffer, { key, contentType });
}

// Wrapper for urlFor(), (e.g., responding with multiple files at a time)
async function urlsFor(keyList) {
  return Promise.all(keyList.map((k) => store.urlFor(k)));
}
console.log(`[storage] driver=${store.driver}`);

module.exports = {
  ...store,
  save,
  urlsFor,
  keys,
  driver: store.driver,
};