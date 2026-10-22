import { routineForSession, useSessionDeletes } from "@/features/workouts/components/PlanPanels";
import { useExerciseImages } from "@/features/workouts/hooks/useWorkoutSessions";
import { groupByDay } from "@/features/workouts/utils/groupByDay";
import { apiClient, ApiClientError, requireOnline } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 20;
// Rolling window in days for workout history pagination
const HISTORY_WINDOW_DAYS = 30;

/** Paginated workout history hook for the dedicated history screen. */
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

  // Appends the next page; guards on loadingMore to avoid duplicate requests during rapid scrolling
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(sessions.length);
      setSessions((current) => [...current, ...(data?.sessions || [])]);
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
    } catch (err) {
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
  // Read-only session details
  const [viewing, setViewing] = useState(null);
  const [viewingExercise, setViewingExercise] = useState(null);
  const openSession = (session) => {
    if (!requireOnline()) return;
    if (session.kind === "routine") setViewing(routineForSession(session));
    else setViewingExercise(session);
  };

  const { sessions, total, loading, loadingMore, hasMore, error, loadMore, refresh } = useHistoryPages();
  const deletes = useSessionDeletes(refresh);

  const groups = groupByDay(sessions);

  // Cover images for listed sessions
  const imageOf = useExerciseImages(
    sessions.flatMap((s) => (s.kind === "routine" ? (s.exercises || []).map((e) => e.exerciseRef) : [s.exerciseRef])),
  );

  // Collapsed-by-key set so newly appended days remain open by default
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
