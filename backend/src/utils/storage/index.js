const env = require('../../../config/env');
const keys = require('./keys');

/**
 * Storage adapter interface:
 *   save(buffer, { key, contentType })  -> Promise<{ key, bytes }>
 *   remove(key)                         -> Promise<void>  (never throws)
 *   removePrefix(prefix)                -> Promise<void>  (never throws)
 *   list(prefix)                        -> Promise<string[]>
 *   exists(key)                         -> Promise<boolean>
 *   read(key)                           -> Promise<Buffer | null>  (never throws)
 *   urlFor(key)                         -> Promise<string | null>
 */

// Lazy-load drivers so local deployments do not load the AWS SDK
const drivers = {
  local: () => require('./localStore'),
  r2: () => require('./r2Store'),
};

const selected = drivers[env.storage.driver];
if (!selected) {
  throw new Error(`Unknown STORAGE_DRIVER "${env.storage.driver}" (expected "local" or "r2")`);
}

const store = selected();

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

console.log(`[storage] driver=${store.driver}`);

module.exports = {
  ...store,
  save,
  keys,
  driver: store.driver,
};
