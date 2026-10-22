const User = require('../../models/user/User');
const AuditLog = require('../../models/audit-logs/AuditLog');
const Meal = require('../../models/food/Meal');
const FoodScan = require('../../models/food/FoodScan');
const WaterLog = require('../../models/water/WaterLog');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const ChatMessage = require('../../models/chat/ChatMessage');
const DailyVisit = require('../../models/user/DailyVisit');
const DailyRollup = require('../../models/analytics/DailyRollup');
const ActivationFunnel = require('../../models/analytics/ActivationFunnel');
const { ROLLUP_TIME_ZONE } = require('../../services/analytics/dailyRollup');
const { today, addDays, dayRangeToInstants } = require('../../utils/calendarDay');
const { sendSuccess, asyncHandler } = require('../../utils/httpResponse');

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
//
// Counts only: no names, emails or health values leave this endpoint, so
// every admin sees the same thing. Days are the viewer's own
// (X-Timezone), the same rule the user screens follow
const ANALYTICS_DAYS = 30;

// { "2026-10-04": Set(userIds) } from rows of { _id: { day, userId } }
function addActive(map, rows) {
  for (const { _id } of rows) {
    if (!map.has(_id.day)) map.set(_id.day, new Set());
    map.get(_id.day).add(_id.userId);
  }
}

// Instant -> "YYYY-MM-DD" in the viewer's zone, inside an aggregation
const dayOf = (field, timeZone) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: timeZone } });

// GET /api/admin/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  const timeZone = req.timeZone || 'UTC';
  const day = today(timeZone);
  const from = addDays(day, -(ANALYTICS_DAYS - 1));
  const weekFrom = addDays(day, -6);
  const { start } = dayRangeToInstants(from, day, timeZone);
  const weekStartAt = dayRangeToInstants(weekFrom, day, timeZone).start;

  // Past days come from the daily rollup when it holds every one of them and
  // the viewer is in its zone, so only today is counted live. Otherwise
  // everything is counted live, as before
  const yesterday = addDays(day, -1);
  const rolled = timeZone === ROLLUP_TIME_ZONE ? await DailyRollup.findRange(from, yesterday) : [];
  const fromRollup = rolled.length === ANALYTICS_DAYS - 1;
  const rolledByDay = Object.fromEntries(rolled.map((r) => [r.day, r]));
  // Where the live counts start
  const liveStart = fromRollup ? dayRangeToInstants(day, day, timeZone).start : start;
  const liveWeekFrom = fromRollup ? day : weekFrom;
  const liveWeekStartAt = fromRollup ? liveStart : weekStartAt;
  // Rows from before audit events were rolled up have none: count those live
  const auditRolled = fromRollup && rolled.every((r) => r.audit);
  const liveAuditStartAt = auditRolled ? liveStart : weekStartAt;

  const [
    roles, verified, suspended, signups, visits,
    meals7, scans7, workouts7, water7, coach7,
    audit7, activation,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'user', emailVerifiedAt: { $ne: null } }),
    User.countDocuments({ suspendedAt: { $ne: null } }),
    // Accounts created per day. createdAt is converted first: rows brought
    // over from the old database can hold it as a string, which a plain date
    // comparison never matches (signups read 0)
    User.aggregate([
      { $match: { role: 'user' } },
      { $addFields: { joinedAt: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } } } },
      { $match: { joinedAt: { $gte: liveStart } } },
      { $group: { _id: dayOf('$joinedAt', timeZone), count: { $sum: 1 } } },
    ]),

    // Who opened the app, per day: one row per user per day (DailyVisit,
    // written on signed-in requests). Logging isn't needed to count, and a
    // step sync filling in past days no longer does
    DailyVisit.aggregate([
      { $match: { day: { $gte: from, $lte: day } } },
      { $group: { _id: { day: '$day', userId: '$userId' } } },
    ]),

    // Feature use, last 7 days
    Meal.countDocuments({ status: 'consumed', mealDate: { $gte: liveWeekFrom, $lte: day } }),
    FoodScan.countDocuments({ scannedAt: { $gte: liveWeekStartAt } }),
    WorkoutSession.countDocuments({ status: 'completed', completedAt: { $gte: liveWeekStartAt } }),
    WaterLog.countDocuments({ loggedAt: { $gte: liveWeekStartAt } }),
    ChatMessage.countDocuments({ role: 'user', createdAt: { $gte: liveWeekStartAt } }),

    // The chain is the severity (models/audit-logs/AuditLog.js)
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: liveAuditStartAt } } },
      { $group: { _id: '$chain', count: { $sum: 1 } } },
    ]),

    // How far new accounts get, counted by services/analytics/activationFunnel.js. Null
    // until its first run
    ActivationFunnel.findLatest(),
  ]);

  const active = new Map();
  addActive(active, visits);
  const signupsByDay = Object.fromEntries(signups.map((r) => [r._id, r.count]));
  if (fromRollup) rolled.forEach((r) => { signupsByDay[r.day] = r.signups; });

  // The week's rolled-up days, added to today's live count
  const rolledWeek = (key) => {
    let sum = 0;
    if (fromRollup) for (let d = weekFrom; d <= yesterday; d = addDays(d, 1)) sum += rolledByDay[d]?.[key] || 0;
    return sum;
  };

  // One row per day, oldest first, zeros included so the charts don't skip
  const daily = [];
  const activeWeek = new Set();
  const activeMonth = new Set();
  for (let d = from; d <= day; d = addDays(d, 1)) {
    const users = active.get(d) || new Set();
    users.forEach((id) => {
      activeMonth.add(id);
      if (d >= weekFrom) activeWeek.add(id);
    });
    daily.push({ day: d, activeUsers: users.size, signups: signupsByDay[d] || 0 });
  }

  const byKey = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const roleCounts = byKey(roles);

  // The week's rolled-up audit events, added to today's live count
  const audit = byKey(audit7);
  if (auditRolled) {
    for (let d = weekFrom; d <= yesterday; d = addDays(d, 1)) {
      for (const [chain, n] of Object.entries(rolledByDay[d].audit)) audit[chain] = (audit[chain] || 0) + n;
    }
  }

  return sendSuccess(res, {
    data: {
      today: day,
      days: ANALYTICS_DAYS,
      accounts: {
        users: roleCounts.user || 0,
        admins: roleCounts.admin || 0,
        verifiedUsers: verified,
        suspended,
      },
      activeUsers: { today: (active.get(day) || new Set()).size, week: activeWeek.size, month: activeMonth.size },
      daily,
      usage: {
        meals: meals7 + rolledWeek('meals'),
        scans: scans7 + rolledWeek('scans'),
        workouts: workouts7 + rolledWeek('workouts'),
        waterLogs: water7 + rolledWeek('waterLogs'),
        coachMessages: coach7 + rolledWeek('coachMessages'),
      },
      audit,
      activation,
    },
  });
});

module.exports = {
  getAnalytics,
};