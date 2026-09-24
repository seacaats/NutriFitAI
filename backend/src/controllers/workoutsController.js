const { Workout, WorkoutCategory } = require('../models/schemas');
const WorkoutSession = require('../models/health/WorkoutSession');
const UserGoal = require('../models/user/UserGoal');
const UserProfile = require('../models/user/UserProfile');
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
 * Query: category, search, hasImage, limit, offset
 */
const listWorkouts = asyncHandler(async (req, res) => {
  const { category, search, hasImage } = req.query;
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

  let query;
  let total;

  if (search && search.trim()) {
    /**
     * Text search over name, muscle names and category, weighted toward the
     * name (see the index definition in models/schemas).
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
async function userTimeZone(userId) {
  const profile = await UserProfile.findByUserId(userId);
  return profile?.timezone || undefined;
}

/**
 * POST /api/workouts/sessions
 *
 * One write, at the end of a workout. See the note in the model for why there
 * is no create-on-start and no per-set write.
 */
const logSession = asyncHandler(async (req, res) => {
  const session = await WorkoutSession.createExerciseSession({
    userId: req.userId,
    ...req.body,
  });

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

  const timeZone = await userTimeZone(req.userId);
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
 * Powers the dashboard card and weekly goal progress.
 *
 * `weeklyWorkouts` has existed on the goals schema since registration and has
 * never been read by anything. This is the endpoint that makes it mean
 * something.
 */
const sessionSummary = asyncHandler(async (req, res) => {
  const timeZone = await userTimeZone(req.userId);
  const { from, to } = weekBounds(today(timeZone));

  const [summary, goal, latest] = await Promise.all([
    WorkoutSession.summariseRange({ userId: req.userId, from, to, timeZone }),
    UserGoal.findActiveByUserId(req.userId),
    WorkoutSession.findLatest(req.userId),
  ]);

  const target = goal?.weeklyWorkouts ?? null;

  return sendSuccess(res, {
    data: {
      weekStart: from,
      weekEnd: to,

      // Only fully completed sessions count toward the goal; partials are
      // reported separately so the user still sees the work they did.
      completed: summary.completed,
      started: summary.total,
      totalSets: summary.totalSets,
      totalMinutes: Math.round(summary.totalSeconds / 60),

      target,
      // Null rather than 0 when no goal is set: "0% of nothing" is a worse
      // thing to render than an absent progress bar.
      progressPct:
        target > 0 ? Math.min(100, Math.round((summary.completed / target) * 100)) : null,

      latest,
    },
  });
});

module.exports = {
  // catalog
  listWorkouts,
  getWorkout,
  listCategories,
  // sessions
  logSession,
  listSessions,
  sessionSummary,
};