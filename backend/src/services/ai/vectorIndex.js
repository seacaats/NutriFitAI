const fs = require('fs');
const path = require('path');
const env = require('../../../config/env');

// In-memory vectors for the coach's semantic search, built by
// scripts/build-embeddings.js. Items are { type, id, h, v }: h is a hash of
// the embedded text, v the unit vector as base64 float32

const FILE = path.join(__dirname, '../../../data/coach_embeddings.json');

let loaded = null;

const encode = (vec) => Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString('base64');
// Copied: a Buffer's memory isn't always aligned for a Float32Array
const decode = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
};

// The raw file, or null when it's missing or unreadable
function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
}

// Loaded once. A missing file or one built with another model or size is ignored
function load() {
  if (loaded) return loaded;
  loaded = new Map();
  const raw = readRaw();
  const cfg = env.ai.embed;
  if (!raw?.items) return loaded;
  if (raw.model !== cfg.model || raw.dims !== cfg.dims) {
    console.warn('[ai] coach_embeddings.json was built with another model or size, semantic search is off. Rebuild it');
    return loaded;
  }
  for (const item of raw.items) {
    if (!loaded.has(item.type)) loaded.set(item.type, []);
    loaded.get(item.type).push({ id: String(item.id), vec: decode(item.v) });
  }
  return loaded;
}

/**
 * Best matches of one type, highest similarity first. Empty when the index
 * has nothing of that type or nothing clears `min`
 * @param {string} type 'food' | 'exercise' | 'note'
 * @param {Float32Array} query unit vector
 * @param {{ k?: number, min?: number }} opts
 * @returns {Array<{ id: string, score: number }>}
 */
function search(type, query, { k = 6, min = 0 } = {}) {
  const rows = load().get(type);
  if (!rows || !query) return [];
  const hits = [];
  for (const { id, vec } of rows) {
    if (vec.length !== query.length) return [];
    let dot = 0;
    for (let i = 0; i < vec.length; i += 1) dot += vec[i] * query[i];
    if (dot >= min) hits.push({ id, score: dot });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

module.exports = { search, load, readRaw, encode, FILE };