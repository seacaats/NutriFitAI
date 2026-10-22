const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// recommendations -- the dashboard's cards. One row each, written by the
// AI or, when it is down, from the same candidates by rule (source). `ref` is
// the catalog item it points at ("f12" food, "w345" workout). Closed rows
// (dismissed or done) stay for the day, so a regenerate doesn't bring the
// same card back. A workout card is a routine: `exercises` holds its picks, and
// `routineId` the saved routine once the user starts it
const KINDS = ['food', 'workout', 'general'];

const recommendationSchema = new Schema(
  {
    userId: USER_REF,
    day: { ...CALENDAR_DAY, required: true },
    kind: { type: String, enum: KINDS, required: true },
    title: { type: String, required: true, maxlength: 60 },
    body: { type: String, required: true, maxlength: 240 },
    // Figures straight from the data ("1 cup · 240 kcal · P 12 g"), never the model's
    detail: { type: String, maxlength: 160, default: null },
    ref: { type: String, maxlength: 20, default: null },
    // Where the button goes, when it isn't the kind's usual screen
    route: { type: String, maxlength: 200, default: null },
    // A routine card's exercises, same fields as a routine's (WorkoutRoutine)
    exercises: {
      type: [
        new Schema(
          {
            exerciseRef: { type: Number, required: true },
            exerciseName: { type: String, required: true, maxlength: 150 },
            targetSets: { type: Number, default: 3 },
            targetReps: { type: Number, default: 10 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    // The routine saved from this card, so starting it twice reuses it
    routineId: { type: String, maxlength: 30, default: null },
    source: { type: String, enum: ['rule', 'ai'], required: true },
    // Which AI provider wrote it ("cloudflare"), null when it was made locally by rule
    provider: { type: String, maxlength: 30, default: null },
    status: { type: String, enum: ['new', 'dismissed', 'done'], default: 'new' },
    feedback: { type: String, enum: ['up', 'down', null], default: null },
    // Also drives the 60-day expiry (migration 009)
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'recommendations' },
);

// Indexes are created by migration 009, not declared here

recommendationSchema.statics.KINDS = KINDS;

// Every row of one day, oldest first
recommendationSchema.statics.listForDay = async function listForDay(userId, day, client) {
  const rows = await this.find({ userId, day }, null, opts(client)).sort({ createdAt: 1 }).lean();
  return rows.map(withId);
};

// Swaps the day's open rows for `items` ({ kind, title, body, source }).
// Closed rows are left alone
recommendationSchema.statics.replaceOpen = async function replaceOpen(userId, day, items, client) {
  await this.deleteMany({ userId, day, status: 'new' }, opts(client));
  if (!items.length) return [];
  const docs = await this.create(items.map((i) => ({ ...i, userId, day })), opts(client));
  return docs.map((d) => withId(d.toObject()));
};

// Owner-only. Null when it isn't theirs
recommendationSchema.statics.findOwned = async function findOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(await this.findOne({ _id: id, userId }, null, opts(client)).lean());
};

// Owner-only, the filter does the check. Null when it isn't theirs
recommendationSchema.statics.updateOwned = async function updateOwned(id, userId, changes, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await this.findOneAndUpdate(
    { _id: id, userId },
    { $set: changes },
    { new: true, runValidators: true, ...opts(client) },
  ).lean();
  return withId(doc);
};

module.exports = mongoose.model('Recommendation', recommendationSchema);