const { mongoose, opts } = require('../../../config/mongo');
const { withId } = require('../shared');

const { Schema } = mongoose;

const workoutRoutineSchema = new Schema(
  {
    // Who built it. null = a built-in routine every user can see
    ownerId: { type: String, ref: 'User', default: null },
    title: { type: String, required: true, maxlength: 150 },
    description: { type: String, default: null },
    estimatedDurationMinutes: { type: Number, default: null },

    exercises: {
      type: [
        new Schema(
          {
            exerciseRef: { type: Number, required: true }, // wger id = workouts._id
            // Denormalised cache. It avoids a $lookup on every
            // routine render, the same way it avoided a cross-database call
            // in the hybrid design
            exerciseName: { type: String, required: true, maxlength: 150 },
            position: { type: Number, required: true },
            // Per-exercise targets the routine player starts the tracker with
            targetSets: { type: Number, min: 1, max: 20, default: 3 },
            targetReps: { type: Number, min: 1, max: 200, default: 10 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workout_routines' },
);

// Indexes are created by migrations 002, not declared here

const MAX_ROUTINES_LISTED = 100;

// Built-in = no owner. Read-only to everyone through the API
workoutRoutineSchema.statics.isBuiltIn = function isBuiltIn(routine) {
  return Boolean(routine) && !routine.ownerId;
};

// Routines also say whether they are built-in, for the client
function shape(doc) {
  const routine = withId(doc);
  return routine ? { ...routine, builtIn: !routine.ownerId } : null;
}

// Positions follow the array order the client sent, so reordering is just
// sending the list in the new order
function normaliseExercises(exercises) {
  return exercises.map((e, i) => ({
    exerciseRef: e.exerciseRef,
    exerciseName: e.exerciseName,
    position: i,
    targetSets: e.targetSets,
    targetReps: e.targetReps,
  }));
}

// The user's own routines plus built-ins, newest first
workoutRoutineSchema.statics.listVisible = async function listVisible(userId, client) {
  const rows = await this.find({ ownerId: { $in: [userId, null] } }, null, opts(client))
    .sort({ updatedAt: -1 })
    .limit(MAX_ROUTINES_LISTED)
    .lean();
  return rows.map(shape);
};

// Readable if built-in or owned. Returns null otherwise (treated as not found)
workoutRoutineSchema.statics.findVisible = async function findVisible(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return shape(
    await this.findOne({ _id: id, ownerId: { $in: [userId, null] } }, null, opts(client)).lean(),
  );
};

workoutRoutineSchema.statics.createOwned = async function createOwned(userId, input, client) {
  const [doc] = await this.create(
    [
      {
        ownerId: userId,
        title: input.title,
        description: input.description ?? null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        exercises: normaliseExercises(input.exercises),
      },
    ],
    opts(client),
  );
  return shape(doc.toObject());
};

// Owner-only, the filter itself keeps built-ins out of reach
workoutRoutineSchema.statics.updateOwned = async function updateOwned(id, userId, input, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  const $set = { updatedAt: new Date() };
  if (input.title !== undefined) $set.title = input.title;
  if (input.description !== undefined) $set.description = input.description;
  if (input.estimatedDurationMinutes !== undefined) {
    $set.estimatedDurationMinutes = input.estimatedDurationMinutes;
  }
  if (input.exercises !== undefined) $set.exercises = normaliseExercises(input.exercises);

  return shape(
    await this.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $set },
      { new: true, runValidators: true, ...opts(client) },
    ).lean(),
  );
};

workoutRoutineSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await this.deleteOne({ _id: id, ownerId: userId }, opts(client));
  return result.deletedCount > 0;
};

// A deleted workout comes out of the owner's routines. A routine it was the
// only exercise of is deleted, and its id returned so the caller can clear
// what hung off it
workoutRoutineSchema.statics.removeExercise = async function removeExercise(userId, exerciseRef, client) {
  const routines = await this.find({ ownerId: userId, 'exercises.exerciseRef': exerciseRef }, null, opts(client)).lean();
  const emptied = [];
  for (const routine of routines) {
    const left = routine.exercises.filter((e) => e.exerciseRef !== exerciseRef);
    if (left.length) {
      await this.updateOne(
        { _id: routine._id },
        { $set: { exercises: normaliseExercises(left), updatedAt: new Date() } },
        opts(client),
      );
    } else {
      await this.deleteOne({ _id: routine._id }, opts(client));
      emptied.push(String(routine._id));
    }
  }
  return emptied;
};

module.exports = mongoose.model('WorkoutRoutine', workoutRoutineSchema);