const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// Every notification sent, push or not. inInbox decides whether the bell
// shows it: a "drink water" push is recorded only so it isn't sent twice
const notificationSchema = new Schema(
  {
    userId: USER_REF,
    type: { type: String, required: true, maxlength: 60 },
    category: { type: String, enum: ['reminders', 'achievements', 'coach', 'account'], required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 300 },
    // Expo Router path opened by a tap ("/water"), null for none
    link: { type: String, maxlength: 200, default: null },
    inInbox: { type: Boolean, default: true },

    // The user's own calendar day it was sent on, for the daily limit
    day: { ...CALENDAR_DAY, required: true },
    // "water:2026-10-04:midday". Unique, so a job that runs twice, or two
    // server instances, never send the same reminder twice
    dedupeKey: { type: String, maxlength: 200, default: null },

    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
    // createdAt + 90 days, removed by the notifications_expiry TTL index
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'notifications' },
);

// Indexes are created by migrations/004_nutrifitai.js, not declared here

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Returns the row, or null when the dedupeKey was already used
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

// `exceptTypes` leaves out types that don't count toward the daily limit
notificationSchema.statics.countToday = async function countToday(userId, category, day, exceptTypes = [], client) {
  return this.countDocuments({ userId, category, day, type: { $nin: exceptTypes } }, opts(client));
};

// Inbox page, newest first, with the unread count beside it
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

// One id, or every unread one when ids is empty
notificationSchema.statics.markRead = async function markRead(userId, ids = [], client) {
  const filter = { userId, inInbox: true, readAt: null };
  if (ids.length) filter._id = { $in: ids.filter((id) => mongoose.isValidObjectId(id)) };
  const result = await this.updateMany(filter, { $set: { readAt: new Date() } }, opts(client));
  return result.modifiedCount;
};

module.exports = mongoose.model('Notification', notificationSchema);