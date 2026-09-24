const crypto = require('crypto');

// Stores abstract keys for uploaded files instead of resolved URLs

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Reject non-properly formatted keys 
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

// Builds filename string based on Google URL 
function avatarKey(userId, sourceUrl, contentType) {
  const digest = `g${crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12)}`;
  return assertSafeKey(`avatars/${userId}-${digest}.${extensionFor(contentType)}`);
}

// Builds filename randomly since no stable source like above
function uploadedAvatarKey(userId, contentType) {
  const rand = crypto.randomBytes(6).toString('hex');
  return assertSafeKey(`avatars/${userId}-u${rand}.${extensionFor(contentType)}`);
}

// Namespaced per user so retention/account-deletion sweeps and cascade
// can operate without issue, uuid appended because these are personal data
function scanKey(userId, contentType) {
  return assertSafeKey(`scans/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`);
}

/** Prefix matching "everything belonging to this user", used by the cascade. */
function userScanPrefix(userId) {
  return `scans/${userId}/`;
}

module.exports = {
  EXT_BY_TYPE,
  assertSafeKey,
  extensionFor,
  avatarKey,
  uploadedAvatarKey,
  scanKey,
  userScanPrefix,
};