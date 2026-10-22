const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// Logged meals; item nutrition is snapshotted at log time (scaled by portionGrams)
const mealItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    scanRef: {
      type: new Schema(
        {
          scanId: { type: Schema.Types.ObjectId, required: true },
          itemId: { type: Schema.Types.ObjectId, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    foodName: { type: String, required: true, maxlength: 150 },
    serving: { type: String, default: null, maxlength: 60 },
    servings: { type: Number, default: 1, min: 0.01 },
    portionGrams: { type: Number, default: null },
    caloriesKcal: { type: Number, default: null },
    proteinG: { type: Number, default: null },
    carbsG: { type: Number, default: null },
    fatG: { type: Number, default: null },
  },
  { _id: false },
);

const mealSchema = new Schema(
  {
    userId: USER_REF,
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    status: {
      type: String,
      enum: ['planned', 'consumed', 'skipped'],
      default: 'planned',
      required: true,
    },
    // Calendar day in the user's timezone (YYYY-MM-DD)
    mealDate: { ...CALENDAR_DAY, required: true },
    consumedAt: { type: Date, default: null },
    items: { type: [mealItemSchema], default: [] },
  },
  { versionKey: false, collection: 'meals' },
);

// Indexes are created by migrations 003, not declared here

function totalsOf(items) {
  const sum = (key) => Math.round(items.reduce((acc, i) => acc + (i[key] || 0), 0) * 10) / 10;
  return { caloriesKcal: sum('caloriesKcal'), proteinG: sum('proteinG'), carbsG: sum('carbsG'), fatG: sum('fatG') };
}

// Attaches derived macro totals to the meal payload
function toPayload(doc) {
  const meal = withId(doc);
  return meal && { ...meal, totals: totalsOf(meal.items || []) };
}

mealSchema.statics.logConsumed = async function logConsumed({ userId, mealType, mealDate, items }, client) {
  const [doc] = await this.create(
    [{ userId, mealType, mealDate, status: 'consumed', consumedAt: new Date(), items }],
    opts(client),
  );
  return toPayload(doc.toObject());
};

// Meals from `fromDate` (YYYY-MM-DD, inclusive) onward, oldest first
mealSchema.statics.listSince = async function listSince(userId, fromDate, client) {
  const rows = await this.find({ userId, mealDate: { $gte: fromDate } }, null, opts(client))
    .sort({ mealDate: 1, consumedAt: 1 })
    .lean();
  return rows.map(toPayload);
};

mealSchema.statics.getOwned = async function getOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return toPayload(await this.findOne({ _id: id, userId }, null, opts(client)).lean());
};

/** Paginated meal history grouped by day (newest first, `before` is exclusive). */
mealSchema.statics.historyPage = async function historyPage(userId, { before = null, days = 14 } = {}, client) {
  const match = { userId };
  if (before) match.mealDate = { $lt: before };

  const dayRows = await this.aggregate([
    { $match: match },
    { $group: { _id: '$mealDate' } },
    { $sort: { _id: -1 } },
    { $limit: days },
  ]).session(opts(client).session || null);
  const dates = dayRows.map((d) => d._id);
  if (!dates.length) return [];

  const rows = await this.find({ userId, mealDate: { $in: dates } }, null, opts(client))
    .sort({ mealDate: -1, consumedAt: 1 })
    .lean();

  return dates.map((date) => {
    const meals = rows.filter((m) => m.mealDate === date).map(toPayload);
    return { date, meals, totals: totalsOf(meals.flatMap((m) => m.items)) };
  });
};

mealSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await this.findOneAndDelete({ _id: id, userId }, opts(client)).lean();
  return toPayload(doc);
};

// Daily macro totals and meal counts in [from, to]
mealSchema.statics.dailyTotals = async function dailyTotals(userId, from, to, client) {
  const rows = await this.aggregate([
    { $match: { userId, status: 'consumed', mealDate: { $gte: from, $lte: to } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { day: '$mealDate', meal: '$_id' },
        caloriesKcal: { $sum: { $ifNull: ['$items.caloriesKcal', 0] } },
        proteinG: { $sum: { $ifNull: ['$items.proteinG', 0] } },
        carbsG: { $sum: { $ifNull: ['$items.carbsG', 0] } },
        fatG: { $sum: { $ifNull: ['$items.fatG', 0] } },
      },
    },
    {
      $group: {
        _id: '$_id.day',
        caloriesKcal: { $sum: '$caloriesKcal' },
        proteinG: { $sum: '$proteinG' },
        carbsG: { $sum: '$carbsG' },
        fatG: { $sum: '$fatG' },
        meals: { $sum: 1 },
      },
    },
  ]).session(opts(client).session || null);

  return rows.reduce((acc, r) => ({ ...acc, [r._id]: r }), {});
};

mealSchema.statics.totalsOf = totalsOf;

module.exports = mongoose.model('Meal', mealSchema);