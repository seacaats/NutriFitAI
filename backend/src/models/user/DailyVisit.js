const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// One record per user per local calendar day for active-user analytics
const dailyVisitSchema = new Schema(
  {
    userId: USER_REF,
    day: { ...CALENDAR_DAY, required: true },
    firstSeenAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'daily_visits' },
);

dailyVisitSchema.statics.record = function record(userId, day, client) {
  return this.updateOne(
    { userId, day },
    { $setOnInsert: { userId, day, firstSeenAt: new Date() } },
    { upsert: true, ...opts(client) },
  );
};

module.exports = mongoose.model('DailyVisit', dailyVisitSchema);
