const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');
const { dayRangeToInstants } = require('../../utils/calendarDay');

const { Schema } = mongoose;

// Logged and planned workout sessions.
//
// Logged ones are one write at the end, no create-on-start: per-set writes
// spend the ops budget on nothing, and the tracker has no resume, so a
// session opened on Start would sit in "active" forever. Partials are still
// stored (status "skipped", true completedSets) so weekly counts don't lie
const workoutSessionSchema = new Schema(
  {
    userId: USER_REF,

    // A session is either a single exercise or based on pre-built routine
    // This discriminator key (NOT Mongoose) is used then as an explicit field
    // of inferring the session rather than basing on what was empty and what wasn't
    kind: { type: String, enum: ['routine', 'exercise'], required: true },

    routineId: { type: Schema.Types.ObjectId, ref: 'WorkoutRoutine', default: null },
    exerciseRef: { type: Number, default: null },
    exerciseName: { type: String, maxlength: 150, default: null },
    // Snapshot of the routine title for kind "routine", like exerciseName
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

    // Whether it came from a plan or was started on the spot. scheduledFor
    // still says WHEN it was planned; this says whether it was at all
    origin: { type: String, enum: ['scheduled', 'direct'], default: 'direct', required: true },

    // kind "routine" only: the routine's exercises as they were when it was
    // scheduled or run, with how each went. A copy, so editing or deleting
    // the routine later doesn't rewrite history. Top-level exerciseRef and
    // exerciseName stay null for routines, the entries here hold them
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

// Enforces having the session kind as explained above:
// "must have either routine or an exercise, not both/neither"
// which findOneAndUpdate deliberately skips. completePlanned only
// touches result fields, never kind/routineId/exerciseRef, so it's safe
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

// Indexes are created by migrations/001_nutrifitai.js, not declared here

// ===========================================================================

// How long a missed plan can still be started late or rescheduled. After
// that the planned-session TTL index (migration 001) removes it
const GRACE_MS = 24 * 60 * 60 * 1000;

// Excludes userId; everything here is rendered
const PROJECTION =
  'kind exerciseRef exerciseName routineId routineName targetSets targetReps completedSets ' +
  'scheduledFor startedAt completedAt status actualDurationSeconds origin exercises';

// Server decides what a result means, not the client: "completed" only
// when every target set was finished, anything less is "skipped"
workoutSessionSchema.statics.deriveStatus = function deriveStatus(completedSets, targetSets) {
  return completedSets >= targetSets && targetSets > 0 ? 'completed' : 'skipped';
};

// Routine exercises -> session entries, merged with the player's results
// by position. Totals follow from the entries: sets = exercises, done = finished
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

// The result fields every logged session shares, whichever way it's logged
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
        // routineId left unset, which the pre('validate') hook requires
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

// A routine run logged as one session: sets = exercises finished of total
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

// Sessions within an inclusive calendar-day range, newest first
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

// Counts and totals for the dashboard, aggregated in the database since
// the dashboard wants three numbers, not a list
workoutSessionSchema.statics.summariseRange = async function summariseRange(input, client) {
  const { start, end } = dayRangeToInstants(input.from, input.to, input.timeZone);

  const [row] = await this.aggregate([
    { $match: { userId: input.userId, completedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        // Partials counted separately, so the weekly goal measures
        // finished workouts while started ones stay visible
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalSets: { $sum: '$completedSets' },
        totalSeconds: { $sum: { $ifNull: ['$actualDurationSeconds', 0] } },
      },
    },
  ]).session(opts(client).session || null);

  // $group returns nothing when nothing matched, normalised to zeros
  return row
    ? { total: row.total, completed: row.completed, totalSets: row.totalSets, totalSeconds: row.totalSeconds }
    : { total: 0, completed: 0, totalSets: 0, totalSeconds: 0 };
};

// Sessions per calendar day in the user's timezone. `logged` counts every
// session, partials included, `completed` only finished ones (what goals use)
// { "2026-09-28": { logged: 2, completed: 1 } }
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

// Most recent sessions regardless of calendar, paged. Keyed on completedAt,
// which every logged session has (planned ones don't). `since` scopes it to
// a rolling window, the history screen passes 30 days back
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

// One exercise's completed history, newest first, for the "last performed"
// line. Abandoned partials aren't a reference point, so they're left out
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

// Most recent session, for the dashboard card
workoutSessionSchema.statics.findLatest = async function findLatest(userId, client) {
  return withId(
    await this.findOne({ userId, completedAt: { $ne: null } }, PROJECTION, opts(client))
      .sort({ completedAt: -1 })
      .lean(),
  );
};

// ---- Scheduling -------------------------------------------------------------

// A planned session: an exercise or a routine, at a set time
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

// Planned sessions, soonest first, including missed ones still inside the
// 24h grace period (the client shows those apart). The lower bound also
// hides expired plans in the up-to-60s before the TTL monitor deletes them
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

// Every user's planned sessions starting in [from, to), for the workout
// reminder (services/notifications/reminders.js). Across users, so it takes no userId
workoutSessionSchema.statics.startingBetween = async function startingBetween(from, to, client) {
  return this.find({ status: 'planned', scheduledFor: { $gte: from, $lt: to } }, 'userId scheduledFor', opts(client)).lean();
};

workoutSessionSchema.statics.findPlanned = async function findPlanned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(
    await this.findOne({ _id: id, userId, status: 'planned' }, PROJECTION, opts(client)).lean(),
  );
};

// Moves a planned (or missed, within grace) session to a new time. Resets
// the TTL clock too, since that runs off scheduledFor
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

// Logged sessions only (plans have their own remove). Owner-scoped filter
workoutSessionSchema.statics.removeLogged = async function removeLogged(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { deletedCount } = await this.deleteOne(
    { _id: id, userId, status: { $ne: 'planned' }, completedAt: { $ne: null } },
    opts(client),
  );
  return deletedCount > 0;
};

// Every logged session completed on one calendar day, in the user's timezone
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

// A deleted routine's future plans go with it; past runs stay in history
workoutSessionSchema.statics.removePlannedForRoutine = async function removePlannedForRoutine(
  routineId,
  userId,
  client,
) {
  if (!mongoose.isValidObjectId(routineId)) return;
  await this.deleteMany({ routineId, userId, status: 'planned' }, opts(client));
};

// Turns a planned row into the logged session, so starting a scheduled
// workout doesn't leave the plan behind as a duplicate
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
          // Routine results replace the planned snapshot entries
          ...(kind === 'routine' && result.exercises ? { exercises: result.exercises } : {}),
        },
      },
      { new: true, projection: PROJECTION, ...opts(client) },
    ).lean(),
  );
};

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);