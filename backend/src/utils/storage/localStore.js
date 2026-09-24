const fs = require('fs/promises');
const path = require('path');

const env = require('../../../config/env');
const { assertSafeKey } = require('./keys');


//Objects are written under env.uploadsDir, which app.js already serves at
//uploads with a 30-day immutable cache, nosniff and dotfiles denied 

const PUBLIC_PREFIX = '/uploads';

function absolutePathFor(key) {
  assertSafeKey(key);
  const full = path.join(env.uploadsDir, key);

  // Second layer traversal check atop assertSafeKey() to check for unsanitized keys
  const root = path.resolve(env.uploadsDir);
  if (!path.resolve(full).startsWith(root + path.sep)) {
    throw new Error(`storage key escapes uploads root: ${key}`);
  }
  return full;
}

async function save(buffer, { key }) {
  const full = absolutePathFor(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return { key, bytes: buffer.length };
}

// Deletes an uploaded file (reserved for avatars). No error 
// throws, in case done with account deletion
async function remove(key) {
  try {
    await fs.unlink(absolutePathFor(key));
  } catch {
    // Gone, or unreadable
  }
}

// Every object under a prefix or directory (reserved for food scans)
async function removePrefix(prefix) {
  try {
    const dir = absolutePathFor(prefix.replace(/\/$/, ''));
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Same reasoning as remove()
  }
}

async function exists(key) {
  try {
    await fs.access(absolutePathFor(key));
    return true;
  } catch {
    return false;
  }
}

// Stabilized uniform interface across future storage drivers
// The returned relative path is also prefixed in the frontend's 
// resolveMediaUrl with the API origin, passing absolute URLs
async function urlFor(key) {
  if (!key) return null;
  return `${PUBLIC_PREFIX}/${key}`;
}

module.exports = { save, remove, removePrefix, exists, urlFor, driver: 'local', isPrivate: false };