const { withTransaction } = require('../../config/mongo');
const WaterLog = require('../models/water/WaterLog');
const User = require('../models/user/User');
const { asyncHandler, sendSuccess, ApiError } = require('../utils/httpResponse');
const { today, addDays, dayRangeToInstants } = require('../utils/calendarDay');
const { notify } = require('../services/notifications/notify');
const { MAX_DAY_ML } = require('../validators/waterValidators');
const { userTimeZone } = require('../services/user/userTimeZone');
const { GLASS_ML, MIN_WATER_GOAL_ML, MAX_WATER_GOAL_ML } = require('../utils/goals/goalLimits');

// Today's entries and total, the goal, and a total per day for the
// `days` days ending on `to` (today by default; oldest first, zero-filled)
async function buildWaterPayload(req, days = 7, to = null) {
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  const end = to && to < day ? to : day;
  const from = addDays(end, -(days - 1));

  const todayRange = dayRangeToInstants(day, day, timeZone);
  const range = dayRangeToInstants(from, end, timeZone);

  const [entries, totals, goal] = await Promise.all([
    WaterLog.listBetween(req.userId, todayRange.start, todayRange.end),
    WaterLog.dailyTotals(req.userId, range.start, range.end, timeZone),
    User.getActiveGoal(req.userId),
  ]);

  return {
    date: day,
    glassMl: GLASS_ML,
    // Clamped both ways: goals saved before the 4 L ceiling still read as valid
    goalMl: Math.min(Math.max(goal?.dailyWaterMl ?? MIN_WATER_GOAL_ML, MIN_WATER_GOAL_ML), MAX_WATER_GOAL_ML),
    maxDayMl: MAX_DAY_ML,
    totalMl: totals[day] || 0,
    entries,
    days: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, totalMl: totals[date] || 0 };
    }),
  };
}

// GET /api/water?days=7&to=YYYY-MM-DD
const getWater = asyncHandler(async (req, res) => {
  const data = await buildWaterPayload(req, req.validatedQuery?.days || 7, req.validatedQuery?.to);
  return sendSuccess(res, { data });
});

// POST /api/water -- defaults to one glass
const logWater = asyncHandler(async (req, res) => {
  const amountMl = req.body.amountMl ?? GLASS_ML;
  // A day's total stays under the ceiling, however many drinks it took
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  const { start, end } = dayRangeToInstants(day, day, timeZone);
  const entries = await WaterLog.listBetween(req.userId, start, end);
  const total = entries.reduce((sum, e) => sum + e.amountMl, 0);
  if (total + amountMl > MAX_DAY_ML) {
    throw ApiError.badRequest(
      `That would pass ${MAX_DAY_ML.toLocaleString('en-US')} ml for today. Drinking that much water is not recommended.`,
      { code: 'WATER_DAY_LIMIT' },
    );
  }
  await WaterLog.add(req.userId, amountMl);
  const data = await buildWaterPayload(req);
  // Once per day: the dedupe key makes later glasses that day a no-op.
  // Not awaited, notify never throws
  if (data.totalMl >= data.goalMl) {
    notify(req.userId, 'water_goal_reached', { dedupeKey: `water-goal:${data.date}` });
  }
  return sendSuccess(res, { statusCode: 201, message: 'Water logged', data });
});

// DELETE /api/water/:id
const removeWater = asyncHandler(async (req, res) => {
  const removed = await WaterLog.removeOwned(req.params.id, req.userId);
  if (!removed) throw ApiError.notFound('Entry not found');
  const data = await buildWaterPayload(req);
  return sendSuccess(res, { message: 'Entry removed', data });
});

// PUT /api/water/goal -- validator already enforces the 8-glass minimum
const setWaterGoal = asyncHandler(async (req, res) => {
  const goal = await User.setGoalTarget(req.userId, 'dailyWaterMl', req.body.goalMl);
  if (!goal) throw ApiError.notFound('User not found');
  const data = await buildWaterPayload(req);
  return sendSuccess(res, { message: 'Water goal saved', data });
});

// GET /api/water/day/:date -- one day's drinks, for the day editor
const getWaterDay = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const timeZone = await userTimeZone(req);
  const { start, end } = dayRangeToInstants(date, date, timeZone);
  const entries = (await WaterLog.listBetween(req.userId, start, end)).reverse(); // oldest first

  return sendSuccess(res, {
    data: {
      date,
      entries,
      totalMl: entries.reduce((sum, e) => sum + e.amountMl, 0),
    },
  });
});

// PUT /api/water/day/:date -- the day's drinks become exactly `amounts`.
// An empty list clears the day. Any past day, not a future one
const setWaterDay = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  if (date > day) {
    throw ApiError.badRequest("Water can't be logged for a future day.", { code: 'FUTURE_DAY' });
  }

  const { start, end } = dayRangeToInstants(date, date, timeZone);
  // New drinks on a past day go at its local noon; today, at the current time
  const fallbackAt = date === day ? new Date() : new Date((start.getTime() + end.getTime()) / 2);

  await withTransaction((client) =>
    WaterLog.replaceBetween(req.userId, start, end, req.body.amounts, fallbackAt, client));

  const data = await buildWaterPayload(req, req.validatedQuery?.days || 7);
  return sendSuccess(res, { message: 'Water updated', data });
});

module.exports = { getWater, logWater, removeWater, setWaterGoal, getWaterDay, setWaterDay };