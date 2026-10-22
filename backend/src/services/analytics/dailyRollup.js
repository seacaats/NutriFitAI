const env = require('../../../config/env');
const User = require('../../models/user/User');
const DailyVisit = require('../../models/user/DailyVisit');
const Meal = require('../../models/food/Meal');
const FoodScan = require('../../models/food/FoodScan');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const WaterLog = require('../../models/water/WaterLog');
const ChatMessage = require('../../models/chat/ChatMessage');
const AuditLog = require('../../models/audit-logs/AuditLog');
const DailyRollup = require('../../models/analytics/DailyRollup');
const { today, addDays, dayRangeToInstants } = require('../../utils/calendarDay');

// Precomputes daily platform totals in a fixed timezone for admin analytics.
const ROLLUP_TIME_ZONE = env.analytics.rollupTimeZone;

const AUDIT_CHAINS = ['info', 'notice', 'warning', 'critical'];

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// Recompute recent days on each run to capture late-arriving syncs
const RECOMPUTE_DAYS = 3;

const WINDOW_DAYS = 31;

const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: ROLLUP_TIME_ZONE } });

const byDay = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

const countPerDay = (Model, match, day) => Model.aggregate([{ $match: match }, { $group: { _id: day, count: { $sum: 1 } } }]);

async function countRange(from, to) {
  const { start, end } = dayRangeToInstants(from, to, ROLLUP_TIME_ZONE);
  const within = (field) => ({ [field]: { $gte: start, $lt: end } });

  const [signups, visits, meals, scans, workouts, water, coach, audit] = await Promise.all([
    // Coerce createdAt to Date to handle string-typed legacy documents
    User.aggregate([
      { $match: { role: 'user' } },
      { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
      { $match: { joinedAt: { $gte: start, $lt: end } } },
      { $group: { _id: dayOf('$joinedAt'), count: { $sum: 1 } } },
    ]),
    countPerDay(DailyVisit, { day: { $gte: from, $lte: to } }, '$day'),
    countPerDay(Meal, { status: 'consumed', mealDate: { $gte: from, $lte: to } }, '$mealDate'),
    countPerDay(FoodScan, within('scannedAt'), dayOf('$scannedAt')),
    countPerDay(WorkoutSession, { status: 'completed', ...within('completedAt') }, dayOf('$completedAt')),
    countPerDay(WaterLog, within('loggedAt'), dayOf('$loggedAt')),
    countPerDay(ChatMessage, { role: 'user', ...within('createdAt') }, dayOf('$createdAt')),
    AuditLog.aggregate([
      { $match: within('createdAt') },
      { $group: { _id: { day: dayOf('$createdAt'), chain: '$chain' }, count: { $sum: 1 } } },
    ]),
  ]);

  const auditByDay = {};
  for (const { _id, count } of audit) (auditByDay[_id.day] ||= {})[_id.chain] = count;

  const counts = {
    signups: byDay(signups),
    activeUsers: byDay(visits),
    meals: byDay(meals),
    scans: byDay(scans),
    workouts: byDay(workouts),
    waterLogs: byDay(water),
    coachMessages: byDay(coach),
  };

  const rows = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const row = { day };
    for (const [key, perDay] of Object.entries(counts)) row[key] = perDay[day] || 0;
    row.audit = Object.fromEntries(AUDIT_CHAINS.map((c) => [c, auditByDay[day]?.[c] || 0]));
    rows.push(row);
  }
  return rows;
}

// Aggregates and upserts an inclusive date range in WINDOW_DAYS chunks
async function rollupRange(from, to, { dryRun = false } = {}) {
  const all = [];
  for (let start = from; start <= to; start = addDays(start, WINDOW_DAYS)) {
    const windowEnd = addDays(start, WINDOW_DAYS - 1);
    const rows = await countRange(start, windowEnd < to ? windowEnd : to);
    if (!dryRun) await DailyRollup.upsertDays(rows);
    all.push(...rows);
  }
  return all;
}

async function runDailyRollup(at = new Date()) {
  try {
    const yesterday = addDays(today(ROLLUP_TIME_ZONE, at), -1);
    await rollupRange(addDays(yesterday, -(RECOMPUTE_DAYS - 1)), yesterday);
  } catch (err) {
    console.error('[rollup] daily rollup failed', err);
  }
}

async function firstDay() {
  const [row] = await User.aggregate([
    { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { joinedAt: { $ne: null } } },
    { $group: { _id: null, first: { $min: '$joinedAt' } } },
  ]);
  return row ? today(ROLLUP_TIME_ZONE, row.first) : null;
}

module.exports = { ROLLUP_TIME_ZONE, RUN_EVERY_MS, runDailyRollup, rollupRange, firstDay };
