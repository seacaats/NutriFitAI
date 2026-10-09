const storage = require('./index');
const { looksLikeImage, avatarKey, uploadedAvatarKey } = require('./keys');

// Avatars go through the storage adapter like scan photos, so they land on
// whichever driver is set (local folder or R2). What's stored on the
// profile is the key ("avatars/<userId>-g1a2b3c4d5e6.jpg"), never a URL;
// toPublicAvatarUrl turns it into one on every read

// Explicit host pinning to avoid making functions general-purpose URL
// fetchers, making them only be able to reach Google's photo CDN
const ALLOWED_HOSTS = [/(^|\.)googleusercontent\.com$/i];

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 4000;

const userPrefix = (userId) => `avatars/${userId}-`;

function hostAllowed(hostname) {
  return ALLOWED_HOSTS.some((re) => re.test(hostname));
}

// Remove the user's other avatars, keeping `keepKey` (null = remove all)
async function removeOtherAvatars(userId, keepKey) {
  try {
    const keys = await storage.list(userPrefix(userId));
    await Promise.all(keys.filter((k) => k !== keepKey).map((k) => storage.remove(k)));
  } catch {
    // Nothing stored, or the store is unreachable
  }
}

/**
 * @param {string} userId
 * @param {string} remoteUrl the `picture` claim from Google's ID token
 * @returns {Promise<string|null>} storage key for profile.avatarStorageKey
 */
async function saveRemoteAvatar(userId, remoteUrl) {
  if (!userId || !remoteUrl) return null;

  let parsed;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !hostAllowed(parsed.hostname)) return null;

  try {
    // Same source URL -> same key, so an unchanged Google photo isn't fetched again
    for (const type of Object.keys(ALLOWED_TYPES)) {
      const key = avatarKey(userId, remoteUrl, type);
      if (await storage.exists(key)) return key;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(remoteUrl, { signal: controller.signal, redirect: 'follow' });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES[contentType]) return null; // not an image we're willing to serve back out

    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    const { key } = await storage.save(buffer, { key: avatarKey(userId, remoteUrl, contentType), contentType });
    await removeOtherAvatars(userId, key);
    return key;
  } catch {
    // Network error, timeout, store unreachable
    return null;
  }
}

// The key as a link the app can load: a path under /uploads (local) or a
// signed R2 link (expires, see R2_URL_TTL_SECONDS)
async function toPublicAvatarUrl(stored) {
  if (!stored) return null;
  return storage.urlFor(stored);
}

/**
 * Named with a `-u` marker (Google's use `-g`). Acts as a check for Google
 * to avoid appending any user avatars as opposed to when a user has no set avatar
 *
 * @param {string} userId
 * @param {Buffer} buffer raw image bytes
 * @param {string} mimetype as reported by the upload
 * @returns {Promise<string|null>} storage key, or null if rejected
 */
async function saveUploadedAvatar(userId, buffer, mimetype) {
  if (!userId || !buffer || buffer.length === 0) return null;

  const contentType = (mimetype || '').split(';')[0].trim().toLowerCase();
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) return null;
  if (buffer.length > MAX_BYTES) return null;

  if (!looksLikeImage(buffer, ext)) return null;

  try {
    const { key } = await storage.save(buffer, { key: uploadedAvatarKey(userId, contentType), contentType });
    await removeOtherAvatars(userId, key);
    return key;
  } catch {
    return null;
  }
}

// True when the stored avatar came from the user rather than Google
function isUserUploaded(stored) {
  return typeof stored === 'string' && /-u[0-9a-f]{12}\.[a-z]+$/i.test(stored);
}

// Remove user avatar, returning nothing
async function clearStoredAvatar(userId) {
  await removeOtherAvatars(userId, null);
}

module.exports = {
  saveRemoteAvatar,
  saveUploadedAvatar,
  toPublicAvatarUrl,
  isUserUploaded,
  clearStoredAvatar,
};