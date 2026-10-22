const Meal = require('../../models/food/Meal');
const WaterLog = require('../../models/water/WaterLog');
const DailySteps = require('../../models/steps/DailySteps');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const User = require('../../models/user/User');
const { addDays, dayRangeToInstants, today } = require('../../utils/calendarDay');

const STREAK_LOOKBACK_DAYS = 366;

/**
 * Counts consecutive days up to `day` with any logged meal, water, workout, or steps.
 * Bounded by the account creation date so backfilled step history prior to signup is excluded.
 */
async function activityStreak(userId, day, timeZone) {
  const lookbackFrom = addDays(day, -(STREAK_LOOKBACK_DAYS - 1));
  const account = await User.findById(userId, 'createdAt').lean();
  const joined = account?.createdAt ? today(timeZone, new Date(account.createdAt)) : null;
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
