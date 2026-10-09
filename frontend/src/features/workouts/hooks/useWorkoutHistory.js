import { routineForSession, useSessionDeletes } from "@/features/workouts/components/PlanPanels";
import { groupByDay } from "@/features/workouts/components/PlanParts";
import { useExerciseImages } from "@/features/workouts/hooks/useWorkoutSessions";
import { apiClient, ApiClientError, requireOnline } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
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
function useHistoryPages() {
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't load your workout history.");
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
      if (err?.status !== 0) console.warn("[workouts] failed to load more history:", err?.status, err?.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, sessions.length]);

  usePullRefresh(() => {
    setSessions([]);
    return load();
  });

  return { sessions, total, hasMore, loading, loadingMore, error, loadMore, refresh: load };
}

// Workout History, shared by web and phone: the paged sessions grouped by
// day, collapsed days, deletes, and the details dialogs
export function useWorkoutHistory() {
  // What a past session was, read-only, opened here: a routine with the
  // exercises it kept, an exercise with its catalog details
  const [viewing, setViewing] = useState(null);
  const [viewingExercise, setViewingExercise] = useState(null);
  // No details dialogs while the server can't be reached
  const openSession = (session) => {
    if (!requireOnline()) return;
    if (session.kind === "routine") setViewing(routineForSession(session));
    else setViewingExercise(session);
  };

  const { sessions, total, loading, loadingMore, hasMore, error, loadMore, refresh } = useHistoryPages();
  // Delete a session or a day, with the confirm dialog; reloads after
  const deletes = useSessionDeletes(refresh);

  const groups = groupByDay(sessions);

  // Cover images for every listed session: a routine's exercises, or the one exercise
  const imageOf = useExerciseImages(
    sessions.flatMap((s) => (s.kind === "routine" ? (s.exercises || []).map((e) => e.exerciseRef) : [s.exerciseRef])),
  );

  // Collapsed-by-key rather than expanded-by-default, so a day appended by
  // "Load more" opens on its own
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (key) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return {
    viewing, setViewing, viewingExercise, setViewingExercise, openSession,
    sessions, total, loading, loadingMore, hasMore, error, loadMore,
    deletes, groups, imageOf, collapsed, toggleGroup,
  };
}