const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const env = require('../../../config/env');
const { assertSafeKey } = require('./keys');

// Cloudflare R2 through its S3-compatible API. The bucket stays private:
// every read is a short-lived signed link (urlFor), since avatars and scan
// photos are personal. Region is always "auto" on R2
const { accountId, bucket, accessKeyId, secretAccessKey, urlTtlSeconds } = env.storage.r2;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function save(buffer, { key, contentType }) {
  assertSafeKey(key);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Keys are content- or random-named, so an object never changes
    CacheControl: 'private, max-age=2592000, immutable',
  }));
  return { key, bytes: buffer.length };
}

// Never throws, same as localStore: deletes run inside account deletion
async function remove(key) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }));
  } catch {
    // Gone, or R2 unreachable
  }
}

// Keys under a prefix, up to 1,000 per page
async function list(prefix) {
  const keys = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    (page.Contents || []).forEach((o) => keys.push(o.Key));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

// R2 has no folders: list the prefix, delete in batches of 1,000
async function removePrefix(prefix) {
  try {
    const keys = await list(prefix);
    for (let i = 0; i < keys.length; i += 1000) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }));
    }
  } catch {
    // Same reasoning as remove()
  }
}

async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }));
    return true;
  } catch {
    return false;
  }
}

// An absolute https link, so the frontend's resolveMediaUrl passes it through
async function urlFor(key) {
  if (!key) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }), { expiresIn: urlTtlSeconds });
}

module.exports = { save, remove, removePrefix, list, exists, urlFor, driver: 'r2', isPrivate: true };