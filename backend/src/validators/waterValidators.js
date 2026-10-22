const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');
const { MIN_WATER_GOAL_ML, MAX_WATER_GOAL_ML } = require('../utils/goals/goalLimits');

const MAX_DAY_ML = 5000;
const MAX_DRINK_ML = 1500;

const waterRangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
  to: z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD').optional(),
}).strict();

const logWaterSchema = z.object({
  amountMl: z.coerce.number().int()
    .min(10, 'Enter at least 10 ml.')
    .max(MAX_DRINK_ML, `A single drink can be up to ${MAX_DRINK_ML.toLocaleString('en-US')} ml.`)
    .optional(),
}).strict();

const waterGoalSchema = z.object({
  goalMl: z.coerce.number().int()
    .min(MIN_WATER_GOAL_ML, 'The daily goal is at least 8 glasses (2,000 ml).')
    .max(MAX_WATER_GOAL_ML, 'The daily goal can be up to 4,000 ml.'),
}).strict();

const waterIdSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id') }).strict();

const waterDayParamSchema = z.object({
  date: z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD'),
}).strict();

const waterDaySchema = z.object({
  amounts: z.array(
    z.coerce.number().int().min(10, 'Each drink is at least 10 ml.').max(MAX_DRINK_ML, `Each drink is at most ${MAX_DRINK_ML.toLocaleString('en-US')} ml.`),
  ).max(40, 'A day can hold up to 40 drinks.'),
}).strict().refine((b) => b.amounts.reduce((sum, ml) => sum + ml, 0) <= MAX_DAY_ML, {
  message: `A day's total can be up to ${MAX_DAY_ML.toLocaleString('en-US')} ml.`,
  path: ['amounts'],
});

module.exports = {
  MAX_DAY_ML, MAX_DRINK_ML,
  waterRangeSchema, logWaterSchema, waterGoalSchema, waterIdSchema, waterDayParamSchema, waterDaySchema,
};
