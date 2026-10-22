const { mongoose, opts } = require('../../../config/mongo');

const { Schema } = mongoose;

const USER_ID_BASE = 1000000;

// Exercise catalog combining synced wger exercises and user-created workouts.
// Uses numeric _id (wger IDs or USER_ID_BASE+ for user workouts).
const workoutSchema = new Schema(
  {
    _id: { type: Number },
    name: { type: String, required: true },
    description: { type: String, default: null },
    category: { id: Number, name: String },

    translations: { type: Array, default: [] },

    muscles: { type: Array, default: [] },
    musclesSecondary: { type: Array, default: [] },
    equipment: { type: Array, default: [] },

    images: { type: [String], default: [] },
    hasRealImage: { type: Boolean, default: false },

    // 'wger' = synced catalog, 'user' = private to createdBy
    source: { type: String, enum: ['wger', 'user'], default: 'wger' },
    createdBy: { type: String, default: null },
    imageKey: { type: String, default: null },
    createdAt: { type: Date },
    syncedAt: { type: Date },
  },
  { versionKey: false, collection: 'workouts', _id: false },
);

// Allocate the next user workout ID, retrying on concurrent duplicate-key collisions
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

workoutSchema.statics.updateOwned = function updateOwned(id, userId, $set, client) {
  return this.findOneAndUpdate(
    { _id: id, source: 'user', createdBy: userId },
    { $set },
    { new: true, runValidators: true, ...opts(client) },
  ).lean();
};

workoutSchema.statics.removeOwned = function removeOwned(id, userId, client) {
  return this.findOneAndDelete({ _id: id, source: 'user', createdBy: userId }, opts(client)).lean();
};

// Visibility filter: public wger catalog plus the user's own workouts
workoutSchema.statics.visibleTo = function visibleTo(userId) {
  return { $or: [{ source: 'wger' }, { createdBy: userId }] };
};

module.exports = mongoose.model('Workout', workoutSchema);
