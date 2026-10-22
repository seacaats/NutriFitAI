const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// Sent notifications (in-inbox and push-only entries tracked for deduplication)
const notificationSchema = new Schema(
  {
    userId: USER_REF,
    type: { type: String, required: true, maxlength: 60 },
    category: { type: String, enum: ['reminders', 'achievements', 'coach', 'account'], required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 300 },
    link: { type: String, maxlength: 200, default: null },
    inInbox: { type: Boolean, default: true },

    // Local calendar day for daily rate limits
    day: { ...CALENDAR_DAY, required: true },
    // Unique key to prevent duplicate reminders across runs or instances
    dedupeKey: { type: String, maxlength: 200, default: null },

    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'notifications' },
);

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Returns the created notification, or null on duplicate dedupeKey
notificationSchema.statics.record = async function record(input, client) {
  try {
    const [doc] = await this.create(
      [{ ...input, createdAt: new Date(), expiresAt: new Date(Date.now() + RETENTION_MS) }],
      opts(client),
    );
    return withId(doc.toObject());
  } catch (err) {
    if (err && err.code === 11000) return null;
    throw err;
  }
};

notificationSchema.statics.countToday = async function countToday(userId, category, day, exceptTypes = [], client) {
  return this.countDocuments({ userId, category, day, type: { $nin: exceptTypes } }, opts(client));
};

notificationSchema.statics.inbox = async function inbox(userId, { before = null, limit = 30 } = {}, client) {
  const filter = { userId, inInbox: true };
  const pageFilter = before ? { ...filter, createdAt: { $lt: before } } : filter;
  const [rows, unread] = await Promise.all([
    this.find(pageFilter, 'type category title body link readAt createdAt', opts(client))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    this.countDocuments({ ...filter, readAt: null }, opts(client)),
  ]);
  return { rows: rows.map(withId), unread };
};

// Marks specific IDs as read, or all unread when `ids` is empty
notificationSchema.statics.markRead = async function markRead(userId, ids = [], client) {
  const filter = { userId, inInbox: true, readAt: null };
  if (ids.length) filter._id = { $in: ids.filter((id) => mongoose.isValidObjectId(id)) };
  const result = await this.updateMany(filter, { $set: { readAt: new Date() } }, opts(client));
  return result.modifiedCount;
};

module.exports = mongoose.model('Notification', notificationSchema);
