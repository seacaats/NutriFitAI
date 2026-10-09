const { mongoose } = require('../../../config/mongo');

const { Schema } = mongoose;

// wger categories, filled by scripts/sync-workouts.js alongside the catalog
const workoutCategorySchema = new Schema(
  {
    _id: { type: Number }, // wger category id
    name: { type: String, required: true },
    syncedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workout_categories', _id: false },
);

module.exports = mongoose.model('WorkoutCategory', workoutCategorySchema);