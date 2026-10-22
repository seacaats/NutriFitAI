const { mongoose, opts } = require('../../../config/mongo');
const { CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// Daily platform totals in env.analytics.rollupTimeZone, written by dailyRollup.js
const dailyRollupSchema = new Schema(
  {
    day: { ...CALENDAR_DAY, required: true },
    signups: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    meals: { type: Number, default: 0 },
    scans: { type: Number, default: 0 },
    workouts: { type: Number, default: 0 },
    waterLogs: { type: Number, default: 0 },
    coachMessages: { type: Number, default: 0 },
    // Audit events by severity (chain). Absent on older rows
    audit: {
      info: { type: Number, default: 0 },
      notice: { type: Number, default: 0 },
      warning: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
    },
    computedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'daily_rollups' },
);

// Indexes are created by migrations/007_nutrifitai.js, not declared here

// Replaces each day's row with fresh counts: [{ day, ...counts }]. Safe to repeat
dailyRollupSchema.statics.upsertDays = async function upsertDays(rows, client) {
  if (!rows.length) return;
  const now = new Date();
  await this.bulkWrite(
    rows.map(({ day, ...counts }) => ({
      updateOne: { filter: { day }, update: { $set: { ...counts, computedAt: now } }, upsert: true },
    })),
    { ordered: false, ...opts(client) },
  );
};

// Inclusive range, oldest first
dailyRollupSchema.statics.findRange = function findRange(from, to, client) {
  return this.find({ day: { $gte: from, $lte: to } }, '-_id -computedAt', opts(client)).sort({ day: 1 }).lean();
};

module.exports = mongoose.model('DailyRollup', dailyRollupSchema);