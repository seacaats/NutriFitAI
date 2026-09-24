const { z } = require('zod');

const listQuerySchema = z.object({
  category: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(60).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

const CALENDAR_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');


const sessionRangeSchema = z.object({
  from: CALENDAR_DAY.optional(),
  to: CALENDAR_DAY.optional(),

  // Present => most recent N regardless of date, rather than a calendar range.
  limit: z.coerce.number().int().positive().max(50).optional(),

  // Paging for the history view. Only meaningful alongside limit.
  offset: z.coerce.number().int().min(0).optional(),

  // Opt-in rolling window, alongside limit -- the dedicated history screen
  // sends this to cap its page-able list (see workoutsController.listSessions).
  // Omitted by other `limit` callers (e.g. the "5 most recent" dashboard
  // widget), which want the true most-recent session regardless of age.
  days: z.coerce.number().int().positive().max(365).optional(),

  // Present => this user's history for one exercise, for the "last performed"
  // line above the tracker.
  exerciseRef: z.coerce.number().int().positive().optional(),
}).strict();

/**
 * Sessions are written once, when a workout ends.
 *
 * targetSets/targetReps come from the tracker's counters, completedSets from
 * what the user actually did. `status` is deliberately NOT accepted from the
 * client -- the server derives it, so a client cannot mark a one-set session
 * 'completed' and inflate its own goal progress.
 */
const logSessionSchema = z.object({
  exerciseRef: z.coerce.number().int().positive(),
  exerciseName: z.string().trim().min(1).max(150),

  targetSets: z.coerce.number().int().min(1).max(20),
  targetReps: z.coerce.number().int().min(1).max(200),
  completedSets: z.coerce.number().int().min(0).max(20),

  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),

  // Capped at six hours. Not paranoia: a backgrounded timer that keeps counting
  // would otherwise write a 14-hour "workout" that skews every average the
  // coach reports.
  actualDurationSeconds: z.coerce.number().int().min(0).max(21600).optional(),

  // A workout abandoned after one set is still work the user did. Recording it
  // as "skipped" keeps the history honest while leaving it out of the weekly
  // goal count, which only counts "completed".
  //
  // This field was missing from an earlier version of this schema while the
  // tracker was already sending it. Under .strict() that is a 400 on every
  // request, which the client swallowed into a console warning -- so sessions
  // silently never saved. If you add a field to the payload, add it here too.
  status: z.enum(['completed', 'skipped']).default('completed'),
}).strict();

module.exports = { sessionRangeSchema, logSessionSchema, listQuerySchema, CALENDAR_DAY };