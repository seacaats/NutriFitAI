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

// Daily platform totals, counted ahead of time (batch) so admin Analytics
// doesn't recount past days on every request. Started from server.js, and
// filled for past days by scripts/backfill-rollups.js
//
// Days are counted in one fixed zone, unlike the live counts that follow the
// viewer's. Analytics reads the rollup only for viewers in this zone
const ROLLUP_TIME_ZONE = env.analytics.rollupTimeZone;

// Audit severities (the chain), as the Analytics page lists them
const AUDIT_CHAINS = ['info', 'notice', 'warning', 'critical'];

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// Finished days recounted on every run, so a late entry (a step sync, a visit
// from another zone) still lands in its day
const RECOMPUTE_DAYS = 3;

// Days counted per query, so a backfill never holds a large query open
const WINDOW_DAYS = 31;

// Instant -> "YYYY-MM-DD" in the rollup zone, inside an aggregation
const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: ROLLUP_TIME_ZONE } });

// { "2026-10-04": 12 } from aggregation rows of { _id: day, count }
const byDay = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

const countPerDay = (Model, match, day) => Model.aggregate([{ $match: match }, { $group: { _id: day, count: { $sum: 1 } } }]);

// One row per day of the range, zeros included
async function countRange(from, to) {
  const { start, end } = dayRangeToInstants(from, to, ROLLUP_TIME_ZONE);
  const within = (field) => ({ [field]: { $gte: start, $lt: end } });

  const [signups, visits, meals, scans, workouts, water, coach, audit] = await Promise.all([
    // createdAt is converted first: rows brought over from the old database can
    // hold it as a string, which a plain date comparison never matches
    User.aggregate([
      { $match: { role: 'user' } },
      { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
      { $match: { joinedAt: { $gte: start, $lt: end } } },
      { $group: { _id: dayOf('$joinedAt'), count: { $sum: 1 } } },
    ]),
    // One row per user per day, so the row count is the number of active users
    countPerDay(DailyVisit, { day: { $gte: from, $lte: to } }, '$day'),
    countPerDay(Meal, { status: 'consumed', mealDate: { $gte: from, $lte: to } }, '$mealDate'),
    countPerDay(FoodScan, within('scannedAt'), dayOf('$scannedAt')),
    countPerDay(WorkoutSession, { status: 'completed', ...within('completedAt') }, dayOf('$completedAt')),
    countPerDay(WaterLog, within('loggedAt'), dayOf('$loggedAt')),
    countPerDay(ChatMessage, { role: 'user', ...within('createdAt') }, dayOf('$createdAt')),
    // Events per day and severity
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

// Counts and stores an inclusive range, a window at a time. With dryRun nothing
// is written. Returns the rows
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

// The last few finished days. Today is left out, Analytics counts it live
async function runDailyRollup(at = new Date()) {
  try {
    const yesterday = addDays(today(ROLLUP_TIME_ZONE, at), -1);
    await rollupRange(addDays(yesterday, -(RECOMPUTE_DAYS - 1)), yesterday);
  } catch (err) {
    // Picked up again on the next run, nothing is lost by skipping one
    console.error('[rollup] daily rollup failed', err);
  }
}

// Day of the first account, where a full backfill starts. Null with no accounts
async function firstDay() {
  const [row] = await User.aggregate([
    { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { joinedAt: { $ne: null } } },
    { $group: { _id: null, first: { $min: '$joinedAt' } } },
  ]);
  return row ? today(ROLLUP_TIME_ZONE, row.first) : null;
}

module.exports = { ROLLUP_TIME_ZONE, RUN_EVERY_MS, runDailyRollup, rollupRange, firstDay };