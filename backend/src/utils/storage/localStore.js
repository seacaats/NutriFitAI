const fs = require('fs/promises');
const path = require('path');

const env = require('../../../config/env');
const { assertSafeKey } = require('./keys');

// Local filesystem storage driver under env.uploadsDir (mounted at /uploads).

const PUBLIC_PREFIX = '/uploads';

function absolutePathFor(key) {
  assertSafeKey(key);
  const full = path.join(env.uploadsDir, key);

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

async function remove(key) {
  try {
    await fs.unlink(absolutePathFor(key));
  } catch {
    // Ignore missing or unreadable files
  }
}

async function removePrefix(prefix) {
  try {
    const dir = absolutePathFor(prefix.replace(/\/$/, ''));
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore missing directories
  }
}

async function list(prefix) {
  const dir = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/')) : '';
  const start = prefix.slice(dir ? dir.length + 1 : 0);
  try {
    const files = await fs.readdir(dir ? absolutePathFor(dir) : env.uploadsDir);
    return files.filter((f) => f.startsWith(start) && !f.endsWith('.tmp')).map((f) => (dir ? `${dir}/${f}` : f));
  } catch {
    return [];
  }
}

async function read(key) {
  try {
    return await fs.readFile(absolutePathFor(key));
  } catch {
    return null;
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

async function urlFor(key) {
  if (!key) return null;
  return `${PUBLIC_PREFIX}/${key}`;
}

module.exports = { save, remove, removePrefix, list, exists, read, urlFor, driver: 'local', isPrivate: false };
