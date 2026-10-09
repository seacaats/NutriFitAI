const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// One row per user per day they used the app (any signed-in request), in
// their own timezone. What admin Analytics counts as "active". Rows go after
// about 400 days (TTL index, migration 005)
const dailyVisitSchema = new Schema(
  {
    userId: USER_REF,
    day: { ...CALENDAR_DAY, required: true },
    firstSeenAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'daily_visits' },
);

// Indexes are created by migrations/005_nutrifitai.js, not declared here

// Once per user per day: later calls that day change nothing
dailyVisitSchema.statics.record = function record(userId, day, client) {
  return this.updateOne(
    { userId, day },
    { $setOnInsert: { userId, day, firstSeenAt: new Date() } },
    { upsert: true, ...opts(client) },
  );
};

module.exports = mongoose.model('DailyVisit', dailyVisitSchema);