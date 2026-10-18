const Meal = require('../models/food/Meal');
const WaterLog = require('../models/water/WaterLog');
const DailySteps = require('../models/steps/DailySteps');
const WorkoutSession = require('../models/workouts/WorkoutSession');
const WeightLog = require('../models/user/WeightLog');
const User = require('../models/user/User');
const { asyncHandler, sendSuccess } = require('../utils/httpResponse');
const { activityStreak } = require('../services/progress/activityStreak');
const { weightTrend, LOOKBACK_DAYS } = require('../services/progress/weightTrend');
const {
  today, addDays, dayRangeToInstants, weekStart, monthStart, daysBetween,
} = require('../utils/calendarDay');
const { userTimeZone } = require('../services/user/userTimeZone');
const { round1 } = require('../utils/numbers');
// Same fallbacks the steps and water screens use
const { DEFAULT_DAILY_STEP_GOAL, MIN_WATER_GOAL_ML, MAX_WATER_GOAL_ML } = require('../utils/goals/goalLimits');

// Inclusive day count, both "YYYY-MM-DD"
const daysInclusive = (from, to) => daysBetween(from, to) + 1;

/**
 * The period's first and last day. `offset` steps back whole periods:
 * 0 is the one holding today, 1 the one before it, and so on
 *   week   Sunday to Saturday, like the workouts summary
 *   month  a calendar month
 *   3m     three calendar months, the current one last
 *   year   a calendar year
 */
function periodRange(period, offset, day) {
  if (period === 'week') {
    const from = addDays(weekStart(day), -7 * offset);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const from = monthStart(day, -offset);
    return { from, to: addDays(monthStart(from, 1), -1) };
  }
  if (period === '3m') {
    const from = monthStart(day, -2 - 3 * offset);
    return { from, to: addDays(monthStart(from, 3), -1) };
  }
  const year = Number(day.slice(0, 4)) - offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Chart groups: a day each for week and month, a week each for 3m (clipped
 * to the period), a month each for year. Each one keeps its own from/to
 */
function bucketsFor(period, from, to) {
  const buckets = [];
  if (period === 'week' || period === 'month') {
    for (let d = from; d <= to; d = addDays(d, 1)) buckets.push({ from: d, to: d });
  } else if (period === '3m') {
    for (let d = weekStart(from); d <= to; d = addDays(d, 7)) {
      buckets.push({ from: d < from ? from : d, to: addDays(d, 6) > to ? to : addDays(d, 6) });
    }
  } else {
    for (let m = 0; m < 12; m += 1) {
      const start = monthStart(from, m);
      buckets.push({ from: start, to: addDays(monthStart(start, 1), -1) });
    }
  }
  return buckets;
}


/**
 * Weight inside the period, one point per day (the day's last reading), and
 * the change from the last reading before the period, or from its first
 * reading when there's nothing earlier. With `vsPrevious` (the dashboard) the
 * change is instead from the reading right before the latest one, so each new
 * log is compared with the one before it, not with the first of the window
 */
async function weightFor(userId, from, to, timeZone, { vsPrevious = false } = {}) {
  const { start, end } = dayRangeToInstants(from, to, timeZone);
  const [rows, before] = await Promise.all([
    WeightLog.findBetween(userId, start, end),
    WeightLog.findLatestBefore(userId, start),
  ]);

  const byDay = new Map();
  rows.forEach((r) => byDay.set(today(timeZone, r.measuredAt), Number(r.weightKg)));
  const points = [...byDay].map(([date, weightKg]) => ({ date, weightKg }));

  const previous = rows.length > 1 ? rows[rows.length - 2] : before;
  const startKg = vsPrevious
    ? (previous ? Number(previous.weightKg) : null)
    : before ? Number(before.weightKg) : points[0]?.weightKg ?? null;
  const currentKg = points.length ? points[points.length - 1].weightKg : startKg;
  const changeKg = points.length && startKg !== null
    ? Math.round((currentKg - startKg) * 10) / 10
    : null;

  return { points, startKg, currentKg, changeKg };
}


// GET /api/progress?period=week|month|3m|year&offset=0
const getProgress = asyncHandler(async (req, res) => {
  const period = req.validatedQuery?.period || 'week';
  const offset = req.validatedQuery?.offset || 0;
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);

  const { from, to } = periodRange(period, offset, day);
  const { start, end } = dayRangeToInstants(from, to, timeZone);
  // Days of the period that have happened. The whole period once it's past
  const lastDay = to < day ? to : day;
  const elapsedDays = from > day ? 0 : daysInclusive(from, lastDay);

  const [meals, water, steps, workouts, weight, streak, goal, profile, trendRows] = await Promise.all([
    Meal.dailyTotals(req.userId, from, to),
    WaterLog.dailyTotals(req.userId, start, end, timeZone),
    DailySteps.findRange({ userId: req.userId, from, to }),
    WorkoutSession.dailyCounts(req.userId, start, end, timeZone),
    weightFor(req.userId, from, to, timeZone),
    activityStreak(req.userId, day, timeZone),
    User.getActiveGoal(req.userId),
    User.getProfile(req.userId),
    // The trend is about now, so only the current period works it out
    offset === 0
      ? WeightLog.findSince(req.userId, dayRangeToInstants(addDays(day, -LOOKBACK_DAYS), day, timeZone).start)
      : null,
  ]);
  const stepsByDay = Object.fromEntries(steps.map((s) => [s.activityDate, Number(s.stepCount) || 0]));
  const trend = trendRows
    ? weightTrend({
      rows: trendRows,
      targetKg: profile?.targetWeightKg ?? null,
      paceKg: profile?.weeklyPaceKg ?? null,
      timeZone,
      day,
    })
    : null;

  // One pass over the days fills both the buckets and the period totals
  const totals = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, steps: 0, waterMl: 0, workouts: 0, mealDays: 0 };
  const buckets = bucketsFor(period, from, to).map((b) => {
    const row = { from: b.from, to: b.to, days: 0, caloriesKcal: 0, mealDays: 0, steps: 0, waterMl: 0, workouts: 0 };
    for (let d = b.from; d <= b.to; d = addDays(d, 1)) {
      if (d <= day) row.days += 1;
      const meal = meals[d];
      if (meal) {
        row.caloriesKcal += meal.caloriesKcal;
        row.mealDays += 1;
        totals.proteinG += meal.proteinG;
        totals.carbsG += meal.carbsG;
        totals.fatG += meal.fatG;
      }
      row.steps += stepsByDay[d] || 0;
      row.waterMl += water[d] || 0;
      row.workouts += workouts[d]?.completed || 0;
    }
    totals.caloriesKcal += row.caloriesKcal;
    totals.mealDays += row.mealDays;
    totals.steps += row.steps;
    totals.waterMl += row.waterMl;
    totals.workouts += row.workouts;
    return { ...row, caloriesKcal: Math.round(row.caloriesKcal) };
  });

  const dailySteps = goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL;
  const dailyWaterMl = Math.min(Math.max(goal?.dailyWaterMl ?? MIN_WATER_GOAL_ML, MIN_WATER_GOAL_ML), MAX_WATER_GOAL_ML);

  return sendSuccess(res, {
    data: {
      period,
      offset,
      from,
      to,
      today: day,
      isCurrent: offset === 0,
      elapsedDays,
      // Only the goals a user can actually set. fitnessGoal is the one picked
      // at registration and in Profile ("Lose weight", or their own words)
      // Target weight and pace are set on the Weight card
      goals: {
        fitnessGoal: goal?.fitnessGoal ?? null,
        dailySteps,
        dailyWaterMl,
        targetWeightKg: profile?.targetWeightKg ?? null,
        weeklyPaceKg: profile?.weeklyPaceKg ?? null,
      },
      // Daily goals add up over the days that have happened, so a period in
      // progress isn't measured against days still to come
      targets: {
        steps: dailySteps * elapsedDays,
        waterMl: dailyWaterMl * elapsedDays,
      },
      totals: {
        ...totals,
        caloriesKcal: Math.round(totals.caloriesKcal),
        proteinG: round1(totals.proteinG),
        carbsG: round1(totals.carbsG),
        fatG: round1(totals.fatG),
      },
      buckets,
      weight,
      // Smoothed weight, weekly rate and projected target date. Null with too few weigh-ins
      weightTrend: trend,
      streak,
    },
  });
});

// GET /api/progress/today -- the dashboard: today's food, steps and the
// next planned workouts, the last 7 days of calories and steps, 30 days of
// weight, and the streak. Water and the weekly workout count aren't here:
// the dashboard reuses useWater and the workouts summary for those
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
// Planned sessions listed on the dashboard
const PLANNED_SHOWN = 3;

const getToday = asyncHandler(async (req, res) => {
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  const weekFrom = addDays(day, -6);

  const [meals, todaysMeals, steps, weight, streak, goal, upcoming] = await Promise.all([
    Meal.dailyTotals(req.userId, weekFrom, day),
    Meal.listSince(req.userId, day),
    DailySteps.findRange({ userId: req.userId, from: weekFrom, to: day }),
    weightFor(req.userId, addDays(day, -29), day, timeZone, { vsPrevious: true }),
    activityStreak(req.userId, day, timeZone),
    User.getActiveGoal(req.userId),
    WorkoutSession.listUpcoming(req.userId, { until: new Date(Date.now() + 7 * 86400000) }),
  ]);
  const stepsByDay = Object.fromEntries(steps.map((s) => [s.activityDate, Number(s.stepCount) || 0]));

  // Consumed meals only, one entry per meal type even when empty, so the
  // dashboard always shows the same four slots
  const eaten = todaysMeals.filter((m) => m.mealDate === day && m.status === 'consumed');
  const mealSlots = MEAL_TYPES.map((type) => {
    const ofType = eaten.filter((m) => m.mealType === type);
    const kcal = ofType.reduce((sum, m) => sum + (m.totals?.caloriesKcal || 0), 0);
    return { mealType: type, count: ofType.length, caloriesKcal: Math.round(kcal) };
  });

  const nutrition = meals[day] || { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  // The next few plans: missed ones still in the grace period first (so they
  // can still be done), then the soonest. The count is every future plan
  const now = new Date();
  const missed = upcoming.filter((w) => new Date(w.scheduledFor) <= now);
  const ahead = upcoming.filter((w) => new Date(w.scheduledFor) > now);
  const plannedWorkouts = [...missed, ...ahead].slice(0, PLANNED_SHOWN).map((w) => ({
    id: w.id,
    kind: w.kind,
    name: w.routineName || w.exerciseName || 'Workout',
    scheduledFor: w.scheduledFor,
    missed: new Date(w.scheduledFor) <= now,
  }));

  const week = [];
  for (let d = weekFrom; d <= day; d = addDays(d, 1)) {
    week.push({ day: d, caloriesKcal: Math.round(meals[d]?.caloriesKcal || 0), steps: stepsByDay[d] || 0 });
  }

  return sendSuccess(res, {
    data: {
      today: day,
      goals: {
        dailySteps: goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL,
        // Set on the Food Scanner; null when not set
        dailyCaloriesKcal: goal?.dailyCaloriesKcal ?? null,
        dailyProteinG: goal?.dailyProteinG ?? null,
        dailyCarbsG: goal?.dailyCarbsG ?? null,
        dailyFatG: goal?.dailyFatG ?? null,
      },
      nutrition: {
        caloriesKcal: Math.round(nutrition.caloriesKcal),
        proteinG: round1(nutrition.proteinG),
        carbsG: round1(nutrition.carbsG),
        fatG: round1(nutrition.fatG),
      },
      meals: mealSlots,
      steps: stepsByDay[day] || 0,
      week,
      weight,
      streak,
      plannedWorkouts,
      plannedCount: ahead.length,
      missedCount: missed.length,
    },
  });
});

module.exports = { getProgress, getToday };