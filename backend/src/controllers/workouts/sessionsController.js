const WorkoutSession = require('../../models/workouts/WorkoutSession');
const { asyncHandler, sendSuccess, ApiError } = require('../../utils/httpResponse');
const { today } = require('../../utils/calendarDay');
const { userTimeZone } = require('../../services/user/userTimeZone');
const { invalidateRecommendations } = require('../recommendationController');

// ---- Sessions -- the user's own logged workouts -----------------------------
// Reads are per-user, and that scoping lives in the model's filter rather than
// in a check here: a predicate in the query can't be forgotten at a new call
// site, a guard in a controller can


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

  // What was just trained changes which workouts the cards offer
  invalidateRecommendations(req.userId);

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

module.exports = {
  logSession,
  listSessions,
  sessionSummary,
  deleteSession,
  deleteSessionsOnDay,
};