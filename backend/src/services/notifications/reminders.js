const User = require('../../models/user/User');
const WaterLog = require('../../models/water/WaterLog');
const Meal = require('../../models/food/Meal');
const DailySteps = require('../../models/steps/DailySteps');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const PushToken = require('../../models/notifications/PushToken');
const { checkReceipts } = require('./pushSender');
const { notify, localTime } = require('./notify');
const { today, dayRangeToInstants, addDays } = require('../../utils/calendarDay');
const { activityStreak } = require('../progress/activityStreak');
const { MIN_WATER_GOAL_ML, DEFAULT_DAILY_STEP_GOAL } = require('../../utils/goals/goalLimits');

// Periodic scheduler for local-time daily reminders, workout reminders, streaks, and push receipt checks.
const RUN_EVERY_MS = 15 * 60 * 1000;
const STALE_TOKEN_MS = 60 * 24 * 60 * 60 * 1000;

const DAILY_REMINDERS = [
  {
    key: 'water-midday',
    at: '12:00',
    type: 'water_reminder',
    due: async (user, day, timeZone, goal) => (await waterToday(user, day, timeZone)) < (goal?.dailyWaterMl ?? MIN_WATER_GOAL_ML) / 2,
  },
  {
    key: 'water-afternoon',
    at: '15:00',
    type: 'water_reminder',
    due: async (user, day, timeZone, goal) => (await waterToday(user, day, timeZone)) < (goal?.dailyWaterMl ?? MIN_WATER_GOAL_ML) / 2,
  },
  {
    key: 'steps',
    at: '18:00',
    type: 'steps_reminder',
    due: async (user, day, timeZone, goal) => {
      const row = await DailySteps.findByDate({ userId: user.id, activityDate: day });
      return Number(row?.stepCount || 0) < (goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL);
    },
  },
  {
    key: 'meals',
    at: '19:00',
    type: 'meal_reminder',
    due: async (user, day) => !(await Meal.dailyTotals(user.id, day, day))[day],
  },
];

async function waterToday(user, day, timeZone) {
  const range = dayRangeToInstants(day, day, timeZone);
  return (await WaterLog.dailyTotals(user.id, range.start, range.end, timeZone))[day] || 0;
}

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(now, at) {
  const diff = minutes(now) - minutes(at);
  return diff >= 0 && diff < RUN_EVERY_MS / 60000;
}

async function runDailyReminders(at) {
  const cursor = User.find(
    {
      role: 'user',
      emailVerifiedAt: { $ne: null },
      suspendedAt: null,
      'profile.notificationsEnabled': { $ne: false },
      'profile.notificationPrefs.reminders': { $ne: false },
    },
    'email role profile goals',
  ).lean().cursor();

  for await (const doc of cursor) {
    const user = { ...doc, id: doc._id };
    const timeZone = user.profile?.timezone || 'UTC';
    const now = localTime(timeZone, at);
    const due = DAILY_REMINDERS.filter((r) => inWindow(now, r.at));
    if (due.length === 0) continue;

    const day = today(timeZone, at);
    const goal = User.activeGoalOf(user.goals);
    for (const reminder of due) {
      try {
        if (await reminder.due(user, day, timeZone, goal)) {
          await notify(user.id, reminder.type, { user, dedupeKey: `${reminder.key}:${day}` });
        }
      } catch (err) {
        console.error(`[reminders] ${reminder.key} failed for ${user.id}`, err);
      }
    }
  }
}

// ---- Streaks ----
// Evaluated each morning against yesterday's completed logs
const STREAK_CHECK_AT = '08:00';
const STREAK_MILESTONES = [3, 7, 30];

// Defers 08:00 check to the end of quiet hours if 08:00 falls inside them
function streakCheckTime(prefs) {
  const { quietStart: start, quietEnd: end } = prefs || {};
  if (!start || !end) return STREAK_CHECK_AT;
  const quiet = start <= end
    ? STREAK_CHECK_AT >= start && STREAK_CHECK_AT < end
    : STREAK_CHECK_AT >= start || STREAK_CHECK_AT < end;
  return quiet ? end : STREAK_CHECK_AT;
}

async function runStreaks(at) {
  const cursor = User.find(
    {
      role: 'user',
      emailVerifiedAt: { $ne: null },
      suspendedAt: null,
      'profile.notificationsEnabled': { $ne: false },
      'profile.notificationPrefs.achievements': { $ne: false },
    },
    'email role profile',
  ).lean().cursor();

  for await (const doc of cursor) {
    const user = { ...doc, id: doc._id };
    const timeZone = user.profile?.timezone || 'UTC';
    if (!inWindow(localTime(timeZone, at), streakCheckTime(user.profile?.notificationPrefs))) continue;

    try {
      const yesterday = addDays(today(timeZone, at), -1);
      const { days: length, loggedToday } = await activityStreak(user.id, yesterday, timeZone);
      if (!loggedToday || !STREAK_MILESTONES.includes(length)) continue;
      const firstDay = addDays(yesterday, -(length - 1));
      await notify(user.id, `streak_${length}`, { user, dedupeKey: `streak${length}:${firstDay}` });
    } catch (err) {
      console.error(`[reminders] streak failed for ${user.id}`, err);
    }
  }
}

// Notifies planned workout sessions starting 5 to 45 minutes from now
const WORKOUT_REMIND_MIN_MS = 5 * 60 * 1000;
const WORKOUT_REMIND_MAX_MS = 45 * 60 * 1000;

async function runWorkoutReminders(at) {
  const from = new Date(at.getTime() + WORKOUT_REMIND_MIN_MS);
  const to = new Date(at.getTime() + WORKOUT_REMIND_MAX_MS);
  const sessions = await WorkoutSession.startingBetween(from, to);
  for (const session of sessions) {
    const startsAt = new Date(session.scheduledFor).getTime();
    await notify(session.userId, 'workout_reminder', { dedupeKey: `workout:${session._id}:${startsAt}` });
  }
}

async function runReminders(at = new Date()) {
  for (const [name, job] of [
    ['daily', () => runDailyReminders(at)],
    ['workouts', () => runWorkoutReminders(at)],
    ['streaks', () => runStreaks(at)],
    ['push receipts', () => checkReceipts(at.getTime())],
    ['stale tokens', () => PushToken.removeStale(new Date(at.getTime() - STALE_TOKEN_MS))],
  ]) {
    try {
      await job();
    } catch (err) {
      console.error(`[reminders] ${name} run failed`, err);
    }
  }
}

module.exports = { runReminders, RUN_EVERY_MS };
