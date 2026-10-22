const { mongoose, opts } = require('../../../config/mongo');
const { withId } = require('../shared');

const { Schema } = mongoose;

const workoutRoutineSchema = new Schema(
  {
    // Null for built-in routines visible to all users
    ownerId: { type: String, ref: 'User', default: null },
    title: { type: String, required: true, maxlength: 150 },
    description: { type: String, default: null },
    estimatedDurationMinutes: { type: Number, default: null },

    exercises: {
      type: [
        new Schema(
          {
            exerciseRef: { type: Number, required: true },
            exerciseName: { type: String, required: true, maxlength: 150 },
            position: { type: Number, required: true },
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

const MAX_ROUTINES_LISTED = 100;

workoutRoutineSchema.statics.isBuiltIn = function isBuiltIn(routine) {
  return Boolean(routine) && !routine.ownerId;
};

function shape(doc) {
  const routine = withId(doc);
  return routine ? { ...routine, builtIn: !routine.ownerId } : null;
}

function normaliseExercises(exercises) {
  return exercises.map((e, i) => ({
    exerciseRef: e.exerciseRef,
    exerciseName: e.exerciseName,
    position: i,
    targetSets: e.targetSets,
    targetReps: e.targetReps,
  }));
}

workoutRoutineSchema.statics.listVisible = async function listVisible(userId, client) {
  const rows = await this.find({ ownerId: { $in: [userId, null] } }, null, opts(client))
    .sort({ updatedAt: -1 })
    .limit(MAX_ROUTINES_LISTED)
    .lean();
  return rows.map(shape);
};

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

workoutRoutineSchema.statics.renameExercise = async function renameExercise(userId, exerciseRef, exerciseName, client) {
  await this.updateMany(
    { ownerId: userId, 'exercises.exerciseRef': exerciseRef },
    { $set: { 'exercises.$[e].exerciseName': exerciseName, updatedAt: new Date() } },
    { arrayFilters: [{ 'e.exerciseRef': exerciseRef }], ...opts(client) },
  );
};

// Remove a deleted exercise from the user's routines; delete routines left empty and return their IDs
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
