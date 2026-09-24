const db = require('../../../config/mongo');
const { WorkoutSession: SessionDoc } = require('../schemas');
const { assertCalendarDay } = require('../../utils/calendarDay');

const { opts } = db;

/**
 * Completed workout sessions.
 *
 * ---------------------------------------------------------------------------
 * One write, at the end
 * ---------------------------------------------------------------------------
 * There is deliberately no create-on-start. The obvious design -- open an
 * `active` session when the user taps Start, patch it on each completed set,
 * close it on Finish -- is wrong here on both counts.
 *
 * A set tap is frequent and the cluster allows 100 operations per second, so
 * per-set writes spend the budget on data nobody reads. And ExerciseWorkoutTracker
 * has no resume affordance: its state lives in useState inside a modal and is
 * discarded when the modal closes. A session opened on Start would therefore
 * become an orphan stuck in `active` forever, with no screen able to finish it.
 *
 * One write on completion means one operation, no orphans, and no stored state
 * the UI cannot represent. If resume is ever built, add the start write THEN --
 * it needs a screen that can pick a session back up first.
 *
 * ---------------------------------------------------------------------------
 * Partial sessions are still sessions
 * ---------------------------------------------------------------------------
 * A user who finishes one set of three has done something real. Writing only
 * completed sessions would make the coach's "workouts in the last 7 days"
 * undercount and the weekly-goal progress quietly lie. Partials are stored with
 * status 'skipped' and their true completedSets.
 */

/** Excludes userId and __v; everything here is rendered. */
const PROJECTION =
  'kind exerciseRef exerciseName routineId targetSets targetReps completedSets ' +
  'scheduledFor startedAt completedAt status actualDurationSeconds caloriesBurnedKcal';

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/**
 * Turns an inclusive YYYY-MM-DD range into an instant range.
 *
 * completedAt is an INSTANT; the query parameters are CALENDAR DAYS. Converting
 * between them is the one place a timezone can silently corrupt a result: done
 * in UTC, a session logged at 07:00 in Manila (UTC+8) falls into the previous
 * day's bucket, so "this week" drops Monday morning workouts for every user east
 * of Greenwich.
 *
 * The offset is derived from the user's own timezone. Without one, the server's
 * is used -- wrong, but no more wrong than having no boundary at all.
 */
function dayRangeToInstants(from, to, timeZone) {
  assertCalendarDay(from, 'from');
  assertCalendarDay(to, 'to');

  /**
   * The zone's UTC offset for the day in question, read from Intl rather than
   * assumed, so a DST boundary inside the range is handled correctly.
   *
   * Uses longOffset rather than deriving the offset from the local hour: hour
   * alone is ambiguous past +/-12, where UTC+13 and UTC-11 both report 1 while
   * their midnights are a full day apart.
   */
  const offsetMinutes = (day) => {
    const probe = new Date(`${day}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      timeZoneName: 'longOffset',
    }).formatToParts(probe);
    const label = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  };

  // Midnight local, expressed as an instant.
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes(from));

  // Exclusive upper bound: the instant the day AFTER `to` begins. Using the end
  // of `to` would mean picking a precision -- 23:59:59 drops anything in the
  // final second, and .999 is only right by accident. A half-open interval has
  // no such edge.
  const nextDay = new Date(`${to}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDay = nextDay.toISOString().slice(0, 10);
  const end = new Date(`${endDay}T00:00:00Z`);
  end.setUTCMinutes(end.getUTCMinutes() - offsetMinutes(endDay));

  return { start, end };
}

const WorkoutSession = {
  /**
   * Records a finished (or abandoned) session.
   *
   * caloriesBurnedKcal is intentionally absent. Estimating it needs MET values
   * that wger does not publish, and an invented calorie figure in a fitness app
   * is worse than no figure -- users act on it. contextBuilder already wraps the
   * field in $ifNull, so nothing downstream breaks on null.
   *
   * @param {{ userId: string, exerciseRef: number, exerciseName: string,
   *           targetSets: number, targetReps: number, completedSets: number,
   *           startedAt: Date|string, completedAt: Date|string,
   *           actualDurationSeconds: number }} input
   */
  async createExerciseSession(input, client = db) {
    const completedSets = Number(input.completedSets) || 0;
    const targetSets = Number(input.targetSets) || 0;

    const [doc] = await SessionDoc.create(
      [
        {
          userId: input.userId,

          // Discriminator, not a null pattern. routineId is left unset, which
          // the pre('validate') hook requires for this kind.
          kind: 'exercise',
          exerciseRef: input.exerciseRef,
          exerciseName: input.exerciseName ?? null,

          targetSets,
          targetReps: Number(input.targetReps) || 0,
          completedSets,

          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),

          // Derived here rather than trusted from the client: the client sends
          // what it did, the server decides what that means. A session is only
          // 'completed' when every target set was finished.
          status: completedSets >= targetSets && targetSets > 0 ? 'completed' : 'skipped',

          actualDurationSeconds: Number(input.actualDurationSeconds) || null,
          caloriesBurnedKcal: null,
        },
      ],
      opts(client),
    );

    return shape(doc.toObject());
  },

  /**
   * Sessions within an inclusive calendar-day range, newest first.
   *
   * Served by { userId: 1, scheduledFor: -1 } -- but note this sorts on
   * completedAt, which that index does NOT cover. At the volumes here (a few
   * sessions per user per week) the sort is trivially small; if it ever starts
   * failing rather than slowing, that is the 32 MB in-memory sort cap with
   * allowDiskUse ignored, and the answer is an index on
   * { userId: 1, completedAt: -1 } rather than a bigger limit.
   */
  async findRange(input, client = db) {
    const { start, end } = dayRangeToInstants(input.from, input.to, input.timeZone);

    const rows = await SessionDoc.find(
      { userId: input.userId, completedAt: { $gte: start, $lt: end } },
      PROJECTION,
      opts(client),
    )
      .sort({ completedAt: -1 })
      .limit(input.limit || 100)
      .lean();

    return rows.map(shape);
  },

  /**
   * Counts and totals for a range, for the dashboard and goal progress.
   *
   * Aggregated in the database rather than by fetching rows and reducing in JS:
   * the dashboard wants three numbers, not a list, and shipping the documents
   * only to discard them spends the ops budget on nothing.
   */
  async summariseRange(input, client = db) {
    const { start, end } = dayRangeToInstants(input.from, input.to, input.timeZone);

    const [row] = await SessionDoc.aggregate([
      { $match: { userId: input.userId, completedAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          // Partials are counted separately rather than folded in, so the
          // weekly goal measures finished workouts while the user can still see
          // the ones they started.
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalSets: { $sum: '$completedSets' },
          totalSeconds: { $sum: { $ifNull: ['$actualDurationSeconds', 0] } },
        },
      },
    ]).session(client && typeof client.inTransaction === 'function' ? client : null);

    // $group returns nothing when nothing matched, which is not the same as
    // zero. Normalised here so callers can read the fields unconditionally.
    return row
      ? {
        total: row.total,
        completed: row.completed,
        totalSets: row.totalSets,
        totalSeconds: row.totalSeconds,
      }
      : { total: 0, completed: 0, totalSets: 0, totalSeconds: 0 };
  },

  /**
   * The most recent sessions, ignoring calendar boundaries.
   *
   * Separate from findRange because "my last five workouts" is not a date
   * question -- a user who trained twice last month should still see those two
   * rather than an empty list because this week happens to be blank. Ranges
   * answer "what did I do in this period"; the recent list wants "what have I
   * been doing".
   */
  async findRecent(userId, { limit = 5, offset = 0, since = null } = {}, client = db) {
    // completedAt, not scheduledFor: createExerciseSession never sets
    // scheduledFor (see above -- there is no create-on-start), so every
    // exercise session has it null. Sorting/filtering on it either returned
    // an arbitrary order (no `since`) or, worse, matched nothing at all once
    // `since` was added -- `scheduledFor: { $gte: cutoff }` can't match null.
    // completedAt is always set and is what findRange/summariseRange already
    // key on, and what the client itself groups and displays by.
    //
    // `since` scopes the whole page-able list to a rolling window (the history
    // screen passes 30 days back) rather than letting it grow unbounded as a
    // user logs more sessions over months. Left null for other callers, who
    // want the plain "last N" behaviour unaffected.
    const filter = { userId, ...(since ? { completedAt: { $gte: since } } : {}) };

    /**
     * Count and page in parallel. The count drives "showing 12 of 87" and the
     * end-of-list check, and it is a separate query either way -- running them
     * together saves a round trip against a 100 ops/sec ceiling.
     */
    const [rows, total] = await Promise.all([
      SessionDoc.find(filter, PROJECTION, opts(client))
        .sort({ completedAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(limit, 50))
        .lean(),
      SessionDoc.countDocuments(filter, opts(client)),
    ]);

    return { sessions: rows.map(shape), total };
  },

  /**
   * This user's history for ONE exercise, newest first.
   *
   * Powers the "last performed" line above the tracker -- what turns it from a
   * standalone timer into something that knows your history. Opening bench
   * press should tell you what you did last time before you pick a target.
   *
   * Returns a list rather than a single row: the caller takes [0] for the
   * headline, and a per-exercise history view gets the rest for free.
   *
   * Only 'completed' sessions count. "Last time you did 3 x 10" is a reference
   * point; an abandoned single set is not one, and offering it as one would
   * quietly tell the user to train down.
   *
   * Served by { userId: 1, scheduledFor: -1 } -- userId is the index prefix and
   * exerciseRef filters within that small per-user set. A dedicated index would
   * cost storage against a 512 MB budget for no measurable gain at this scale.
   */
  async findRecentForExercise(userId, exerciseRef, limit = 5, client = db) {
    const rows = await SessionDoc.find(
      { userId, kind: 'exercise', exerciseRef, status: 'completed' },
      PROJECTION,
      opts(client),
    )
      .sort({ scheduledFor: -1 })
      .limit(Math.min(limit, 50))
      .lean();

    return rows.map(shape);
  },

  /** Most recent session, for the dashboard card. */
  async findLatest(userId, client = db) {
    return shape(
      await SessionDoc.findOne({ userId }, PROJECTION, opts(client))
        .sort({ completedAt: -1 })
        .lean(),
    );
  },
};

module.exports = WorkoutSession;