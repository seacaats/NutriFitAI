const { mongoose } = require('../../../config/mongo');

const { Schema } = mongoose;

// wger exercise catalog, filled by scripts/sync-workouts.js. Read-only to
// the API, so workoutsController queries it natively (with .lean())

// _id is wger's own numeric exercise id, not ObjectId to maintain consistency
// with frontend code and other collections which already use it 
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

    syncedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workouts', _id: false },
);

// Indexes are created by migrations 001, not declared here

module.exports = mongoose.model('Workout', workoutSchema);