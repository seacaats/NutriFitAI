import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useState } from "react";

/**
 * Workout session logging and weekly progress
 *
 * Sessions are written ONCE, when a workout ends — not on start, and not per
 * set. See the model for the full reasoning; the short version is that the
 * tracker has no resume affordance, so a session opened on Start would be an
 * orphan nothing can finish
 */
export function useWorkoutSessions({ recentLimit = 5 } = {}) {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);

  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      /**
       * Both in parallel. They are independent reads and the screen shows them
       * together, so serialising would add a round trip to first paint for no
       * reason — and on a cluster capped at 100 ops/sec, needless round trips
       * are worth avoiding as a habit
       */
      const [summaryData, recentData] = await Promise.all([
        apiClient.get("/workouts/sessions/summary", { auth: true }),
        apiClient.get(`/workouts/sessions?limit=${recentLimit}`, { auth: true }),
      ]);

      setSummary(summaryData);
      setRecent(recentData?.sessions || []);
      setTotalSessions(recentData?.total ?? 0);
      setError(null);
      return summaryData;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load workout progress");
      return null;
    } finally {
      setLoading(false);
    }
  }, [recentLimit]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  /**
   * Logs a finished or abandoned session
   *
   * Never throws. A failed log must not cost the user their workout screen —
   * they have already done the exercise, and an error dialog at that moment is
   * the least useful possible response
   */
  const logSession = useCallback(
    async (payload) => {
      try {
        const data = await apiClient.post("/workouts/sessions", payload, { auth: true });
        // Refresh so the dashboard and goal progress reflect the new session
        // without the user having to navigate away and back
        loadSummary();
        return data;
      } catch (err) {
        /**
         * Swallowed on purpose -- the user has already done the exercise, and
         * an error dialog at that moment is the least useful possible response
         */
        console.warn(
          `[workouts] failed to log session (status ${err?.status ?? "network"}, ${err?.code ?? "?"}): ${err?.message}`,
          payload,
        );
        return null;
      }
    },
    [loadSummary],
  );

  /**
   * This user's history for one exercise, for the "last performed" line
   *
   * Not folded into the main load: it is per-exercise and only wanted once a
   * detail view opens, so fetching it up front would be one request per card
   * on a screen showing twenty. Returns null rather than throwing
   */
  const fetchExerciseHistory = useCallback(async (exerciseRef, limit = 5) => {
    if (!exerciseRef) return null;
    try {
      return await apiClient.get(
        `/workouts/sessions?exerciseRef=${exerciseRef}&limit=${limit}`,
        { auth: true },
      );
    } catch (err) {
      console.warn("[workouts] failed to load exercise history:", err?.status, err?.message);
      return null;
    }
  }, []);

  return {
    summary,
    recent,
    totalSessions,
    loading,
    error,
    logSession,
    fetchExerciseHistory,
    refresh: loadSummary,
  };
}