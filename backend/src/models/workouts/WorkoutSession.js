const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');
const { dayRangeToInstants } = require('../../utils/calendarDay');

const { Schema } = mongoose;

// Logged and planned workout sessions.
// Logged sessions are written once on completion (partial runs are saved with status "skipped").
const workoutSessionSchema = new Schema(
  {
    userId: USER_REF,
    kind: { type: String, enum: ['routine', 'exercise'], required: true },

    routineId: { type: Schema.Types.ObjectId, ref: 'WorkoutRoutine', default: null },
    exerciseRef: { type: Number, default: null },
    exerciseName: { type: String, maxlength: 150, default: null },
    routineName: { type: String, maxlength: 150, default: null },

    targetSets: { type: Number, default: null },
    targetReps: { type: Number, default: null },
    completedSets: { type: Number, default: 0, min: 0 },

    scheduledFor: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['planned', 'active', 'completed', 'skipped'],
      default: 'planned',
      required: true,
    },
    actualDurationSeconds: { type: Number, default: null },
    origin: { type: String, enum: ['scheduled', 'direct'], default: 'direct', required: true },

    // Snapshot of routine exercises and per-exercise results (kind "routine" only)
    exercises: {
      type: [
        new Schema(
          {
            exerciseRef: { type: Number, required: true },
            exerciseName: { type: String, required: true, maxlength: 150 },
            position: { type: Number, required: true },
            targetSets: { type: Number, default: null },
            targetReps: { type: Number, default: null },
            completedSets: { type: Number, default: 0, min: 0 },
            done: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
  },
  { versionKey: false, collection: 'workout_sessions' },
);

// Enforce mutually exclusive routine vs. single-exercise fields
workoutSessionSchema.pre('validate', function enforceSessionKind() {
  if (this.kind === 'routine') {
    if (!this.routineId) throw new Error('kind "routine" requires routineId');
    if (this.exerciseRef != null) throw new Error('kind "routine" must not set exerciseRef');
  } else if (this.kind === 'exercise') {
    if (this.exerciseRef == null) throw new Error('kind "exercise" requires exerciseRef');
    if (this.routineId) throw new Error('kind "exercise" must not set routineId');
    if (this.exercises?.length) throw new Error('kind "exercise" must not set exercises');
  }
});

// 24h window during which a missed planned session can still be started or rescheduled
const GRACE_MS = 24 * 60 * 60 * 1000;

const PROJECTION =
  'kind exerciseRef exerciseName routineId routineName targetSets targetReps completedSets ' +
  'scheduledFor startedAt completedAt status actualDurationSeconds origin exercises';

workoutSessionSchema.statics.deriveStatus = function deriveStatus(completedSets, targetSets) {
  return completedSets >= targetSets && targetSets > 0 ? 'completed' : 'skipped';
};

// Merge routine exercises with per-position completion results
workoutSessionSchema.statics.snapshotExercises = function snapshotExercises(exercises, results = []) {
  const byPosition = new Map(results.map((r) => [r.position, r]));
  return [...(exercises || [])]
    .sort((a, b) => a.position - b.position)
    .map((e, i) => {
      const r = byPosition.get(e.position ?? i) || {};
      return {
        exerciseRef: e.exerciseRef,
        exerciseName: e.exerciseName,
        position: e.position ?? i,
        targetSets: e.targetSets ?? null,
        targetReps: e.targetReps ?? null,
        completedSets: Number(r.completedSets) || 0,
        done: Boolean(r.done),
      };
    });
};

function resultFields(model, input) {
  const completedSets = Number(input.completedSets) || 0;
  const targetSets = Number(input.targetSets) || 0;
  return {
    targetSets,
    completedSets,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
    actualDurationSeconds: Number(input.actualDurationSeconds) || null,
    status: model.deriveStatus(completedSets, targetSets),
  };
}

// ---- Logging ----------------------------------------------------------------

workoutSessionSchema.statics.createExerciseSession = async function createExerciseSession(input, client) {
  const [doc] = await this.create(
    [
      {
        userId: input.userId,
        kind: 'exercise',
        exerciseRef: input.exerciseRef,
        exerciseName: input.exerciseName ?? null,
        targetReps: Number(input.targetReps) || 0,
        origin: 'direct',
        ...resultFields(this, input),
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

workoutSessionSchema.statics.createRoutineSession = async function createRoutineSession(input, client) {
  const [doc] = await this.create(
    [
      {
        userId: input.userId,
        kind: 'routine',
        routineId: input.routineId,
        routineName: input.routineName,
        targetReps: null,
        origin: 'direct',
        exercises: input.exercises,
        ...resultFields(this, input),
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

// ---- History ----------------------------------------------------------------

workoutSessionSchema.statics.findRange = async function findRange(input, client) {
  const { start, end } = dayRangeToInstants(input.from, input.to, input.timeZone);

  const rows = await this.find(
    { userId: input.userId, completedAt: { $gte: start, $lt: end } },
    PROJECTION,
    opts(client),
  )
    .sort({ completedAt: -1 })
    .limit(input.limit || 100)
    .lean();
  return rows.map(withId);
};

workoutSessionSchema.statics.summariseRange = async function summariseRange(input, client) {
  const { start, end } = dayRangeToInstants(input.from, input.to, input.timeZone);

  const [row] = await this.aggregate([
    { $match: { userId: input.userId, completedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalSets: { $sum: '$completedSets' },
        totalSeconds: { $sum: { $ifNull: ['$actualDurationSeconds', 0] } },
      },
    },
  ]).session(opts(client).session || null);

  return row
    ? { total: row.total, completed: row.completed, totalSets: row.totalSets, totalSeconds: row.totalSeconds }
    : { total: 0, completed: 0, totalSets: 0, totalSeconds: 0 };
};

// Session counts per local calendar day ({ "YYYY-MM-DD": { logged, completed } })
workoutSessionSchema.statics.dailyCounts = async function dailyCounts(userId, start, end, timeZone, client) {
  const rows = await this.aggregate([
    { $match: { userId, completedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: timeZone || 'UTC' } },
        logged: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      },
    },
  ]).session(opts(client).session || null);

  return rows.reduce((acc, r) => ({ ...acc, [r._id]: { logged: r.logged, completed: r.completed } }), {});
};

workoutSessionSchema.statics.findRecent = async function findRecent(
  userId,
  { limit = 5, offset = 0, since = null } = {},
  client,
) {
  const filter = { userId, completedAt: since ? { $gte: since } : { $ne: null } };

  const [rows, total] = await Promise.all([
    this.find(filter, PROJECTION, opts(client))
      .sort({ completedAt: -1 })
      .skip(Math.max(0, offset))
      .limit(Math.min(limit, 50))
      .lean(),
    this.countDocuments(filter, opts(client)),
  ]);
  return { sessions: rows.map(withId), total };
};

workoutSessionSchema.statics.findRecentForExercise = async function findRecentForExercise(
  userId,
  exerciseRef,
  limit = 5,
  client,
) {
  const rows = await this.find(
    { userId, kind: 'exercise', exerciseRef, status: 'completed' },
    PROJECTION,
    opts(client),
  )
    .sort({ completedAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
  return rows.map(withId);
};

workoutSessionSchema.statics.findLatest = async function findLatest(userId, client) {
  return withId(
    await this.findOne({ userId, completedAt: { $ne: null } }, PROJECTION, opts(client))
      .sort({ completedAt: -1 })
      .lean(),
  );
};

// ---- Scheduling -------------------------------------------------------------

workoutSessionSchema.statics.createPlanned = async function createPlanned(input, client) {
  const [doc] = await this.create(
    [
      {
        userId: input.userId,
        kind: input.kind,
        routineId: input.kind === 'routine' ? input.routineId : null,
        routineName: input.kind === 'routine' ? input.routineName : null,
        exerciseRef: input.kind === 'exercise' ? input.exerciseRef : null,
        exerciseName: input.kind === 'exercise' ? input.exerciseName : null,
        targetSets: input.targetSets ?? null,
        targetReps: input.targetReps ?? null,
        scheduledFor: input.scheduledFor,
        status: 'planned',
        origin: 'scheduled',
        exercises: input.kind === 'routine' ? input.exercises : undefined,
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

// Upcoming planned sessions, including missed sessions within the 24h grace period
workoutSessionSchema.statics.listUpcoming = async function listUpcoming(userId, { until }, client) {
  const rows = await this.find(
    { userId, status: 'planned', scheduledFor: { $gte: new Date(Date.now() - GRACE_MS), $lte: until } },
    PROJECTION,
    opts(client),
  )
    .sort({ scheduledFor: 1 })
    .limit(100)
    .lean();
  return rows.map(withId);
};

workoutSessionSchema.statics.startingBetween = async function startingBetween(from, to, client) {
  return this.find({ status: 'planned', scheduledFor: { $gte: from, $lt: to } }, 'userId scheduledFor', opts(client)).lean();
};

workoutSessionSchema.statics.findPlanned = async function findPlanned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(
    await this.findOne({ _id: id, userId, status: 'planned' }, PROJECTION, opts(client)).lean(),
  );
};

workoutSessionSchema.statics.reschedulePlanned = async function reschedulePlanned(id, userId, scheduledFor, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(
    await this.findOneAndUpdate(
      { _id: id, userId, status: 'planned' },
      { $set: { scheduledFor } },
      { new: true, projection: PROJECTION, ...opts(client) },
    ).lean(),
  );
};

workoutSessionSchema.statics.removeLogged = async function removeLogged(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { deletedCount } = await this.deleteOne(
    { _id: id, userId, status: { $ne: 'planned' }, completedAt: { $ne: null } },
    opts(client),
  );
  return deletedCount > 0;
};

workoutSessionSchema.statics.removeLoggedOnDay = async function removeLoggedOnDay(userId, day, timeZone, client) {
  const { start, end } = dayRangeToInstants(day, day, timeZone);
  const { deletedCount } = await this.deleteMany(
    { userId, status: { $ne: 'planned' }, completedAt: { $gte: start, $lt: end } },
    opts(client),
  );
  return deletedCount;
};

workoutSessionSchema.statics.removePlanned = async function removePlanned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await this.deleteOne({ _id: id, userId, status: 'planned' }, opts(client));
  return result.deletedCount > 0;
};

workoutSessionSchema.statics.removePlannedForRoutine = async function removePlannedForRoutine(
  routineId,
  userId,
  client,
) {
  if (!mongoose.isValidObjectId(routineId)) return;
  await this.deleteMany({ routineId, userId, status: 'planned' }, opts(client));
};

workoutSessionSchema.statics.renameExercise = async function renameExercise(userId, exerciseRef, exerciseName, client) {
  await this.updateMany(
    { userId, kind: 'exercise', exerciseRef },
    { $set: { exerciseName } },
    opts(client),
  );
  await this.updateMany(
    { userId, kind: 'routine', 'exercises.exerciseRef': exerciseRef },
    { $set: { 'exercises.$[e].exerciseName': exerciseName } },
    { arrayFilters: [{ 'e.exerciseRef': exerciseRef }], ...opts(client) },
  );
};

// Remove a deleted exercise from sessions, recalculating routine session totals or deleting empty ones
workoutSessionSchema.statics.removeExercise = async function removeExercise(userId, exerciseRef, client) {
  await this.deleteMany({ userId, kind: 'exercise', exerciseRef }, opts(client));

  const sessions = await this.find(
    { userId, kind: 'routine', 'exercises.exerciseRef': exerciseRef },
    'exercises targetSets status',
    opts(client),
  ).lean();
  for (const s of sessions) {
    const left = s.exercises.filter((e) => e.exerciseRef !== exerciseRef);
    if (!left.length) {
      await this.deleteOne({ _id: s._id }, opts(client));
      continue;
    }
    const completedSets = left.filter((e) => e.done).length;
    const $set = { exercises: left, completedSets };
    if (s.targetSets != null) $set.targetSets = left.length;
    if (s.status === 'completed' || s.status === 'skipped') {
      $set.status = this.deriveStatus(completedSets, left.length);
    }
    await this.updateOne({ _id: s._id }, { $set }, opts(client));
  }
};

// Convert a planned session into a logged session in place
workoutSessionSchema.statics.completePlanned = async function completePlanned(
  id,
  userId,
  kind,
  result,
  client,
) {
  if (!mongoose.isValidObjectId(id)) return null;

  return withId(
    await this.findOneAndUpdate(
      { _id: id, userId, kind, status: 'planned' },
      {
        $set: {
          ...resultFields(this, result),
          targetReps: result.targetReps != null ? Number(result.targetReps) : null,
          ...(kind === 'routine' && result.exercises ? { exercises: result.exercises } : {}),
        },
      },
      { new: true, projection: PROJECTION, ...opts(client) },
    ).lean(),
  );
};

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
