const User = require('../../models/user/User');
const Meal = require('../../models/food/Meal');
const WaterLog = require('../../models/water/WaterLog');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const DailyVisit = require('../../models/user/DailyVisit');
const ActivationFunnel = require('../../models/analytics/ActivationFunnel');
const { ROLLUP_TIME_ZONE } = require('./dailyRollup');
const { today, addDays, dayRangeToInstants } = require('../../utils/calendarDay');

// Periodic batch computation of the user activation funnel (signed up -> verified ->
// onboarded -> logged -> returned on a later day) for accounts at least MATURE_DAYS old.
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

const WINDOW_DAYS = 30;
const MATURE_DAYS = 7;

const EMPTY_STEPS = { signedUp: 0, verified: 0, onboarded: 0, logged: 0, returned: 0 };

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
    // Coerce createdAt to Date to handle string-typed legacy documents
    { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { joinedAt: { $gte: start, $lt: end } } },
    { $addFields: { joinDay: { $dateToString: { format: '%Y-%m-%d', date: '$joinedAt', timezone: ROLLUP_TIME_ZONE } } } },
    hasRow(Meal, 'meals', { status: 'consumed' }),
    hasRow(WaterLog, 'water'),
    hasRow(WorkoutSession, 'workouts', { status: 'completed' }),
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

async function runActivationFunnel(at = new Date()) {
  try {
    const day = today(ROLLUP_TIME_ZONE, at);
    const to = addDays(day, -MATURE_DAYS);
    const from = addDays(to, -(WINDOW_DAYS - 1));
    await ActivationFunnel.upsertDay({ day, from, to, steps: await countFunnel(from, to) });
  } catch (err) {
    console.error('[funnel] activation funnel failed', err);
  }
}

module.exports = { RUN_EVERY_MS, runActivationFunnel };
