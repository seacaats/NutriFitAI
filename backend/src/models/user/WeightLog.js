const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF } = require('../shared');

const { Schema } = mongoose;

// Weight is a time series, never a field on the user. A profile edit adds
// an entry rather than overwriting, which is what makes a trend answerable.
// Own collection since it's unbounded (a daily logger is 365 entries a year)
const weightLogSchema = new Schema(
  {
    userId: USER_REF,
    weightKg: { type: Number, required: true, min: 0, max: 700 },
    measuredAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'weight_logs' },
);

// Indexes are created by migrations 001, not declared here

weightLogSchema.statics.record = async function record(input, client) {
  const [doc] = await this.create(
    [{ userId: input.userId, weightKg: input.weightKg, measuredAt: new Date() }],
    opts(client),
  );
  return doc.toObject();
};

weightLogSchema.statics.findLatestByUserId = async function findLatestByUserId(userId, client) {
  return this.findOne({ userId }, null, opts(client)).sort({ measuredAt: -1 }).lean();
};

// Oldest first, for the coach's 30-day trend
weightLogSchema.statics.findSince = async function findSince(userId, since, client) {
  return this.find({ userId, measuredAt: { $gte: since } }, 'weightKg measuredAt', opts(client))
    .sort({ measuredAt: 1 })
    .lean();
};

// Oldest first, between two instants. Feeds the Progress weight chart
weightLogSchema.statics.findBetween = async function findBetween(userId, start, end, client) {
  return this.find({ userId, measuredAt: { $gte: start, $lt: end } }, 'weightKg measuredAt', opts(client))
    .sort({ measuredAt: 1 })
    .lean();
};

// The last weight before an instant, the baseline a period's change is measured from
weightLogSchema.statics.findLatestBefore = async function findLatestBefore(userId, before, client) {
  return this.findOne({ userId, measuredAt: { $lt: before } }, 'weightKg measuredAt', opts(client))
    .sort({ measuredAt: -1 })
    .lean();
};

module.exports = mongoose.model('WeightLog', weightLogSchema);