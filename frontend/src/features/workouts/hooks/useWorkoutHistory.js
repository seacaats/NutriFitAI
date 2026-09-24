import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 20;
// Scopes this screen's list to a rolling window server-side (see
// workoutsController.listSessions) so it doesn't grow unbounded as a user
// logs more sessions over time. Opt-in via `days` -- other callers of the
// same `?limit=` branch (e.g. the "5 most recent" dashboard widget) want the
// true most-recent session regardless of age, so they omit it
const HISTORY_WINDOW_DAYS = 30;

/**
 * Paginated workout history for the dedicated history screen
 *
 * Separate from useWorkoutSessions rather than an option on it. That hook is
 * mounted on three screens and loads a fixed five rows plus the weekly summary
 * on every one of them; bolting paging state onto it would mean every consumer
 * carries page cursors and a loadMore it never calls. Different lifetimes,
 * different hooks
 */
export function useWorkoutHistory() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (offset) => {
    return apiClient.get(
      `/workouts/sessions?limit=${PAGE_SIZE}&offset=${offset}&days=${HISTORY_WINDOW_DAYS}`,
      { auth: true },
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage(0);
      setSessions(data?.sessions || []);
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load your history");
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Appends the next page
   *
   * Paged by OFFSET rather than by a date cursor. Offset paging can skip or
   * repeat a row if the underlying list shifts mid-scroll, but this list only
   * grows at the head — a session is written when a workout ends and is never
   * back-dated — so a new entry appearing shifts everything down by one and the
   * worst case is seeing one row twice. A cursor would be the right call for a
   * feed with inserts in the middle; here it would be machinery for nothing
   *
   * Guards on loadingMore because a fast scroll fires onEndReached repeatedly,
   * and without it the same page loads several times and appends duplicates
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(sessions.length);
      setSessions((current) => [...current, ...(data?.sessions || [])]);
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
    } catch (err) {
      // Deliberately not surfaced: the rows already on screen are still valid,
      // and an error banner over a working list is worse than a list that
      // simply stopped growing. Scrolling again retries
      console.warn("[workouts] failed to load more history:", err?.status, err?.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, sessions.length]);

  return { sessions, total, hasMore, loading, loadingMore, error, loadMore, refresh: load };
}

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
      current = { key, label: dayLabel(session.completedAt), sessions: [] };
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

function dayLabel(iso) {
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