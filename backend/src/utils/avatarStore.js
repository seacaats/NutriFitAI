const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const env = require('../../config/env');


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

// Public path prefix; must match the express.static mount in app.js
const PUBLIC_PREFIX = '/uploads/avatars';

function avatarsDir() {
  return path.join(env.uploadsDir, 'avatars');
}

function hostAllowed(hostname) {
  return ALLOWED_HOSTS.some((re) => re.test(hostname));
}

// Remove overwritten user avatar
async function removeOtherAvatars(userId, keepFilename) {
  try {
    const files = await fs.readdir(avatarsDir());
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${userId}-`) && f !== keepFilename)
        .map((f) => fs.unlink(path.join(avatarsDir(), f)).catch(() => {})),
    );
  } catch {
    // Directory doesn't exist, or unreadable
  }
}

/**
 * @param {string} userId
 * @param {string} remoteUrl the `picture` claim from Google's ID token
 * @returns {Promise<string|null>} public path to store in user_profiles.avatar_url
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

  // Same source URL -> same file, skipping unchanged Google avatar
  const digest = `g${crypto.createHash('sha256').update(remoteUrl).digest('hex').slice(0, 12)}`;

  try {
    await fs.mkdir(avatarsDir(), { recursive: true });

    // Check existing image
    const existing = (await fs.readdir(avatarsDir())).find((f) => f.startsWith(`${userId}-${digest}.`));
    if (existing) return `${PUBLIC_PREFIX}/${existing}`;

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
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) return null; // not an image we're willing to serve back out

    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    const filename = `${userId}-${digest}.${ext}`;
    // Temp name first to protect against mid-write crashes
    const finalPath = path.join(avatarsDir(), filename);
    const tempPath = `${finalPath}.tmp`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, finalPath);

    await removeOtherAvatars(userId, filename);

    return `${PUBLIC_PREFIX}/${filename}`;
  } catch {
    // Network error, timeout, disk full, permissions
    return null;
  }
}

// Return the root-relative path as-is
function toPublicAvatarUrl(stored) {
  if (!stored) return null;
  return stored;
}

/**
 * Named with a `-u` marker (Google's use `-g`). Acts as a check for Google
 * to avoid appending any user avatars as opposed to when a user has no set avatar
 * 
 * @param {string} userId
 * @param {Buffer} buffer raw image bytes
 * @param {string} mimetype as reported by the upload
 * @returns {Promise<string|null>} public path, or null if rejected
 */
async function saveUploadedAvatar(userId, buffer, mimetype) {
  if (!userId || !buffer || buffer.length === 0) return null;

  const ext = ALLOWED_TYPES[(mimetype || '').split(';')[0].trim().toLowerCase()];
  if (!ext) return null;
  if (buffer.length > MAX_BYTES) return null;

  if (!looksLikeImage(buffer, ext)) return null;

  try {
    await fs.mkdir(avatarsDir(), { recursive: true });

    // Bytes are hashed into the filename, so same picture-uploads are detected
    const digest = `u${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12)}`;
    const filename = `${userId}-${digest}.${ext}`;
    const finalPath = path.join(avatarsDir(), filename);
    const tempPath = `${finalPath}.tmp`;

    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, finalPath);
    await removeOtherAvatars(userId, filename);

    return `${PUBLIC_PREFIX}/${filename}`;
  } catch {
    return null;
  }
}

// Magic-number check for accepted formats (.jpg, .png, .web)
function looksLikeImage(buffer, ext) {
  if (buffer.length < 12) return false;
  if (ext === 'jpg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === 'png') {
    return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  if (ext === 'webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
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
  PUBLIC_PREFIX,
};