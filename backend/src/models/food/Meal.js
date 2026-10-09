const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// meals -- written by the food scanner's "Log meal" for now, read by the
// scanner, the meal history and the coach

// Nutrition is copied from the scan onto each item (already multiplied by
// `servings`) since scan images are purged on retention and the scan itself
// isn't meant to be read to render a meal
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
    // "1 cup" x 1.5. The values below are totals for the whole portion
    serving: { type: String, default: null, maxlength: 60 },
    servings: { type: Number, default: 1, min: 0.25 },
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
    // The day it's eaten, in the user's own timezone. A string, never a Date,
    // so a 7am Manila breakfast doesn't land on the previous day
    mealDate: { ...CALENDAR_DAY, required: true },
    // The instant it was logged as eaten. Timestamp only, days come from mealDate
    consumedAt: { type: Date, default: null },

    // A meal can either have one or a handful items, always read and
    // written with their meal, and queried all the same
    items: { type: [mealItemSchema], default: [] },
  },
  { versionKey: false, collection: 'meals' },
);

// Indexes are created by migrations 003, not declared here

// Sums a meal's items. Missing values count as 0 rather than blanking the total
function totalsOf(items) {
  const sum = (key) => Math.round(items.reduce((acc, i) => acc + (i[key] || 0), 0) * 10) / 10;
  return { caloriesKcal: sum('caloriesKcal'), proteinG: sum('proteinG'), carbsG: sum('carbsG'), fatG: sum('fatG') };
}

// Totals are derived on read, never stored, so they can't drift from the items
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

// Every meal from `fromDate` (YYYY-MM-DD, inclusive) on, oldest first.
// Feeds the coach's recent-intake summary. Served by meals_user_day
mealSchema.statics.listSince = async function listSince(userId, fromDate, client) {
  const rows = await this.find({ userId, mealDate: { $gte: fromDate } }, null, opts(client))
    .sort({ mealDate: 1, consumedAt: 1 })
    .lean();
  return rows.map(toPayload);
};

// Owner-only, the filter does the check. A thread about a meal re-reads it
// on every turn, so a deleted meal comes back null rather than stale
mealSchema.statics.getOwned = async function getOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return toPayload(await this.findOne({ _id: id, userId }, null, opts(client)).lean());
};

/**
 * History, a page of days at a time, newest first. Only days that have meals
 * count towards a page, so "Load more" never returns an empty window.
 * `before` is the oldest day already shown (exclusive)
 */
mealSchema.statics.historyPage = async function historyPage(userId, { before = null, days = 14 } = {}, client) {
  const match = { userId };
  if (before) match.mealDate = { $lt: before };

  // Distinct days first (served by meals_user_day), then those days' meals
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

// Owner-only, the filter does the check. Returns the meal for the audit entry
mealSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await this.findOneAndDelete({ _id: id, userId }, opts(client)).lean();
  return toPayload(doc);
};

// Calories and macros per day between two days (inclusive), plus how many
// meals each day had. { "2026-09-28": { caloriesKcal, proteinG, carbsG, fatG, meals } }
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