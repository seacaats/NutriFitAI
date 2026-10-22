const { mongoose } = require('../../../config/mongo');

const { Schema } = mongoose;

// wger exercise categories populated by scripts/sync-workouts.js
const workoutCategorySchema = new Schema(
  {
    _id: { type: Number },
    name: { type: String, required: true },
    syncedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workout_categories', _id: false },
);

module.exports = mongoose.model('WorkoutCategory', workoutCategorySchema);
