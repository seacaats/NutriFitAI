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

/** @returns {boolean} returns true for a proper "YYYY-MM-DD" string */
function isCalendarDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Throw to avoid hiding a bug when different formatted objects show such as Date
function assertCalendarDay(value, label = 'value') {
  if (!isCalendarDay(value)) {
    throw new Error(`${label} must be a "YYYY-MM-DD" string, received ${JSON.stringify(value)}`);
  }
  return value;
}

module.exports = { today, isCalendarDay, assertCalendarDay };