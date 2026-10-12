/**
 * Calendar days as "YYYY-MM-DD" strings
 *
 *   INSTANTS    (createdAt, measuredAt, expiresAt)  -> `new Date()`
 *
 *   CALENDAR    (activityDate, effectiveFrom, ageRecordedOn) -> a string from
 *   DAYS        here. NEVER `new Date()`, and never `.toISOString().slice(0, 10)`
 * 
 */

/**
 * Intl automatically handles DST transitions
 * @param {string} [timeZone] IANA zone, e.g. "Asia/Manila". Falls back to the
 *   server's own zone, which is only correct when the user's is genuinely
 *   unknown, unless passed over user.profile.timezone
 * @param {Date} [at] the instant to resolve, defaults to now
 * @returns {string} "YYYY-MM-DD"
 */
function today(timeZone, at = new Date()) {
  // 'en-CA' formats as YYYY-MM-DD, which avoids assembling the parts by hand.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

// "YYYY-MM-DD", shared by the models and the request validators
const CALENDAR_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {boolean} returns true for a proper "YYYY-MM-DD" string */
function isCalendarDay(value) {
  return typeof value === 'string' && CALENDAR_DAY_RE.test(value);
}

// Throw to avoid hiding a bug when different formatted objects show such as Date
function assertCalendarDay(value, label = 'value') {
  if (!isCalendarDay(value)) {
    throw new Error(`${label} must be a "YYYY-MM-DD" string, received ${JSON.stringify(value)}`);
  }
  return value;
}

// Inclusive YYYY-MM-DD range -> half-open instant range, in the user's own
// timezone. Done in UTC, a 07:00 Manila workout lands on the previous day.
// longOffset rather than the local hour, which is ambiguous past +/-12
function dayRangeToInstants(from, to, timeZone) {
  assertCalendarDay(from, 'from');
  assertCalendarDay(to, 'to');

  const offsetMinutes = (day) => {
    const probe = new Date(`${day}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      timeZoneName: 'longOffset',
    }).formatToParts(probe);
    const label = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  };

  // Midnight local, expressed as an instant
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes(from));

  // Exclusive upper bound: the instant the day AFTER `to` begins
  const nextDay = new Date(`${to}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDay = nextDay.toISOString().slice(0, 10);
  const end = new Date(`${endDay}T00:00:00Z`);
  end.setUTCMinutes(end.getUTCMinutes() - offsetMinutes(endDay));

  return { start, end };
}

// A calendar day shifted by n days, still as "YYYY-MM-DD"
function addDays(day, n) {
  assertCalendarDay(day, 'day');
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Whole days from `from` to `to`, both "YYYY-MM-DD" (negative when `to` is earlier).
// Parsed at noon UTC, so neither the server's offset nor DST can shift the count
function daysBetween(from, to) {
  assertCalendarDay(from, 'from');
  assertCalendarDay(to, 'to');
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

// The Sunday that starts the week holding `day`, the same week the
// workouts summary counts against
function weekStart(day) {
  assertCalendarDay(day, 'day');
  return addDays(day, -new Date(`${day}T12:00:00Z`).getUTCDay());
}

// First day of the month holding `day`, shifted by n months
function monthStart(day, n = 0) {
  assertCalendarDay(day, 'day');
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

module.exports = { CALENDAR_DAY_RE, today, assertCalendarDay, dayRangeToInstants, addDays, daysBetween, weekStart, monthStart };