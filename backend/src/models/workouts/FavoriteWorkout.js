const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// Favorites for both routines and single exercises. Own collection rather than
// an array on the user: it grows with use, and the unique index stops doubles
const favoriteWorkoutSchema = new Schema(
  {
    userId: USER_REF,
    kind: { type: String, enum: ['routine', 'exercise'], required: true },
    // Routine ObjectId or wger exercise id, both stored as strings
    refId: { type: String, required: true, maxlength: 64 },
    // Snapshot so the list renders without a lookup per row
    name: { type: String, required: true, maxlength: 150 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'favorite_workouts' },
);

// Indexes are created by migrations 002, not declared here

favoriteWorkoutSchema.statics.list = async function list(userId, client) {
  const rows = await this.find({ userId }, null, opts(client))
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return rows.map(withId);
};

// Idempotent: favoriting twice keeps one row (upsert on the unique key)
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

// Updates the snapshot name everywhere, e.g. after a routine is renamed
favoriteWorkoutSchema.statics.rename = async function rename(kind, refId, name, client) {
  await this.updateMany({ kind, refId }, { $set: { name } }, opts(client));
};

// Deleting a routine also drops everyone's favorite of it
favoriteWorkoutSchema.statics.removeAllFor = async function removeAllFor(kind, refId, client) {
  await this.deleteMany({ kind, refId }, opts(client));
};

module.exports = mongoose.model('FavoriteWorkout', favoriteWorkoutSchema);