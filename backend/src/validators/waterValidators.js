const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

// Mirrors GLASS_ML / MIN_GOAL_ML in waterController.js
const MIN_GOAL_ML = 2000;
const MAX_GOAL_ML = 10000;

const waterRangeSchema = z.object({
  // Up to 90 per request. `to` is the last day of the window (defaults to
  // today), so the history screen can page back 30 days at a time
  days: z.coerce.number().int().min(1).max(90).optional(),
  to: z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD').optional(),
}).strict();

// Omitted amount = one glass
const logWaterSchema = z.object({
  amountMl: z.coerce.number().int()
    .min(10, 'Enter at least 10 ml.')
    .max(5000, 'That is more than 5 liters at once.')
    .optional(),
}).strict();

const waterGoalSchema = z.object({
  goalMl: z.coerce.number().int()
    .min(MIN_GOAL_ML, 'The daily goal is at least 8 glasses (2,000 ml).')
    .max(MAX_GOAL_ML, 'The daily goal can be up to 10,000 ml.'),
}).strict();

const waterIdSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id') }).strict();

const waterDayParamSchema = z.object({
  date: z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD'),
}).strict();

// A day's drinks, in order. Each one is the same range as a single log
const waterDaySchema = z.object({
  amounts: z.array(
    z.coerce.number().int().min(10, 'Each drink is at least 10 ml.').max(5000, 'Each drink is at most 5,000 ml.'),
  ).max(40, 'A day can hold up to 40 drinks.'),
}).strict();

module.exports = {
  waterRangeSchema, logWaterSchema, waterGoalSchema, waterIdSchema, waterDayParamSchema, waterDaySchema,
};