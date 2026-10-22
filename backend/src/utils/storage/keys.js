const crypto = require('crypto');

// Storage key builders and image magic-byte validators.

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/x-png': 'png',
  'image/webp': 'webp',
};

function assertSafeKey(key) {
  if (typeof key !== 'string' || key.length === 0) throw new Error('storage key must be a string');
  if (key.startsWith('/') || key.includes('..') || key.includes('\\')) {
    throw new Error(`unsafe storage key: ${key}`);
  }
  return key;
}

function extensionFor(contentType) {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new Error(`unsupported content type: ${contentType}`);
  return ext;
}

function avatarKey(userId, sourceUrl, contentType) {
  const digest = `g${crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12)}`;
  return assertSafeKey(`avatars/${userId}-${digest}.${extensionFor(contentType)}`);
}

function uploadedAvatarKey(userId, contentType) {
  const rand = crypto.randomBytes(6).toString('hex');
  return assertSafeKey(`avatars/${userId}-u${rand}.${extensionFor(contentType)}`);
}

function scanKey(userId, contentType) {
  return assertSafeKey(`scans/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`);
}

function userScanPrefix(userId) {
  return `scans/${userId}/`;
}

function workoutImageKey(userId, contentType) {
  return assertSafeKey(`workouts/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`);
}

function userWorkoutPrefix(userId) {
  return `workouts/${userId}/`;
}

// Validates magic bytes for .jpg, .png, and .webp
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

module.exports = {
  EXT_BY_TYPE,
  looksLikeImage,
  assertSafeKey,
  extensionFor,
  avatarKey,
  uploadedAvatarKey,
  scanKey,
  userScanPrefix,
  workoutImageKey,
  userWorkoutPrefix,
};
