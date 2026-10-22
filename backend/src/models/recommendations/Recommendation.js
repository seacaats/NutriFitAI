const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY, withId } = require('../shared');

const { Schema } = mongoose;

// Daily dashboard recommendation cards (AI-generated or rule-based fallback).
// Dismissed/completed cards remain for the day so regeneration does not repeat them.
const KINDS = ['food', 'workout', 'general'];

const recommendationSchema = new Schema(
  {
    userId: USER_REF,
    day: { ...CALENDAR_DAY, required: true },
    kind: { type: String, enum: KINDS, required: true },
    title: { type: String, required: true, maxlength: 60 },
    body: { type: String, required: true, maxlength: 240 },
    detail: { type: String, maxlength: 160, default: null },
    ref: { type: String, maxlength: 20, default: null },
    route: { type: String, maxlength: 200, default: null },
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
    // Saved routine ID once started from this card
    routineId: { type: String, maxlength: 30, default: null },
    source: { type: String, enum: ['rule', 'ai'], required: true },
    provider: { type: String, maxlength: 30, default: null },
    status: { type: String, enum: ['new', 'dismissed', 'done'], default: 'new' },
    feedback: { type: String, enum: ['up', 'down', null], default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'recommendations' },
);

recommendationSchema.statics.KINDS = KINDS;

recommendationSchema.statics.listForDay = async function listForDay(userId, day, client) {
  const rows = await this.find({ userId, day }, null, opts(client)).sort({ createdAt: 1 }).lean();
  return rows.map(withId);
};

// Replace only 'new' cards for the day, preserving dismissed/done cards
recommendationSchema.statics.replaceOpen = async function replaceOpen(userId, day, items, client) {
  await this.deleteMany({ userId, day, status: 'new' }, opts(client));
  if (!items.length) return [];
  const docs = await this.create(items.map((i) => ({ ...i, userId, day })), opts(client));
  return docs.map((d) => withId(d.toObject()));
};

recommendationSchema.statics.findOwned = async function findOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(await this.findOne({ _id: id, userId }, null, opts(client)).lean());
};

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
