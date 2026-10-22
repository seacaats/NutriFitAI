const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

const STEP_SOURCES = ['healthkit', 'health_connect', 'device_sensor'];
const MAX_STEPS_PER_DAY = 20000;
const MAX_SYNC_DAYS = 31;

const isoDate = z
  .string()
  .regex(CALENDAR_DAY_RE, 'Expected a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Not a real calendar date',
  });

// Allow up to 1 day ahead of UTC to accommodate positive timezone offsets
const notFarFuture = isoDate.refine(
  (value) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return value <= tomorrow.toISOString().slice(0, 10);
  },
  { message: 'Date is in the future' },
);

const todayQuerySchema = z
  .object({ date: z.string().regex(CALENDAR_DAY_RE).optional() })
  .strict();

const syncStepsSchema = z
  .object({
    source: z.enum(STEP_SOURCES),
    days: z
      .array(
        z
          .object({
            activityDate: notFarFuture,
            stepCount: z.number().int().min(0).transform((n) => Math.min(n, MAX_STEPS_PER_DAY)),
            distanceMeters: z.number().min(0).max(1000000).nullable().optional(),
          })
          .strict(),
      )
      .min(1, 'At least one day is required')
      .max(MAX_SYNC_DAYS, `At most ${MAX_SYNC_DAYS} days per sync`)
      .refine(
        (days) => new Set(days.map((d) => d.activityDate)).size === days.length,
        { message: 'Duplicate dates in payload' },
      ),
  })
  .strict();

const stepRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .strict()
  .refine((q) => q.from <= q.to, { message: 'The start date must be before the end date.' })
  .refine(
    (q) => {
      const days = (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`))
        / (24 * 60 * 60 * 1000);
      return days <= 366;
    },
    { message: 'Range must not exceed 366 days' },
  );

const manualStepsSchema = z
  .object({
    activityDate: notFarFuture,
    stepCount: z.number().int().min(0).max(MAX_STEPS_PER_DAY, `Steps can be up to ${MAX_STEPS_PER_DAY.toLocaleString('en-US')} a day.`),
  })
  .strict();

const stepGoalSchema = z
  .object({
    dailySteps: z.number().int()
      .min(1000, 'The daily goal is at least 1,000 steps.')
      .max(50000, 'The daily goal can be up to 50,000 steps.'),
  })
  .strict();

const stepSourceSchema = z
  .object({
    source: z.enum(STEP_SOURCES),
  })
  .strict();

module.exports = {
  todayQuerySchema,
  syncStepsSchema,
  stepRangeSchema,
  manualStepsSchema,
  stepGoalSchema,
  stepSourceSchema,
};
