const crypto = require('crypto');
const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// Active device sessions, referenced in tokens as `sid` for revocation and expiry tracking
const sessionSchema = new Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: USER_REF,
    ip: { type: String, maxlength: 64, default: null },
    userAgent: { type: String, maxlength: 200, default: null },
    createdAt: { type: Date, default: () => new Date() },
    lastUsedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Admin userId if revoked by an admin; null if revoked by the user
    revokedBy: { type: String, default: null },
  },
  { versionKey: false, collection: 'auth_sessions' },
);

// Indexes are created by migrations 010, not declared here

sessionSchema.statics.open = async function open(userId, { ip, userAgent, expiresAt }, client) {
  const [doc] = await this.create(
    [{ userId, ip: ip || null, userAgent: userAgent ? String(userAgent).slice(0, 200) : null, expiresAt }],
    opts(client),
  );
  return withId(doc.toObject());
};

sessionSchema.statics.isLive = async function isLive(id, userId, client) {
  return Boolean(await this.exists({ _id: id, userId, revokedAt: null, expiresAt: { $gt: new Date() } }, opts(client)));
};

// Extends session expiry on token refresh if still active
sessionSchema.statics.touch = async function touch(id, userId, expiresAt, client) {
  const result = await this.updateOne(
    { _id: id, userId, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { lastUsedAt: new Date(), expiresAt } },
    opts(client),
  );
  return result.matchedCount > 0;
};

sessionSchema.statics.listLive = async function listLive(userId, client) {
  const rows = await this.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }, null, opts(client))
    .sort({ lastUsedAt: -1 })
    .lean();
  return rows.map(withId);
};

// by: the admin's id, or null when the user ends their own
sessionSchema.statics.revoke = async function revoke(userId, id, by = null, client) {
  const result = await this.updateOne(
    { _id: id, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedBy: by } },
    opts(client),
  );
  return result.modifiedCount > 0;
};

// Every live session, or all but `exceptId` (the one making the request)
sessionSchema.statics.revokeAll = async function revokeAll(userId, by = null, exceptId = null, client) {
  const filter = { userId, revokedAt: null, expiresAt: { $gt: new Date() } };
  if (exceptId) filter._id = { $ne: exceptId };
  const result = await this.updateMany(filter, { $set: { revokedAt: new Date(), revokedBy: by } }, opts(client));
  return result.modifiedCount;
};

module.exports = mongoose.model('Session', sessionSchema);
