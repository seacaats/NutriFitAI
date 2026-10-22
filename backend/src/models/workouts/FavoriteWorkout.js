const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// User favorites for routines and exercises
const favoriteWorkoutSchema = new Schema(
  {
    userId: USER_REF,
    kind: { type: String, enum: ['routine', 'exercise'], required: true },
    // Routine ObjectId or numeric exercise ID stored as string
    refId: { type: String, required: true, maxlength: 64 },
    name: { type: String, required: true, maxlength: 150 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'favorite_workouts' },
);

favoriteWorkoutSchema.statics.list = async function list(userId, client) {
  const rows = await this.find({ userId }, null, opts(client))
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return rows.map(withId);
};

favoriteWorkoutSchema.statics.add = async function add(userId, { kind, refId, name }, client) {
  return withId(
    await this.findOneAndUpdate(
      { userId, kind, refId },
      { $setOnInsert: { userId, kind, refId, createdAt: new Date() }, $set: { name } },
      { upsert: true, new: true, ...opts(client) },
    ).lean(),
  );
};

favoriteWorkoutSchema.statics.drop = async function drop(userId, kind, refId, client) {
  const result = await this.deleteOne({ userId, kind, refId }, opts(client));
  return result.deletedCount > 0;
};

favoriteWorkoutSchema.statics.rename = async function rename(kind, refId, name, client) {
  await this.updateMany({ kind, refId }, { $set: { name } }, opts(client));
};

favoriteWorkoutSchema.statics.removeAllFor = async function removeAllFor(kind, refId, client) {
  await this.deleteMany({ kind, refId }, opts(client));
};

module.exports = mongoose.model('FavoriteWorkout', favoriteWorkoutSchema);
