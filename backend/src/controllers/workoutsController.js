const Workout = require('../models/workouts/Workout');
const WorkoutCategory = require('../models/workouts/WorkoutCategory');
const WorkoutSession = require('../models/workouts/WorkoutSession');
const WorkoutRoutine = require('../models/workouts/WorkoutRoutine');
const FavoriteWorkout = require('../models/workouts/FavoriteWorkout');
const User = require('../models/user/User');
const { asyncHandler, sendSuccess, ApiError } = require('../utils/httpResponse');
const { today } = require('../utils/calendarDay');

// ===========================================================================
// CATALOG -- read-only, served from the locally synced wger data
// ===========================================================================

/**
 * Serves the locally synced wger catalog.
 *
 * Read-only: the only writer is scripts/sync-workouts.js. Nothing here creates
 * or edits an exercise, so there is no ownership to check and no transaction to
 * wrap — but the endpoints still sit behind requireAuth, because an open,
 * unauthenticated list endpoint is free bandwidth for anyone who finds it.
 */

/** 60 is generous for a grid; the cap stops a client asking for the lot. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;

/** Fields the client actually renders. Excludes syncedAt and secondary muscles. */
const LIST_PROJECTION = 'name description category muscles equipment images hasRealImage';

function parseLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/**
 * GET /api/workouts
 *
 * Query: category, search, hasImage, equipment, ids, limit, offset, shuffle
 */
const listWorkouts = asyncHandler(async (req, res) => {
  const { category, search, hasImage, equipment, ids, shuffle } = req.query;
  const limit = parseLimit(req.query.limit);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const filter = {};

  if (category) {
    const categoryId = parseInt(category, 10);
    if (!Number.isFinite(categoryId)) {
      throw ApiError.badRequest('category must be a numeric id');
    }
    filter['category.id'] = categoryId;
  }

  /**
   * Defaults to true, which is what the UI has always actually wanted.
   *
   * The screen used to page through wger over the network until it had
   * collected enough exercises with pictures. That loop existed because the
   * upstream API could not answer this question; the synced `hasRealImage`
   * flag can, from an index. Pass hasImage=false to include the rest.
   */
  if (hasImage !== 'false') {
    filter.hasRealImage = true;
  }

  if (ids) filter._id = { $in: ids.split(',').map(Number) };

  // "none" = bodyweight: no equipment listed, or wger's own "none" entry.
  // "any" = needs something. A number = that piece of equipment
  if (equipment === 'none') {
    filter.$or = [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }];
  } else if (equipment === 'any') {
    filter.equipment = { $elemMatch: { name: { $not: NO_EQUIPMENT } } };
  } else if (equipment) {
    filter['equipment.id'] = Number(equipment);
  }

  // Browse: shuffled, within any category or equipment filter. Unfiltered, the
  // user's preferred exercises come first. A search or an id list keeps its own order
  if (shuffle && !search && !ids) {
    const data = await listShuffled(req.userId, Number(shuffle), filter, !category && !equipment, limit, offset);
    return sendSuccess(res, { data });
  }

  let query;
  let total;

  if (search && search.trim()) {
    /**
     * Text search over name, muscle names and category, weighted toward the
     * name (see the index definition in models/health/Workout.js).
     *
     * Ordered by relevance rather than by name: a query for "bench" should put
     * "Bench Press" above "Incline Dumbbell Bench Fly".
     *
     * NOTE ON THE SORT: the free tier caps in-memory sorts at 32 MB and ignores
     * allowDiskUse, so an uncovered sort FAILS rather than running slowly. A
     * textScore sort is computed during the text-index scan and is safe at this
     * collection size, but if a category filter is ever combined with a large
     * result set and this starts erroring, narrow the match before sorting
     * rather than adding indexes that cost storage.
     */
    filter.$text = { $search: search.trim() };

    query = Workout.find(filter, { score: { $meta: 'textScore' }, ...projectionObject() })
      .sort({ score: { $meta: 'textScore' } });
  } else {
    // Stable alphabetical order. Without an explicit sort the driver returns
    // natural order, which shifts as documents are updated — so page 2 could
    // repeat an item from page 1 after a sync.
    query = Workout.find(filter, LIST_PROJECTION).collation({ locale: 'en', strength: 1 }).sort({ name: 1 });
  }

  const [items, count] = await Promise.all([
    query.skip(offset).limit(limit).lean(),
    Workout.countDocuments(filter),
  ]);
  total = count;

  return sendSuccess(res, {
    data: {
      items: items.map(shapeWorkout),
      total,
      limit,
      offset,
      // Mirrors what the client used to get from wger's own pagination, so the
      // infinite-scroll logic in the screens does not have to change shape.
      hasMore: offset + items.length < total,
    },
  });
});

/** Projection as an object, for the branch that also projects textScore. */
function projectionObject() {
  return LIST_PROJECTION.split(' ').reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
}

/**
 * The client treats `id` as canonical everywhere; _id here is wger's numeric id
 * rather than an ObjectId, so this is a rename, not a conversion.
 */
function shapeWorkout(doc) {
  if (!doc) return null;
  const { _id, score, ...rest } = doc;
  return { id: _id, ...rest };
}

// Shuffled orders the client picks from at random. Few on purpose: each one
// is its own URL in the phone's offline cache
const SHUFFLE_VARIANTS = 8;
// A prime above any wger id. (id * multiplier) mod it is a different
// scramble per multiplier, and the same one every time, so paging is stable
const SHUFFLE_MODULUS = 1000003;

// The user's workoutPrefs as a catalog filter, or null when they have none
function preferenceFilter(prefs) {
  const filter = {};
  if (prefs?.categoryIds?.length) filter['category.id'] = { $in: prefs.categoryIds };
  if (prefs?.equipment === 'none') {
    filter.$or = [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }];
  } else if (prefs?.equipment === 'any') {
    filter.equipment = prefs.equipmentIds?.length
      ? { $elemMatch: { id: { $in: prefs.equipmentIds } } }
      : { $elemMatch: { name: { $not: NO_EQUIPMENT } } };
  }
  return Object.keys(filter).length ? filter : null;
}

// One shuffled page of `filter`: the same order every time for a given
// multiplier, so paging never repeats or skips an exercise
function shuffledPage(filter, multiplier, skip, limit) {
  if (limit <= 0) return [];
  return Workout.aggregate([
    { $match: filter },
    { $project: projectionObject() },
    { $addFields: { shuffleKey: { $mod: [{ $multiply: ['$_id', multiplier] }, SHUFFLE_MODULUS] } } },
    // $sort + $skip + $limit run as one top-k sort, well under the 32 MB cap
    { $sort: { shuffleKey: 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { shuffleKey: 0 } },
  ]);
}

/**
 * One page of the Browse list: `base` (the catalog, or a category/equipment
 * filter of it), shuffled. Unfiltered with workout preferences, matching
 * exercises come first and everything else after; preferences order the
 * list, they never hide anything. `suggested` is true only then, for the
 * "Picked for you" title
 */
async function listShuffled(userId, shuffle, base, usePrefs, limit, offset) {
  const profile = usePrefs ? await User.getProfile(userId) : null;
  const preferred = preferenceFilter(profile?.workoutPrefs);
  const matching = preferred ? { ...base, ...preferred } : null;
  const rest = preferred ? { ...base, $nor: [preferred] } : base;

  const [matchCount, restCount] = await Promise.all([
    matching ? Workout.countDocuments(matching) : 0,
    Workout.countDocuments(rest),
  ]);

  // Preferred exercises fill the first pages; a page that runs past them
  // continues straight into the rest
  const multiplier = 7919 * Math.min(Math.max(shuffle, 1), SHUFFLE_VARIANTS) + 104729;
  const fromMatching = matching
    ? await shuffledPage(matching, multiplier, offset, Math.min(limit, matchCount - offset))
    : [];
  const fromRest = await shuffledPage(rest, multiplier, Math.max(0, offset - matchCount), limit - fromMatching.length);
  const items = [...fromMatching, ...fromRest];
  const total = matchCount + restCount;

  return {
    items: items.map(shapeWorkout),
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
    suggested: matchCount > 0,
  };
}

/** GET /api/workouts/:id */
const getWorkout = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    throw ApiError.badRequest('Invalid exercise id');
  }

  const doc = await Workout.findById(id).lean();
  if (!doc) {
    throw ApiError.notFound('Exercise not found');
  }

  return sendSuccess(res, { data: shapeWorkout(doc) });
});

// wger lists bodyweight exercises under an equipment entry named "none (...)"
const NO_EQUIPMENT = /^none/i;

// GET /api/workouts/equipment -- every piece of equipment the catalog uses,
// for the filter. Bodyweight is its own option, so "none" is left out
const listEquipment = asyncHandler(async (req, res) => {
  const rows = await Workout.aggregate([
    { $unwind: '$equipment' },
    { $match: { 'equipment.name': { $not: NO_EQUIPMENT } } },
    { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
    { $sort: { name: 1 } },
  ]);
  return sendSuccess(res, { data: rows.map((r) => ({ id: r._id, name: r.name })) });
});

/** GET /api/workouts/categories */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await WorkoutCategory.find({}, 'name').sort({ name: 1 }).lean();

  return sendSuccess(res, {
    data: categories.map((c) => ({ id: c._id, name: c.name })),
  });
});

// ===========================================================================
// SESSIONS -- the user's own logged workouts
//
// Kept in this file rather than its own: both halves are the workouts feature,
// both are mounted under /api/workouts, and a second controller for three
// handlers is a file to open rather than a boundary worth having.
//
// The distinction that DOES matter is the one these two halves embody: catalog
// reads are shared and unscoped, session reads are per-user. That scoping lives
// in the model's filter rather than in a check here -- the same reason
// ChatConversation.findOwned does it. A predicate in the query cannot be
// forgotten at a new call site; a guard in a controller can.
// ===========================================================================

/** Sunday-start week containing `day`, as calendar-day strings. */
function weekBounds(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const offset = d.getUTCDay();

  const from = new Date(d);
  from.setUTCDate(d.getUTCDate() - offset);

  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);

  const fmt = (x) => x.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * The user's timezone decides what "today" and "this week" mean.
 *
 * Fetched rather than assumed: deriving the week from the server's clock puts a
 * Manila user's Monday-morning session in the wrong week for eight hours of
 * every day.
 */
async function userTimeZone(req) {
  // The request's own zone wins; the stored one covers old clients
  if (req.timeZone) return req.timeZone;
  const { userId } = req;
  const profile = await User.getProfile(userId);
  return profile?.timezone || undefined;
}

/**
 * POST /api/workouts/sessions
 *
 * One write, at the end of a workout. See the note in the model for why there
 * is no create-on-start and no per-set write.
 */
const logSession = asyncHandler(async (req, res) => {
  const { plannedId, ...result } = req.body;

  // Started from the schedule: complete that planned row instead of adding one
  const session = plannedId
    ? await WorkoutSession.completePlanned(plannedId, req.userId, 'exercise', result)
    : await WorkoutSession.createExerciseSession({ userId: req.userId, ...result });

  if (!session) throw ApiError.notFound('Scheduled session not found');

  return sendSuccess(res, {
    statusCode: 201,
    message: session.status === 'completed' ? 'Workout logged' : 'Partial workout logged',
    data: session,
  });
});

/**
 * GET /api/workouts/sessions?from=&to=
 *
 * Defaults to the current week in the user's timezone, which is what every
 * caller so far actually wants.
 */
/**
 * GET /api/workouts/sessions
 *
 * Three uses, one endpoint:
 *   ?from=&to=            a calendar range (defaults to this week)
 *   ?limit=5              the most recent N, regardless of date
 *   ?exerciseRef=1573     this user's history for one exercise
 *
 * Kept as one route rather than three because they differ only in the filter,
 * and three endpoints returning the same shape is three things to keep in sync.
 *
 * `limit` and `exerciseRef` deliberately IGNORE the date range. "My last five
 * workouts" is not a date question -- someone who trained twice last month
 * should see those two, not an empty list because this week is blank.
 */
const listSessions = asyncHandler(async (req, res) => {
  const { exerciseRef, limit } = req.query;

  if (exerciseRef) {
    const sessions = await WorkoutSession.findRecentForExercise(
      req.userId,
      Number(exerciseRef),
      limit ? Number(limit) : 5,
    );
    return sendSuccess(res, { data: { sessions, last: sessions[0] || null } });
  }

  if (limit) {
    const offset = Math.max(0, Number(req.query.offset) || 0);
    // `days` is opt-in, not a blanket floor on this branch: useWorkoutSessions
    // also calls `?limit=5` for the "most recent, regardless of date" widget
    // on the workouts tab/dashboard, and that one must still find a session
    // from last month if that is genuinely the user's most recent. Only the
    // dedicated history screen (useWorkoutHistory) sends `days`, to cap ITS
    // page-able list to a rolling window instead of growing forever.
    const days = req.query.days ? Number(req.query.days) : null;
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    const { sessions, total } = await WorkoutSession.findRecent(req.userId, {
      limit: Number(limit),
      offset,
      since,
    });

    return sendSuccess(res, {
      data: {
        sessions,
        total,
        offset,
        // Computed here rather than left to the client to infer from a short
        // page: a page can be short because it is the last one OR because the
        // limit divides evenly, and the client cannot tell those apart.
        hasMore: offset + sessions.length < total,
      },
    });
  }

  const timeZone = await userTimeZone(req);
  const defaults = weekBounds(today(timeZone));

  const sessions = await WorkoutSession.findRange({
    userId: req.userId,
    from: req.query.from || defaults.from,
    to: req.query.to || defaults.to,
    timeZone,
  });

  return sendSuccess(res, { data: { sessions } });
});

/**
 * GET /api/workouts/sessions/summary
 *
 * Powers the dashboard card and the Workouts "This week" stats
 */
const sessionSummary = asyncHandler(async (req, res) => {
  const timeZone = await userTimeZone(req);
  const { from, to } = weekBounds(today(timeZone));

  const [summary, latest] = await Promise.all([
    WorkoutSession.summariseRange({ userId: req.userId, from, to, timeZone }),
    WorkoutSession.findLatest(req.userId),
  ]);

  return sendSuccess(res, {
    data: {
      weekStart: from,
      weekEnd: to,

      // Fully completed sessions; partials are reported separately so the
      // user still sees the work they did.
      completed: summary.completed,
      started: summary.total,
      totalSets: summary.totalSets,
      totalMinutes: Math.round(summary.totalSeconds / 60),

      latest,
    },
  });
});

// ===========================================================================
// Routines, favorites and scheduling
// ===========================================================================

// Scheduling window: from now up to 7 days ahead. A minute of slack in the
// past so a "now" picked on a slow phone isn't rejected
const SCHEDULE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const SCHEDULE_SLACK_MS = 60 * 1000;

async function findExercise(exerciseRef) {
  return Workout.findById(Number(exerciseRef), 'name').lean();
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
    const exercise = await findExercise(refId);
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
    const exercise = await findExercise(req.body.exerciseRef);
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

// DELETE /api/workouts/sessions/:id -- one logged session, exercise or routine
const deleteSession = asyncHandler(async (req, res) => {
  const removed = await WorkoutSession.removeLogged(req.params.id, req.userId);
  if (!removed) throw ApiError.notFound('Session not found');
  return sendSuccess(res, { message: 'Session deleted' });
});

// DELETE /api/workouts/sessions/day/:date -- a whole day, in the user's timezone
const deleteSessionsOnDay = asyncHandler(async (req, res) => {
  const removed = await WorkoutSession.removeLoggedOnDay(req.userId, req.params.date, await userTimeZone(req));
  return sendSuccess(res, { data: { removed }, message: removed ? 'Sessions deleted' : 'Nothing to delete' });
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
  // catalog
  listWorkouts,
  getWorkout,
  listCategories,
  listEquipment,
  // sessions
  logSession,
  listSessions,
  sessionSummary,
  // routines, favorites, schedule
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
  deleteSession,
  deleteSessionsOnDay,
};