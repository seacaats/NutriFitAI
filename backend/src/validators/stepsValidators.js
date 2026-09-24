const { z } = require('zod');


const STEP_SOURCES = ['healthkit', 'health_connect', 'device_sensor'];
const MAX_STEPS_PER_DAY = 200000;

const MAX_SYNC_DAYS = 31;

// Dates stay as strings here and arrive as already-correct strings from the client
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Not a real calendar date',
  });
  

// Allow a one-day future-allowance as user might really be ahead of server time
const notFarFuture = isoDate.refine(
  (value) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return value <= tomorrow.toISOString().slice(0, 10);
  },
  { message: 'Date is in the future' },
);

// `date` is optional on /today; the controller falls back to the server's UTC date when its omitted
const todayQuerySchema = z
  .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
  .strict();

const syncStepsSchema = z
  .object({
    source: z.enum(STEP_SOURCES),
    days: z
      .array(
        z
          .object({
            activityDate: notFarFuture,
            stepCount: z.number().int().min(0).max(MAX_STEPS_PER_DAY),
            distanceMeters: z.number().min(0).max(1000000).nullable().optional(),
          })
          .strict(),
      )
      .min(1, 'At least one day is required')
      .max(MAX_SYNC_DAYS, `At most ${MAX_SYNC_DAYS} days per sync`)
      // Reject duplicate dates
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
  .refine((q) => q.from <= q.to, { message: '`from` must not be after `to`' })
  // Lexical comparison is safe on zero-padded ISO dates
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
    stepCount: z.number().int().min(0).max(MAX_STEPS_PER_DAY),
  })
  .strict();

const stepSourceSchema = z
  .object({
    source: z.enum(STEP_SOURCES),
  })
  .strict();

module.exports = {
  STEP_SOURCES,
  MAX_SYNC_DAYS,
  MAX_STEPS_PER_DAY,
  todayQuerySchema,
  syncStepsSchema,
  stepRangeSchema,
  manualStepsSchema,
  stepSourceSchema,
};
