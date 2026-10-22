const storage = require('./index');
const { looksLikeImage, avatarKey, uploadedAvatarKey } = require('./keys');
const { moderateImage, throwIfRejected } = require('../../services/moderation/imageModeration');
const { logModeration } = require('../../services/moderation/moderationLog');

// Stores avatars via the active storage adapter under `avatars/<userId>-<g|u><hash>.<ext>`.

// Restrict remote avatar fetches to Google's photo CDN
const ALLOWED_HOSTS = [/(^|\.)googleusercontent\.com$/i];

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/x-png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 4000;

const userPrefix = (userId) => `avatars/${userId}-`;

function hostAllowed(hostname) {
  return ALLOWED_HOSTS.some((re) => re.test(hostname));
}

async function removeOtherAvatars(userId, keepKey) {
  try {
    const keys = await storage.list(userPrefix(userId));
    await Promise.all(keys.filter((k) => k !== keepKey).map((k) => storage.remove(k)));
  } catch {
    // Ignore missing files or unreachable storage
  }
}

/**
 * @param {string} userId
 * @param {string} remoteUrl
 * @returns {Promise<string|null>}
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
    if (!ALLOWED_TYPES[contentType]) return null;

    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    const { key } = await storage.save(buffer, { key: avatarKey(userId, remoteUrl, contentType), contentType });
    await removeOtherAvatars(userId, key);
    return key;
  } catch {
    return null;
  }
}

async function toPublicAvatarUrl(stored) {
  if (!stored) return null;
  return storage.urlFor(stored);
}

/**
 * Saves a user-uploaded avatar (`-u` marker) after magic-byte and moderation checks.
 *
 * @param {string} userId
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string|null>}
 */
async function saveUploadedAvatar(userId, buffer, mimetype) {
  if (!userId || !buffer || buffer.length === 0) return null;

  const contentType = (mimetype || '').split(';')[0].trim().toLowerCase();
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) return null;
  if (buffer.length > MAX_BYTES) return null;

  if (!looksLikeImage(buffer, ext)) return null;

  const checked = await moderateImage(buffer, contentType);
  if (checked.verdict === 'block') {
    await logModeration({ userId, kind: 'avatar' }, checked);
    throwIfRejected(checked);
  }

  try {
    const { key } = await storage.save(buffer, { key: uploadedAvatarKey(userId, contentType), contentType });
    await removeOtherAvatars(userId, key);
    await logModeration({ userId, kind: 'avatar', storageKey: key }, checked);
    return key;
  } catch {
    return null;
  }
}

function isUserUploaded(stored) {
  return typeof stored === 'string' && /-u[0-9a-f]{12}\.[a-z]+$/i.test(stored);
}

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
