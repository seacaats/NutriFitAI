const User = require('../../models/user/User');
const Meal = require('../../models/food/Meal');
const WaterLog = require('../../models/water/WaterLog');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const DailyVisit = require('../../models/user/DailyVisit');
const ActivationFunnel = require('../../models/analytics/ActivationFunnel');
const { ROLLUP_TIME_ZONE } = require('./dailyRollup');
const { today, addDays, dayRangeToInstants } = require('../../utils/calendarDay');

// How far new accounts get, counted once a day (batch): signed up, verified
// the email, finished onboarding, logged something, came back on a later day.
// Each step only counts the accounts that passed every step before it.
// Started from server.js, shown on admin Analytics
//
// Only accounts at least a week old are counted, so each has had time to log
// and return. Counting last night's signups would read as a drop-off
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// Accounts made in this many days, ending MATURE_DAYS ago
const WINDOW_DAYS = 30;
const MATURE_DAYS = 7;

const EMPTY_STEPS = { signedUp: 0, verified: 0, onboarded: 0, logged: 0, returned: 0 };

// 1 when the account has at least one matching row in `Model`, via a lookup
// that stops at the first hit
const hasRow = (Model, as, match = {}) => ({
  $lookup: {
    from: Model.collection.name,
    let: { id: '$_id' },
    pipeline: [{ $match: { $expr: { $eq: ['$userId', '$$id'] }, ...match } }, { $limit: 1 }, { $project: { _id: 1 } }],
    as,
  },
});

const flag = (condition) => ({ $cond: [condition, 1, 0] });
const present = (field) => flag({ $ne: [{ $ifNull: [field, null] }, null] });
const nonEmpty = (field) => ({ $gt: [{ $size: field }, 0] });

async function countFunnel(from, to) {
  const { start, end } = dayRangeToInstants(from, to, ROLLUP_TIME_ZONE);
  const [row] = await User.aggregate([
    { $match: { role: 'user' } },
    // createdAt is converted first: rows brought over from the old database can
    // hold it as a string, which a plain date comparison never matches
    { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { joinedAt: { $gte: start, $lt: end } } },
    { $addFields: { joinDay: { $dateToString: { format: '%Y-%m-%d', date: '$joinedAt', timezone: ROLLUP_TIME_ZONE } } } },
    hasRow(Meal, 'meals', { status: 'consumed' }),
    hasRow(WaterLog, 'water'),
    hasRow(WorkoutSession, 'workouts', { status: 'completed' }),
    // Came back: opened the app on a day after the one they signed up
    {
      $lookup: {
        from: DailyVisit.collection.name,
        let: { id: '$_id', joinDay: '$joinDay' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$userId', '$$id'] }, { $gt: ['$day', '$$joinDay'] }] } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'visits',
      },
    },
    {
      $project: {
        verified: present('$emailVerifiedAt'),
        onboarded: present('$profile.onboardedAt'),
        logged: flag({ $or: [nonEmpty('$meals'), nonEmpty('$water'), nonEmpty('$workouts')] }),
        returned: flag(nonEmpty('$visits')),
      },
    },
    {
      $group: {
        _id: null,
        signedUp: { $sum: 1 },
        verified: { $sum: '$verified' },
        onboarded: { $sum: { $multiply: ['$verified', '$onboarded'] } },
        logged: { $sum: { $multiply: ['$verified', '$onboarded', '$logged'] } },
        returned: { $sum: { $multiply: ['$verified', '$onboarded', '$logged', '$returned'] } },
      },
    },
  ]);
  if (!row) return { ...EMPTY_STEPS };
  const { _id, ...steps } = row;
  return steps;
}

// Counts the cohort and stores today's snapshot
async function runActivationFunnel(at = new Date()) {
  try {
    const day = today(ROLLUP_TIME_ZONE, at);
    const to = addDays(day, -MATURE_DAYS);
    const from = addDays(to, -(WINDOW_DAYS - 1));
    await ActivationFunnel.upsertDay({ day, from, to, steps: await countFunnel(from, to) });
  } catch (err) {
    // Picked up again on the next run, nothing is lost by skipping one
    console.error('[funnel] activation funnel failed', err);
  }
}

module.exports = { RUN_EVERY_MS, runActivationFunnel };