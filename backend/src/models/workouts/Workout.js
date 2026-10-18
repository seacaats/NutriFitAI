const { mongoose, opts } = require('../../../config/mongo');

const { Schema } = mongoose;

const USER_ID_BASE = 1000000;

// Exercise catalog: wger's, filled by scripts/sync-workouts.js, plus the
// workouts users add themselves. Same shape for both, told apart by `source`.
// the workouts controllers query it natively (with .lean())

// _id is wger's own numeric exercise id, not ObjectId to maintain consistency
// with frontend code and other collections which already use it. User
// workouts take ids from USER_ID_BASE up, clear of anything wger will issue
const workoutSchema = new Schema(
  {
    _id: { type: Number }, // wger exercise id
    name: { type: String, required: true },
    description: { type: String, default: null },
    category: { id: Number, name: String },

    // Only language 2 (English) is stored
    translations: { type: Array, default: [] },

    muscles: { type: Array, default: [] },
    musclesSecondary: { type: Array, default: [] },
    equipment: { type: Array, default: [] },

    // Pre-normalised by the sync job, only URLs are stored
    images: { type: [String], default: [] },

    // Precomputed so GET /api/workouts can filter server-side
    hasRealImage: { type: Boolean, default: false },

    // 'wger' = synced, 'user' = added by createdBy (users._id, null for wger).
    // User workouts are private to their creator
    source: { type: String, enum: ['wger', 'user'], default: 'wger' },
    createdBy: { type: String, default: null },
    // Storage key of the user's own photo (never a URL, the link is signed per read)
    imageKey: { type: String, default: null },
    createdAt: { type: Date },

    // Set by the sync only, so pruning never touches user workouts
    syncedAt: { type: Date },
  },
  { versionKey: false, collection: 'workouts', _id: false },
);

// Next free id in the user range. Two simultaneous creates can pick the same
// one, so the duplicate-key error is retried with a fresh pick
workoutSchema.statics.createForUser = async function createForUser(userId, fields) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const last = await this.findOne({ _id: { $gte: USER_ID_BASE } }, '_id').sort({ _id: -1 }).lean();
    try {
      const doc = await this.create({
        ...fields,
        _id: last ? last._id + 1 : USER_ID_BASE,
        source: 'user',
        createdBy: userId,
        createdAt: new Date(),
      });
      return doc.toObject();
    } catch (err) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
  return null;
};

// The user's own workout only, the filter itself keeps wger's out of reach.
// Returns what it removed (for its photo), or null
workoutSchema.statics.removeOwned = function removeOwned(id, userId, client) {
  return this.findOneAndDelete({ _id: id, source: 'user', createdBy: userId }, opts(client)).lean();
};

// What a user may see: the wger catalog and their own workouts, never
// someone else's. Used inside queries, so it can't be forgotten afterwards
workoutSchema.statics.visibleTo = function visibleTo(userId) {
  return { $or: [{ source: 'wger' }, { createdBy: userId }] };
};

// Indexes are created by migrations (001, 005), not declared here

module.exports = mongoose.model('Workout', workoutSchema);