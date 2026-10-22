const WorkoutSession = require('../../models/workouts/WorkoutSession');
const { asyncHandler, sendSuccess, ApiError } = require('../../utils/httpResponse');
const { today } = require('../../utils/calendarDay');
const { userTimeZone } = require('../../services/user/userTimeZone');
const { invalidateRecommendations } = require('../recommendationController');

// ---- Sessions ---------------------------------------------------------------

/** Sunday-start week containing `day` as calendar-day strings. */
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

// POST /api/workouts/sessions
const logSession = asyncHandler(async (req, res) => {
  const { plannedId, ...result } = req.body;

  const session = plannedId
    ? await WorkoutSession.completePlanned(plannedId, req.userId, 'exercise', result)
    : await WorkoutSession.createExerciseSession({ userId: req.userId, ...result });

  if (!session) throw ApiError.notFound('Scheduled session not found');

  invalidateRecommendations(req.userId);

  return sendSuccess(res, {
    statusCode: 201,
    message: session.status === 'completed' ? 'Workout logged' : 'Partial workout logged',
    data: session,
  });
});

/**
 * GET /api/workouts/sessions
 *   ?from=&to=         calendar range (defaults to current week)
 *   ?limit=5           most recent N sessions (optionally bounded by `days`)
 *   ?exerciseRef=1573  completed history for one exercise
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

// GET /api/workouts/sessions/summary
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
      completed: summary.completed,
      started: summary.total,
      totalSets: summary.totalSets,
      totalMinutes: Math.round(summary.totalSeconds / 60),
      latest,
    },
  });
});

// DELETE /api/workouts/sessions/:id
const deleteSession = asyncHandler(async (req, res) => {
  const removed = await WorkoutSession.removeLogged(req.params.id, req.userId);
  if (!removed) throw ApiError.notFound('Session not found');
  return sendSuccess(res, { message: 'Session deleted' });
});

// DELETE /api/workouts/sessions/day/:date
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
