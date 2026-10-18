import { toLocalISODate } from "@/shared/utils/dates";

/**
 * Groups sessions under day headings
 *
 * Done client-side on an already-fetched page rather than with a $group in the
 * aggregation: grouping server-side would have to pick a timezone and would
 * break paging, since a group can straddle a page boundary. The list arrives
 * sorted newest-first, so a single pass is enough
 */
export function groupByDay(sessions) {
  const groups = [];
  let current = null;

  for (const session of sessions) {
    const key = dayKey(session.completedAt);
    if (!current || current.key !== key) {
      current = {
        key,
        date: toLocalISODate(new Date(session.completedAt)),
        label: sessionDayLabel(session.completedAt),
        sessions: [],
      };
      groups.push(current);
    }
    current.sessions.push(session);
  }

  return groups;
}

/** Local calendar day, so sessions group the way the user experienced them */
function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sessionDayLabel(iso) {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });

  // The year is included only when it is not the current one — "12 Mar" reads
  // better than "12 Mar 2026" until the distinction actually matters
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}