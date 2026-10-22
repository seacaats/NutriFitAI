/**
 * Calendar day utilities ("YYYY-MM-DD" strings).
 * Use `new Date()` for instants (createdAt, measuredAt, expiresAt) and
 * strings from this module for calendar days (activityDate, effectiveFrom, ageRecordedOn).
 */

/**
 * Resolves the current or given instant to a "YYYY-MM-DD" string in the specified IANA timezone.
 * @param {string} [timeZone]
 * @param {Date} [at]
 * @returns {string} "YYYY-MM-DD"
 */
function today(timeZone, at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

const CALENDAR_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {boolean} */
function isCalendarDay(value) {
  return typeof value === 'string' && CALENDAR_DAY_RE.test(value);
}

function assertCalendarDay(value, label = 'value') {
  if (!isCalendarDay(value)) {
    throw new Error(`${label} must be a "YYYY-MM-DD" string, received ${JSON.stringify(value)}`);
  }
  return value;
}

// Converts an inclusive YYYY-MM-DD range into a half-open [start, end) instant range in `timeZone`
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

  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes(from));

  const nextDay = new Date(`${to}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDay = nextDay.toISOString().slice(0, 10);
  const end = new Date(`${endDay}T00:00:00Z`);
  end.setUTCMinutes(end.getUTCMinutes() - offsetMinutes(endDay));

  return { start, end };
}

function addDays(day, n) {
  assertCalendarDay(day, 'day');
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Whole days between two "YYYY-MM-DD" strings (negative when `to` is earlier)
function daysBetween(from, to) {
  assertCalendarDay(from, 'from');
  assertCalendarDay(to, 'to');
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

// Sunday starting the week containing `day`
function weekStart(day) {
  assertCalendarDay(day, 'day');
  return addDays(day, -new Date(`${day}T12:00:00Z`).getUTCDay());
}

// First day of the month containing `day`, shifted by n months
function monthStart(day, n = 0) {
  assertCalendarDay(day, 'day');
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

module.exports = { CALENDAR_DAY_RE, today, assertCalendarDay, dayRangeToInstants, addDays, daysBetween, weekStart, monthStart };
