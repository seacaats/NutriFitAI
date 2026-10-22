const { today, addDays } = require('../../utils/calendarDay');

// Computes smoothed weight trend, weekly rate via linear regression, and target projection date.

const ALPHA = 0.3;
const LOOKBACK_DAYS = 56;
const WINDOW_DAYS = 28;
const MIN_READINGS = 3;
const MIN_SPAN_DAYS = 7;
const FAST_WEEKLY_KG = 1;
const REACHED_KG = 0.2;
const TOLERANCE = 0.15;
const MAX_PROJECTION_DAYS = 730;

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

const dayDiff = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/**
 * `rows`: weigh-ins ordered oldest first.
 * Returns null if insufficient data, or { trendKg, weeklyRateKg, projectedDate, status, reached, fast, weighIns }.
 */
function weightTrend({ rows, targetKg, paceKg, timeZone, day }) {
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

  // Least-squares slope of the smoothed series (kg/day)
  const xs = recent.map((p) => dayDiff(recent[0].date, p.date));
  const ys = recent.map((p) => p.smooth);
  const n = recent.length;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const sumXY = sum(xs.map((x, i) => x * ys[i]));
  const slope = (n * sumXY - sum(xs) * sum(ys)) / (n * sum(xs.map((x) => x * x)) - sum(xs) ** 2);
  const weeklyRate = slope * 7;

  const remaining = targetKg == null ? null : targetKg - last.smooth;
  let reached = false;
  if (targetKg != null) {
    const heading = Math.sign(targetKg - recent[0].kg);
    if (heading > 0) reached = last.kg >= targetKg - REACHED_KG;
    else if (heading < 0) reached = last.kg <= targetKg + REACHED_KG;
    else reached = Math.abs(last.kg - targetKg) <= REACHED_KG;
  }
  const fast = Math.abs(weeklyRate) > FAST_WEEKLY_KG;
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
