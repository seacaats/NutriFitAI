const Meal = require('../models/food/Meal');
const WaterLog = require('../models/water/WaterLog');
const DailySteps = require('../models/steps/DailySteps');
const WorkoutSession = require('../models/workouts/WorkoutSession');
const User = require('../models/user/User');
const { addDays, dayRangeToInstants, today } = require('../utils/calendarDay');

// The one streak count: the Progress tile and the streak notifications
// (services/notifications/reminders.js) both read it, so they always agree

// How far back the streak looks. A streak longer than this just reads as 366
const STREAK_LOOKBACK_DAYS = 366;

/**
 * Consecutive days, up to today, with anything logged: a meal, water, a
 * workout or steps. Today still counts as "in progress", so an empty today
 * doesn't break a streak that ran through yesterday.
 * Never reaches before the day the account was made: a step sync can
 * backfill months of health-platform history the user didn't do in NutriFitAI
 */
async function activityStreak(userId, day, timeZone) {
  const lookbackFrom = addDays(day, -(STREAK_LOOKBACK_DAYS - 1));
  const account = await User.findById(userId, 'createdAt').lean();
  const joined = account?.createdAt ? today(timeZone, new Date(account.createdAt)) : null;
  // YYYY-MM-DD strings compare in date order
  const from = joined && joined > lookbackFrom ? joined : lookbackFrom;
  if (from > day) return { days: 0, loggedToday: false };
  const { start, end } = dayRangeToInstants(from, day, timeZone);

  const [meals, water, steps, workouts] = await Promise.all([
    Meal.distinct('mealDate', { userId, status: 'consumed', mealDate: { $gte: from, $lte: day } }),
    WaterLog.dailyTotals(userId, start, end, timeZone),
    DailySteps.findRange({ userId, from, to: day }),
    WorkoutSession.dailyCounts(userId, start, end, timeZone),
  ]);

  const active = new Set([
    ...meals,
    ...Object.keys(water),
    ...steps.filter((s) => Number(s.stepCount) > 0).map((s) => s.activityDate),
    ...Object.keys(workouts),
  ]);

  let cursor = active.has(day) ? day : addDays(day, -1);
  let streak = 0;
  while (cursor >= from && active.has(cursor) && streak < STREAK_LOOKBACK_DAYS) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return { days: streak, loggedToday: active.has(day) };
}

module.exports = { activityStreak };