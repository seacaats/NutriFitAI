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

// Private Cloudflare R2 storage driver accessed via S3-compatible API and short-lived presigned URLs.
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
    CacheControl: 'private, max-age=2592000, immutable',
  }));
  return { key, bytes: buffer.length };
}

async function remove(key) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }));
  } catch {
    // Ignore missing objects or R2 errors
  }
}

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
    // Ignore R2 errors during prefix deletion
  }
}

async function read(key) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }));
    return Buffer.from(await response.Body.transformToByteArray());
  } catch {
    return null;
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

async function urlFor(key) {
  if (!key) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }), { expiresIn: urlTtlSeconds });
}

module.exports = { save, remove, removePrefix, list, exists, read, urlFor, driver: 'r2', isPrivate: true };
