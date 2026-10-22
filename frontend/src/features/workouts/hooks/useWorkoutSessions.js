import {
  addFavorite,
  createRoutine,
  deleteRoutine,
  fetchExerciseInfoPage,
  fetchFavorites,
  fetchRoutines,
  fetchSchedule,
  getExerciseImages,
  logRoutineSession,
  removeFavorite,
  rescheduleWorkout,
  scheduleWorkout,
  unscheduleWorkout,
  updateRoutine,
} from "@/features/workouts/hooks/useWorkoutApi";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useMemo, useState } from "react";

// exerciseRef -> first image URL cache shared across the session
const imageCache = new Map();
const IMAGE_BATCH = 60; // catalog batch limit

export function evictExerciseImage(ref) {
  imageCache.delete(Number(ref));
}

// Fetches missing exercise images in batches
export function useExerciseImages(refs) {
  const key = [...new Set((refs || []).filter(Boolean).map(Number))].sort((a, b) => a - b).join(",");
  const [, setVersion] = useState(0);

  useEffect(() => {
    const missing = key ? key.split(",").map(Number).filter((id) => !imageCache.has(id)) : [];
    if (!missing.length) return undefined;
    let cancelled = false;

    (async () => {
      for (let i = 0; i < missing.length; i += IMAGE_BATCH) {
        const ids = missing.slice(i, i + IMAGE_BATCH);
        try {
          const page = await fetchExerciseInfoPage({ ids, limit: IMAGE_BATCH, includeImageless: true });
          for (const info of page.results || []) imageCache.set(Number(info.id), getExerciseImages(info)[0] || null);
        } catch {
          continue;
        }
        for (const id of ids) if (!imageCache.has(id)) imageCache.set(id, null);
      }
      if (!cancelled) setVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return (ref) => imageCache.get(Number(ref)) || null;
}

/** Workout session logging and weekly progress hook. */
export function useWorkoutSessions({ recentLimit = 5 } = {}) {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);

  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't load your workout progress.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [recentLimit]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  /** Logs a finished or abandoned session; does not throw on error. */
  const logSession = useCallback(
    async (payload) => {
      try {
        const data = await apiClient.post("/workouts/sessions", payload, { auth: true });
        loadSummary();
        return data;
      } catch (err) {
        if (err?.status !== 0) console.warn(
          `[workouts] failed to log session (status ${err?.status ?? "network"}, ${err?.code ?? "?"}): ${err?.message}`,
          payload,
        );
        return null;
      }
    },
    [loadSummary],
  );

  /** Fetches recent history for a single exercise. */
  const fetchExerciseHistory = useCallback(async (exerciseRef, limit = 5) => {
    if (!exerciseRef) return null;
    try {
      return await apiClient.get(
        `/workouts/sessions?exerciseRef=${exerciseRef}&limit=${limit}`,
        { auth: true },
      );
    } catch (err) {
      if (err?.status !== 0) console.warn("[workouts] failed to load exercise history:", err?.status, err?.message);
      return null;
    }
  }, []);

  usePullRefresh(() => {
    setSummary(null);
    setRecent([]);
    return loadSummary();
  });

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

// Favorites, routines and the 7-day schedule for the Workouts page.
// One hook for both web and native so the two screens stay in step

// "exercise:73" / "routine:66f…", the lookup key for the ♥ state
const favKey = (kind, refId) => `${kind}:${refId}`;

function messageOf(err, fallback) {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function useWorkoutPlan() {
  const [favorites, setFavorites] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fav, rout, sched] = await Promise.all([fetchFavorites(), fetchRoutines(), fetchSchedule()]);
      setFavorites(fav);
      setRoutines(rout);
      setSchedule(sched);
      setError("");
    } catch (err) {
      setError(messageOf(err, "Couldn't load your plan."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((f) => favKey(f.kind, f.refId))),
    [favorites],
  );

  const isFavorite = useCallback(
    (kind, refId) => favoriteKeys.has(favKey(kind, String(refId))),
    [favoriteKeys],
  );

  // Optimistic: the heart flips immediately and rolls back on failure
  const toggleFavorite = useCallback(async ({ kind, refId, name }) => {
    const id = String(refId);
    const wasFavorite = favoriteKeys.has(favKey(kind, id));
    const previous = favorites;

    setFavorites((current) => (wasFavorite
      ? current.filter((f) => !(f.kind === kind && f.refId === id))
      : [{ id: `local-${kind}-${id}`, kind, refId: id, name, createdAt: new Date().toISOString() }, ...current]));

    try {
      if (wasFavorite) await removeFavorite(kind, id);
      else await addFavorite({ kind, refId: id, name });
      return true;
    } catch (err) {
      setFavorites(previous);
      setError(messageOf(err, "Couldn't update favorites."));
      return false;
    }
  }, [favoriteKeys, favorites]);

  // Throws with the server's message, so the editor can show it inline
  const saveRoutine = useCallback(async (routine) => {
    const body = {
      title: routine.title,
      description: routine.description || null,
      estimatedDurationMinutes: routine.estimatedDurationMinutes || null,
      exercises: routine.exercises.map(({ exerciseRef, exerciseName, targetSets, targetReps }) => ({
        exerciseRef, exerciseName, targetSets, targetReps,
      })),
    };
    const saved = routine.id ? await updateRoutine(routine.id, body) : await createRoutine(body);
    await refresh();
    return saved;
  }, [refresh]);

  const removeRoutine = useCallback(async (id) => {
    await deleteRoutine(id);
    await refresh();
  }, [refresh]);

  // Throws with the server's message (e.g. outside the 7-day window)
  const schedule7 = useCallback(async (body) => {
    const planned = await scheduleWorkout(body);
    setSchedule((current) =>
      [...current, planned].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)));
    return planned;
  }, []);

  // Throws with the server's message, like scheduling
  const reschedule = useCallback(async (id, scheduledFor) => {
    const moved = await rescheduleWorkout(id, scheduledFor);
    setSchedule((current) => current
      .map((s) => (s.id === id ? { ...s, ...moved } : s))
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)));
    return moved;
  }, []);

  const unschedule = useCallback(async (id) => {
    const previous = schedule;
    setSchedule((current) => current.filter((s) => s.id !== id));
    try {
      await unscheduleWorkout(id);
    } catch (err) {
      setSchedule(previous);
      setError(messageOf(err, "Couldn't remove that session."));
    }
  }, [schedule]);

  // Logs a routine run without throwing
  const logRoutine = useCallback(async (payload) => {
    try {
      const data = await logRoutineSession(payload);
      if (payload.plannedId) setSchedule((current) => current.filter((s) => s.id !== payload.plannedId));
      return data;
    } catch (err) {
      if (err?.status !== 0) console.warn("[workouts] failed to log routine:", err?.status, err?.message);
      return null;
    }
  }, []);

  // A scheduled single exercise was logged elsewhere (the tracker); drop it here
  const markPlannedDone = useCallback((plannedId) => {
    setSchedule((current) => current.filter((s) => s.id !== plannedId));
  }, []);

  usePullRefresh(() => {
    setFavorites([]);
    setRoutines([]);
    setSchedule([]);
    return refresh();
  });

  return {
    favorites,
    routines,
    schedule,
    loading,
    error,
    clearError: () => setError(""),
    refresh,
    isFavorite,
    toggleFavorite,
    saveRoutine,
    removeRoutine,
    scheduleWorkout: schedule7,
    reschedule,
    unschedule,
    logRoutine,
    markPlannedDone,
  };
}
