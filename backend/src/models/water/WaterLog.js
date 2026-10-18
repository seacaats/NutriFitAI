const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// water_logs -- one entry per drink. A "+1 glass" tap is a 250 ml entry,
// custom amounts are whatever was typed. Daily totals are summed on read
const waterLogSchema = new Schema(
  {
    userId: USER_REF,
    // Mirrors MAX_DRINK_ML in validators/waterValidators.js
    amountMl: { type: Number, required: true, min: 1, max: 1500 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'water_logs' },
);

// Indexes are created by migrations 001, 002, not declared here

waterLogSchema.statics.add = async function add(userId, amountMl, client) {
  const [doc] = await this.create([{ userId, amountMl, loggedAt: new Date() }], opts(client));
  return withId(doc.toObject());
};

// Owner-only, the filter does the check
waterLogSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { deletedCount } = await this.deleteOne({ _id: id, userId }, opts(client));
  return deletedCount > 0;
};

// Entries in [start, end), newest first
waterLogSchema.statics.listBetween = async function listBetween(userId, start, end, client) {
  const rows = await this.find(
    { userId, loggedAt: { $gte: start, $lt: end } },
    'amountMl loggedAt',
    opts(client),
  )
    .sort({ loggedAt: -1 })
    .limit(200)
    .lean();
  return rows.map(withId);
};

// Swaps one day's entries for `amounts`, in order. Existing times are kept
// where there's still an entry for them; added ones get `fallbackAt`.
// Call inside a transaction so the day is never half-replaced
waterLogSchema.statics.replaceBetween = async function replaceBetween(userId, start, end, amounts, fallbackAt, client) {
  const existing = await this.find({ userId, loggedAt: { $gte: start, $lt: end } }, 'loggedAt', opts(client))
    .sort({ loggedAt: 1 })
    .lean();

  await this.deleteMany({ userId, loggedAt: { $gte: start, $lt: end } }, opts(client));
  if (!amounts.length) return [];

  const docs = amounts.map((amountMl, i) => ({
    userId,
    amountMl,
    loggedAt: existing[i]?.loggedAt || fallbackAt,
  }));
  const created = await this.insertMany(docs, opts(client));
  return created.map((d) => withId(d.toObject()));
};

// Totals per calendar day in the user's own timezone, days without
// entries left out. { "2026-09-28": 1750, ... }
waterLogSchema.statics.dailyTotals = async function dailyTotals(userId, start, end, timeZone, client) {
  const rows = await this.aggregate([
    { $match: { userId, loggedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$loggedAt', timezone: timeZone || 'UTC' } },
        totalMl: { $sum: '$amountMl' },
      },
    },
  ]).session(opts(client).session || null);

  return rows.reduce((acc, r) => ({ ...acc, [r._id]: r.totalMl }), {});
};

module.exports = mongoose.model('WaterLog', waterLogSchema);