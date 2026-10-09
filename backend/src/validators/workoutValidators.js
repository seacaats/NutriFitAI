const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

const listQuerySchema = z.object({
  category: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
  // "none" (bodyweight), "any" (needs equipment), or an equipment id
  equipment: z.string().regex(/^(none|any|\d+)$/, 'expected none, any or an equipment id').optional(),
  // Comma-separated exercise ids, for the Favorites tab
  ids: z.string().regex(/^\d+(,\d+){0,199}$/, 'expected comma-separated ids').optional(),
  limit: z.coerce.number().int().positive().max(60).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  // Which of the few shuffled orders to use for the "Picked for you" list.
  // Mirrors SHUFFLE_VARIANTS in workoutsController.js
  shuffle: z.coerce.number().int().min(1).max(8).optional(),
}).strict();

const CALENDAR_DAY = z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD');


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

  // Set when this run started from a scheduled (planned) session, so that
  // row is completed instead of a second one being created
  plannedId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
}).strict();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

// ---- Routines -------------------------------------------------------------

const routineExerciseSchema = z.object({
  exerciseRef: z.coerce.number().int().positive(),
  exerciseName: z.string().trim().min(1).max(150),
  targetSets: z.coerce.number().int().min(1).max(20).default(3),
  targetReps: z.coerce.number().int().min(1).max(200).default(10),
}).strict();

const routineFields = {
  title: z.string().trim().min(1, 'Please give the routine a name.').max(150, 'Routine name is too long.'),
  description: z.string().trim().max(500, 'Description is too long.').nullable().optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(360).nullable().optional(),
  exercises: z.array(routineExerciseSchema)
    .min(1, 'Add at least one exercise.')
    .max(30, 'A routine can have up to 30 exercises.'),
};

const createRoutineSchema = z.object(routineFields).strict();

const updateRoutineSchema = z.object({
  title: routineFields.title.optional(),
  description: routineFields.description,
  estimatedDurationMinutes: routineFields.estimatedDurationMinutes,
  exercises: routineFields.exercises.optional(),
}).strict().refine((b) => Object.keys(b).length > 0, { message: 'There are no changes to save.' });

// One run of a routine, logged when the player finishes or is left early
const logRoutineSessionSchema = z.object({
  routineId: objectId,
  completedSets: z.coerce.number().int().min(0).max(30), // exercises finished
  targetSets: z.coerce.number().int().min(1).max(30), // exercises in the routine
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  actualDurationSeconds: z.coerce.number().int().min(0).max(21600).optional(),
  plannedId: objectId.optional(),
  // How each exercise went, matched to the routine by position. When sent,
  // the totals above are recomputed from it on the server
  exercises: z.array(z.object({
    position: z.coerce.number().int().min(0).max(29),
    completedSets: z.coerce.number().int().min(0).max(20),
    done: z.boolean(),
  }).strict()).max(30).optional(),
}).strict();

// ---- Favorites -------------------------------------------------------------

const favoriteSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  refId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(150),
}).strict();

const favoriteParamsSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  refId: z.string().trim().min(1).max(64),
}).strict();

// ---- Scheduling ------------------------------------------------------------

// Up to 7 days ahead. The exact window is checked in the controller against
// the current time; this only shapes the body
const scheduleSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  routineId: objectId.optional(),
  exerciseRef: z.coerce.number().int().positive().optional(),
  exerciseName: z.string().trim().min(1).max(150).optional(),
  targetSets: z.coerce.number().int().min(1).max(20).optional(),
  targetReps: z.coerce.number().int().min(1).max(200).optional(),
  scheduledFor: z.coerce.date(),
}).strict().refine(
  (b) => (b.kind === 'routine' ? Boolean(b.routineId) : Boolean(b.exerciseRef && b.exerciseName)),
  { message: 'A routine needs routineId; an exercise needs exerciseRef and exerciseName.' },
);

const idParamSchema = z.object({ id: objectId }).strict();

const dayParamSchema = z.object({ date: CALENDAR_DAY }).strict();

// New time for an existing plan; the window is checked in the controller
const rescheduleSchema = z.object({ scheduledFor: z.coerce.date() }).strict();

module.exports = {
  sessionRangeSchema,
  logSessionSchema,
  listQuerySchema,
  CALENDAR_DAY,
  createRoutineSchema,
  updateRoutineSchema,
  logRoutineSessionSchema,
  favoriteSchema,
  favoriteParamsSchema,
  scheduleSchema,
  idParamSchema,
  rescheduleSchema,
  dayParamSchema,
};