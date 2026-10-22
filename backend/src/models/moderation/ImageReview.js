const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF } = require('../shared');

const { Schema } = mongoose;

// Moderation records for flagged, blocked, or unchecked uploads (clean uploads leave no record)
const imageReviewSchema = new Schema(
  {
    userId: USER_REF,
    kind: { type: String, enum: ['avatar', 'scan', 'workout'], required: true },
    // Null when blocked before storage
    storageKey: { type: String, maxlength: 300, default: null },
    // Associated scan or workout ID (null for avatars)
    refId: { type: String, maxlength: 40, default: null },
    status: { type: String, enum: ['review', 'blocked', 'unchecked', 'approved', 'removed'], required: true },
    flagged: { type: [String], default: [] },
    topCategory: { type: String, maxlength: 40, default: null },
    topScore: { type: Number, default: null },

    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    decisionReason: { type: String, maxlength: 300, default: null },

    lastCheckAt: { type: Date, default: null },

    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'image_reviews' },
);

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

imageReviewSchema.statics.record = async function record(input, client) {
  const now = Date.now();
  const [doc] = await this.create(
    [{ ...input, createdAt: new Date(now), expiresAt: new Date(now + RETENTION_MS) }],
    opts(client),
  );
  return doc.toObject();
};

// Paginated admin queue with repeat offenders sorted first
imageReviewSchema.statics.listPage = async function listPage(status, { page = 1, limit = 25, priorityUserIds = [], filter = {} } = {}, client) {
  const match = { status, ...filter };
  const [rows, total] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $addFields: { priority: { $cond: [{ $in: ['$userId', priorityUserIds] }, 1, 0] } } },
      { $sort: { priority: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]).session(client || null),
    this.countDocuments(match, opts(client)),
  ]);
  return { rows, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
};

// Least-recently-tried unchecked uploads within maxAgeMs
imageReviewSchema.statics.nextUnchecked = async function nextUnchecked(maxAgeMs, batch, client) {
  return this.find(
    { status: 'unchecked', storageKey: { $ne: null }, createdAt: { $gte: new Date(Date.now() - maxAgeMs) } },
    null,
    opts(client),
  ).sort({ lastCheckAt: 1, createdAt: 1 }).limit(batch).lean();
};

imageReviewSchema.statics.markTried = async function markTried(id, client) {
  await this.updateOne({ _id: id, status: 'unchecked' }, { $set: { lastCheckAt: new Date() } }, opts(client));
};

imageReviewSchema.statics.settle = async function settle(id, fields, client) {
  return this.findOneAndUpdate({ _id: id, status: 'unchecked' }, { $set: fields }, { new: true, ...opts(client) }).lean();
};

imageReviewSchema.statics.discard = async function discard(id, client) {
  await this.deleteOne({ _id: id, status: 'unchecked' }, opts(client));
};

imageReviewSchema.statics.countBlocks = async function countBlocks(userId, since, client) {
  return this.countDocuments({ userId, status: 'blocked', createdAt: { $gte: since } }, opts(client));
};

// Map of userId -> block count for users with at least `min` blocks since `since`
imageReviewSchema.statics.repeatBlockers = async function repeatBlockers(min, since, client) {
  const rows = await this.aggregate([
    { $match: { status: 'blocked', createdAt: { $gte: since } } },
    { $group: { _id: '$userId', n: { $sum: 1 } } },
    { $match: { n: { $gte: min } } },
  ]).session(client || null);
  return new Map(rows.map((r) => [r._id, r.n]));
};

imageReviewSchema.statics.countByStatus = async function countByStatus(client) {
  const rows = await this.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).session(client || null);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
};

imageReviewSchema.statics.getById = async function getById(id, client) {
  return this.findById(id, null, opts(client)).lean();
};

// Atomically claim and resolve a 'review' item; returns null if already decided
imageReviewSchema.statics.decide = async function decide(id, status, by, reason, client) {
  return this.findOneAndUpdate(
    { _id: id, status: 'review' },
    { $set: { status, decidedBy: by, decidedAt: new Date(), decisionReason: reason } },
    { new: true, ...opts(client) },
  ).lean();
};

module.exports = mongoose.model('ImageReview', imageReviewSchema);
