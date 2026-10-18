const { mongoose, opts } = require('../../../config/mongo');
const { CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// One snapshot per day of how far new accounts get, counted by
// services/analytics/activationFunnel.js and shown on admin Analytics. `from` and `to`
// are the signup days of the accounts counted; each step only includes the
// accounts that passed every step before it
const activationFunnelSchema = new Schema(
  {
    day: { ...CALENDAR_DAY, required: true },
    from: { ...CALENDAR_DAY, required: true },
    to: { ...CALENDAR_DAY, required: true },
    steps: {
      signedUp: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      onboarded: { type: Number, default: 0 },
      logged: { type: Number, default: 0 },
      returned: { type: Number, default: 0 },
    },
    computedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'activation_funnels' },
);

// Indexes are created by migrations/007_nutrifitai.js, not declared here

// Replaces the day's snapshot. Safe to repeat
activationFunnelSchema.statics.upsertDay = function upsertDay({ day, from, to, steps }, client) {
  return this.updateOne(
    { day },
    { $set: { from, to, steps, computedAt: new Date() } },
    { upsert: true, ...opts(client) },
  );
};

// The newest snapshot, or null before the first run
activationFunnelSchema.statics.findLatest = function findLatest(client) {
  return this.findOne({}, '-_id -computedAt', opts(client)).sort({ day: -1 }).lean();
};

module.exports = mongoose.model('ActivationFunnel', activationFunnelSchema);