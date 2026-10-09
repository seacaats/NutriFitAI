const User = require('../../models/user/User');
const AuditLog = require('../../models/audit-logs/AuditLog');
const Meal = require('../../models/food/Meal');
const FoodScan = require('../../models/food/FoodScan');
const WaterLog = require('../../models/water/WaterLog');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const ChatMessage = require('../../models/chat/ChatMessage');
const DailyVisit = require('../../models/user/DailyVisit');
const { today, addDays, dayRangeToInstants } = require('../../utils/calendarDay');
const { sendSuccess, asyncHandler } = require('../../utils/httpResponse');

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
//
// Counts only: no names, emails or health values leave this endpoint, so
// admins and superadmins see the same thing. Days are the viewer's own
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

  const [
    roles, verified, suspended, signups, visits,
    meals7, scans7, workouts7, water7, coach7,
    audit7,
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
      { $match: { joinedAt: { $gte: start } } },
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
    Meal.countDocuments({ status: 'consumed', mealDate: { $gte: weekFrom, $lte: day } }),
    FoodScan.countDocuments({ scannedAt: { $gte: weekStartAt } }),
    WorkoutSession.countDocuments({ status: 'completed', completedAt: { $gte: weekStartAt } }),
    WaterLog.countDocuments({ loggedAt: { $gte: weekStartAt } }),
    ChatMessage.countDocuments({ role: 'user', createdAt: { $gte: weekStartAt } }),

    // The chain is the severity (models/audit-logs/AuditLog.js)
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: weekStartAt } } },
      { $group: { _id: '$chain', count: { $sum: 1 } } },
    ]),
  ]);

  const active = new Map();
  addActive(active, visits);
  const signupsByDay = Object.fromEntries(signups.map((r) => [r._id, r.count]));

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

  return sendSuccess(res, {
    data: {
      today: day,
      days: ANALYTICS_DAYS,
      accounts: {
        users: roleCounts.user || 0,
        admins: roleCounts.admin || 0,
        superadmins: roleCounts.superadmin || 0,
        verifiedUsers: verified,
        suspended,
      },
      activeUsers: { today: (active.get(day) || new Set()).size, week: activeWeek.size, month: activeMonth.size },
      daily,
      usage: { meals: meals7, scans: scans7, workouts: workouts7, waterLogs: water7, coachMessages: coach7 },
      audit: byKey(audit7),
    },
  });
});

module.exports = {
  getAnalytics,
};
