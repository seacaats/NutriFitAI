const Workout = require('../../models/workouts/Workout');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const WorkoutRoutine = require('../../models/workouts/WorkoutRoutine');
const FavoriteWorkout = require('../../models/workouts/FavoriteWorkout');
const { asyncHandler, sendSuccess, ApiError } = require('../../utils/httpResponse');

// ===========================================================================
// Routines, favorites and scheduling
// ===========================================================================

// Scheduling window: from now up to 7 days ahead. A minute of slack in the
// past so a "now" picked on a slow phone isn't rejected
const SCHEDULE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const SCHEDULE_SLACK_MS = 60 * 1000;

async function findExercise(exerciseRef, userId) {
  return Workout.findOne({ _id: Number(exerciseRef), ...Workout.visibleTo(userId) }, 'name').lean();
}

async function requireRoutine(id, userId) {
  const routine = await WorkoutRoutine.findVisible(id, userId);
  if (!routine) throw ApiError.notFound('Routine not found');
  return routine;
}

// ---- Routines -------------------------------------------------------------

// GET /api/workouts/routines
const listRoutines = asyncHandler(async (req, res) => {
  const routines = await WorkoutRoutine.listVisible(req.userId);
  return sendSuccess(res, { data: { routines } });
});

// GET /api/workouts/routines/:id
const getRoutine = asyncHandler(async (req, res) => {
  const routine = await requireRoutine(req.params.id, req.userId);
  return sendSuccess(res, { data: routine });
});

// POST /api/workouts/routines
const createRoutine = asyncHandler(async (req, res) => {
  const routine = await WorkoutRoutine.createOwned(req.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Routine saved', data: routine });
});

// PATCH /api/workouts/routines/:id -- owner only; built-ins are read-only
const updateRoutine = asyncHandler(async (req, res) => {
  const routine = await WorkoutRoutine.updateOwned(req.params.id, req.userId, req.body);
  if (!routine) throw ApiError.notFound('Routine not found');

  // Keep favorite names in step with a renamed routine
  if (req.body.title) await FavoriteWorkout.rename('routine', routine.id, routine.title);

  return sendSuccess(res, { message: 'Routine updated', data: routine });
});

// DELETE /api/workouts/routines/:id -- also drops its favorites and plans
const deleteRoutine = asyncHandler(async (req, res) => {
  const removed = await WorkoutRoutine.removeOwned(req.params.id, req.userId);
  if (!removed) throw ApiError.notFound('Routine not found');

  await FavoriteWorkout.removeAllFor('routine', req.params.id);
  await WorkoutSession.removePlannedForRoutine(req.params.id, req.userId);

  return sendSuccess(res, { message: 'Routine deleted' });
});

// POST /api/workouts/routines/sessions -- one run of a routine
const logRoutineSession = asyncHandler(async (req, res) => {
  const { plannedId, exercises: results, ...result } = req.body;
  const routine = await requireRoutine(result.routineId, req.userId);

  // A plan keeps the exercises it was scheduled with, even if the routine
  // changed since. Plans made before snapshots existed fall back to the routine
  const planned = plannedId ? await WorkoutSession.findPlanned(plannedId, req.userId) : null;
  const source = planned?.exercises?.length ? planned.exercises : routine.exercises;
  if (results) {
    result.exercises = WorkoutSession.snapshotExercises(source, results);
    result.targetSets = result.exercises.length;
    result.completedSets = result.exercises.filter((e) => e.done).length;
  } else {
    result.exercises = WorkoutSession.snapshotExercises(source);
  }

  const session = plannedId
    ? await WorkoutSession.completePlanned(plannedId, req.userId, 'routine', result)
    : await WorkoutSession.createRoutineSession({
      userId: req.userId,
      routineName: routine.title,
      ...result,
    });

  if (!session) throw ApiError.notFound('Scheduled session not found');

  return sendSuccess(res, {
    statusCode: plannedId ? 200 : 201,
    message: session.status === 'completed' ? 'Routine logged' : 'Partial routine logged',
    data: session,
  });
});

// ---- Favorites --------------------------------------------------------------

// GET /api/workouts/favorites
const listFavorites = asyncHandler(async (req, res) => {
  const favorites = await FavoriteWorkout.list(req.userId);
  return sendSuccess(res, { data: { favorites } });
});

// PUT /api/workouts/favorites -- idempotent add
const addFavorite = asyncHandler(async (req, res) => {
  const { kind, refId } = req.body;
  let { name } = req.body;

  // The referenced item must exist (and a routine must be visible to this user)
  if (kind === 'routine') {
    name = (await requireRoutine(refId, req.userId)).title;
  } else {
    const exercise = await findExercise(refId, req.userId);
    if (!exercise) throw ApiError.notFound('Exercise not found');
    name = exercise.name || name;
  }

  const favorite = await FavoriteWorkout.add(req.userId, { kind, refId: String(refId), name });
  return sendSuccess(res, { message: 'Added to favorites', data: favorite });
});

// DELETE /api/workouts/favorites/:kind/:refId
const removeFavorite = asyncHandler(async (req, res) => {
  await FavoriteWorkout.drop(req.userId, req.params.kind, req.params.refId);
  // Removing something that isn't a favorite is still the end state the client wants
  return sendSuccess(res, { message: 'Removed from favorites' });
});

// ---- Scheduling -------------------------------------------------------------

// GET /api/workouts/schedule -- planned sessions for the next 7 days
const listSchedule = asyncHandler(async (req, res) => {
  const until = new Date(Date.now() + SCHEDULE_AHEAD_MS);
  const sessions = await WorkoutSession.listUpcoming(req.userId, { until });
  return sendSuccess(res, { data: { sessions } });
});

// POST /api/workouts/schedule
const createSchedule = asyncHandler(async (req, res) => {
  const { kind, scheduledFor } = req.body;
  const at = scheduledFor.getTime();
  const now = Date.now();

  if (at < now - SCHEDULE_SLACK_MS || at > now + SCHEDULE_AHEAD_MS) {
    throw ApiError.badRequest('Workouts can only be scheduled within the next 7 days.', {
      code: 'OUT_OF_WINDOW',
    });
  }

  const planned = { userId: req.userId, kind, scheduledFor };

  if (kind === 'routine') {
    const routine = await requireRoutine(req.body.routineId, req.userId);
    Object.assign(planned, {
      routineId: routine.id,
      routineName: routine.title,
      // A routine's "sets" are its exercises, same as a routine run
      targetSets: routine.exercises.length,
      exercises: WorkoutSession.snapshotExercises(routine.exercises),
    });
  } else {
    const exercise = await findExercise(req.body.exerciseRef, req.userId);
    if (!exercise) throw ApiError.notFound('Exercise not found');
    Object.assign(planned, {
      exerciseRef: Number(req.body.exerciseRef),
      exerciseName: exercise.name || req.body.exerciseName,
      targetSets: req.body.targetSets ?? 3,
      targetReps: req.body.targetReps ?? 10,
    });
  }

  const session = await WorkoutSession.createPlanned(planned);
  return sendSuccess(res, { statusCode: 201, message: 'Workout scheduled', data: session });
});

// PATCH /api/workouts/schedule/:id -- new time for a planned or missed session,
// same 7-day window as scheduling it
const reschedule = asyncHandler(async (req, res) => {
  const at = req.body.scheduledFor.getTime();
  const now = Date.now();
  if (at < now - SCHEDULE_SLACK_MS || at > now + SCHEDULE_AHEAD_MS) {
    throw ApiError.badRequest('Workouts can only be scheduled within the next 7 days.', {
      code: 'OUT_OF_WINDOW',
    });
  }

  const session = await WorkoutSession.reschedulePlanned(req.params.id, req.userId, req.body.scheduledFor);
  if (!session) throw ApiError.notFound('Scheduled session not found');
  return sendSuccess(res, { message: 'Workout rescheduled', data: session });
});

// DELETE /api/workouts/schedule/:id
const removeSchedule = asyncHandler(async (req, res) => {
  const removed = await WorkoutSession.removePlanned(req.params.id, req.userId);
  if (!removed) throw ApiError.notFound('Scheduled session not found');
  return sendSuccess(res, { message: 'Removed from schedule' });
});

module.exports = {
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  logRoutineSession,
  listFavorites,
  addFavorite,
  removeFavorite,
  listSchedule,
  createSchedule,
  reschedule,
  removeSchedule,
};