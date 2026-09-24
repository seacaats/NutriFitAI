/**
 * Calendar-date helpers for step tracking.
 *
 * Every date in this feature is a plain "YYYY-MM-DD" string in the USER'S local
 * timezone, and it stays a string from the phone all the way into the
 * daily_steps.activity_date column.
 *
 * The tempting shortcut -- `new Date().toISOString().slice(0, 10)` -- is wrong
 * here, because toISOString converts to UTC first. At UTC+8 that files
 * everything after 4pm under the previous day, so an evening walk lands on
 * yesterday. Every function below therefore uses the local getFullYear /
 * getMonth / getDate triple instead.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date of a Date object, as YYYY-MM-DD. */
export function toLocalISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today, in the user's own timezone. */
export function todayISO() {
  return toLocalISODate(new Date());
}

/**
 * Shifts an ISO date string by whole days.
 *
 * Constructed via the local Date constructor (not Date.parse of the string,
 * which treats a bare date as UTC), and `setDate` handles month, year and
 * leap-day rollover for us.
 */
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
}

/** Whole days between two ISO dates. Positive when `to` is later. */
export function daysBetween(fromISO, toISO) {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / MS_PER_DAY);
}

/** Every date from `from` to `to` inclusive, so gaps can be rendered as gaps. */
export function eachDay(fromISO, toISO) {
  const out = [];
  let cursor = fromISO;
  // Lexical comparison is safe on zero-padded ISO dates and avoids reparsing.
  while (cursor <= toISO) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * The ranges the step screens offer.
 *
 * `syncDays` is separate from the display range on purpose: the chart may show
 * a year, but a sync only ever needs to re-read the recent window, and iOS only
 * retains seven days of pedometer history anyway.
 */
export const RANGES = {
  Week: { days: 7, bucket: "day" },
  Month: { days: 30, bucket: "week" },
  Year: { days: 365, bucket: "month" },
};

/** Inclusive {from, to} for a named range, ending today. */
export function rangeFor(preset) {
  const to = todayISO();
  const { days } = RANGES[preset] || RANGES.Week;
  return { from: addDays(to, -(days - 1)), to };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekdayLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function monthLabel(isoDate) {
  const [, m] = isoDate.split("-").map(Number);
  return MONTHS[m - 1];
}

/** "Today", "Yesterday", or "Sep 8" — for the recent-days list. */
export function friendlyDate(isoDate) {
  const today = todayISO();
  if (isoDate === today) return "Today";
  if (isoDate === addDays(today, -1)) return "Yesterday";
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}
