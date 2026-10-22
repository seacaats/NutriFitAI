const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// Individual water intake entries; daily totals are summed on read
const waterLogSchema = new Schema(
  {
    userId: USER_REF,
    amountMl: { type: Number, required: true, min: 1, max: 1500 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'water_logs' },
);

waterLogSchema.statics.add = async function add(userId, amountMl, client) {
  const [doc] = await this.create([{ userId, amountMl, loggedAt: new Date() }], opts(client));
  return withId(doc.toObject());
};

waterLogSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { deletedCount } = await this.deleteOne({ _id: id, userId }, opts(client));
  return deletedCount > 0;
};

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

// Replace a range's entries in order, preserving existing timestamps where available
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

// Sum intake per local calendar day ({ "YYYY-MM-DD": totalMl })
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
