const { today, addDays } = require('../../utils/calendarDay');

// Weight trend and goal projection, worked out on request from the weigh-ins
// (nothing stored). A moving average smooths day-to-day noise, a regression
// over the last weeks gives the real weekly rate, and the date the target
// would be reached follows from it. It only reports against the target and
// pace the user set, it never suggests either

// Weight of the newest reading in the moving average
const ALPHA = 0.3;
// Readings fetched, so the average has settled before the rate window starts
const LOOKBACK_DAYS = 56;
// The rate comes from the last stretch of the smoothed series
const WINDOW_DAYS = 28;
// Fewer readings or a shorter span read as noise, so no trend is shown
const MIN_READINGS = 3;
const MIN_SPAN_DAYS = 7;
// Faster than this is shown as a neutral note, not a status (mirrors the
// weeklyPaceKg cap in validators/profileValidators.js)
const FAST_WEEKLY_KG = 1;
// The latest weigh-in within this of the target, or past it, counts as reached
const REACHED_KG = 0.2;
// Share of the chosen pace still counted as on track
const TOLERANCE = 0.15;
// A projection further out than this isn't shown
const MAX_PROJECTION_DAYS = 730;

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

// Whole days between two "YYYY-MM-DD"
const dayDiff = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/**
 * rows: weigh-ins, oldest first. Returns null when there's too little data,
 * otherwise { trendKg, weeklyRateKg, projectedDate, status, reached, fast, weighIns }
 * status is ahead, on_track or behind, null when no pace is set, the target
 * is reached or the change is too fast to judge
 */
function weightTrend({ rows, targetKg, paceKg, timeZone, day }) {
  // One reading a day (the last), smoothed as they go
  const byDay = new Map();
  rows.forEach((r) => byDay.set(today(timeZone, r.measuredAt), Number(r.weightKg)));
  let smooth = null;
  const points = [...byDay].map(([date, kg]) => {
    smooth = smooth === null ? kg : ALPHA * kg + (1 - ALPHA) * smooth;
    return { date, kg, smooth };
  });
  if (!points.length) return null;

  const last = points[points.length - 1];
  const recent = points.filter((p) => dayDiff(p.date, last.date) < WINDOW_DAYS);
  if (recent.length < MIN_READINGS || dayDiff(recent[0].date, last.date) < MIN_SPAN_DAYS) return null;

  // Least-squares slope of the smoothed series, kg a day
  const xs = recent.map((p) => dayDiff(recent[0].date, p.date));
  const ys = recent.map((p) => p.smooth);
  const n = recent.length;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const sumXY = sum(xs.map((x, i) => x * ys[i]));
  const slope = (n * sumXY - sum(xs) * sum(ys)) / (n * sum(xs.map((x) => x * x)) - sum(xs) ** 2);
  const weeklyRate = slope * 7;

  const remaining = targetKg == null ? null : targetKg - last.smooth;
  // Reached is judged on the latest weigh-in, not the smoothed weight, which
  // lags behind a big change
  let reached = false;
  if (targetKg != null) {
    const heading = Math.sign(targetKg - recent[0].kg);
    if (heading > 0) reached = last.kg >= targetKg - REACHED_KG;
    else if (heading < 0) reached = last.kg <= targetKg + REACHED_KG;
    else reached = Math.abs(last.kg - targetKg) <= REACHED_KG;
  }
  const fast = Math.abs(weeklyRate) > FAST_WEEKLY_KG;
  // Rate towards the target, negative when moving away from it
  const towards = remaining === null ? 0 : weeklyRate * Math.sign(remaining);

  let projectedDate = null;
  if (remaining !== null && !reached && towards > 0) {
    const days = Math.ceil((Math.abs(remaining) / towards) * 7);
    if (days <= MAX_PROJECTION_DAYS) projectedDate = addDays(day, days);
  }

  let status = null;
  if (remaining !== null && !reached && !fast && paceKg) {
    const ratio = towards / paceKg;
    status = ratio >= 1 + TOLERANCE ? 'ahead' : ratio >= 1 - TOLERANCE ? 'on_track' : 'behind';
  }

  return {
    trendKg: round(last.smooth, 1),
    weeklyRateKg: round(weeklyRate, 2),
    projectedDate,
    status,
    reached,
    fast,
    weighIns: n,
  };
}

module.exports = { weightTrend, LOOKBACK_DAYS };