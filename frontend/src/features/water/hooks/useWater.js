import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { GLASS_ML, WATER_GOAL } from "@/shared/constants/goalOptions";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useState } from "react";

// One glass. Mirrors GLASS_ML / MIN_GOAL_ML on the backend
export { GLASS_ML };
export const MIN_GOAL_GLASSES = WATER_GOAL.minGlasses;
export const MAX_GOAL_GLASSES = WATER_GOAL.maxGlasses;

function messageOf(err, fallback) {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Today's water, the goal and the last 7 days, for the dashboard card and
// the Water page. Every write returns the fresh payload (same 7 days), so
// there's no follow-up fetch
export function useWater() {
  const days = 7;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setData(await apiClient.get(`/water?days=${days}`, { auth: true }));
      setError("");
    } catch (err) {
      setError(messageOf(err, "Couldn't load your water log."));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Wraps a write: shows saving, keeps the returned payload, reports errors.
  // Returns true on success so forms can clear themselves
  const run = useCallback(async (request, fallback) => {
    setSaving(true);
    try {
      const next = await request();
      if (next) setData(next);
      setError("");
      return true;
    } catch (err) {
      setError(messageOf(err, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // No amount = one glass
  const addWater = useCallback(
    (amountMl) => run(() => apiClient.post("/water", amountMl ? { amountMl } : {}, { auth: true }), "Couldn't log that."),
    [run],
  );

  const removeEntry = useCallback(
    (id) => run(() => apiClient.delete(`/water/${id}`, { auth: true }), "Couldn't remove that entry."),
    [run],
  );

  const setGoal = useCallback(
    (goalMl) => run(() => apiClient.put("/water/goal", { goalMl }, { auth: true }), "Couldn't save your goal."),
    [run],
  );

  const totalMl = data?.totalMl ?? 0;
  const goalMl = data?.goalMl ?? MIN_GOAL_GLASSES * GLASS_ML;

  usePullRefresh(() => {
    setData(null);
    setLoading(true);
    return refresh();
  });

  return {
    data,
    loading,
    saving,
    error,
    clearError: () => setError(""),
    totalMl,
    goalMl,
    glasses: totalMl / GLASS_ML,
    goalGlasses: goalMl / GLASS_ML,
    progress: goalMl ? Math.min(totalMl / goalMl, 1) : 0,
    addWater,
    removeEntry,
    setGoal,
    refresh,
    // The day editor saves on its own and hands back the fresh payload
    replaceData: setData,
  };
}