// Display formatters for instants (audit_logs.createdAt, signup dates). Separate
// from dates.js, which handles the YYYY-MM-DD calendar-day strings

// Safe Date parse: null for empty or invalid input
function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "Oct 18, 2026, 3:04 PM"
export function formatTimestamp(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Oct 18, 2026"
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// "Oct 18"
export function formatMonthDay(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

// "3:04 PM"
export function formatClockTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}
