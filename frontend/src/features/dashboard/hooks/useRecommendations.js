import { apiClient } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The dashboard's recommendation cards, from GET /api/recommendations. The
 * server caches them for the day, so refetching on focus and on pull-to-refresh
 * only reads. Only `refresh` asks for new ones (paced by the server).
 * They're optional, so a failed load just leaves the strip out
 */
export function useRecommendations() {
  const [data, setData] = useState(null);
  // Only the first load: true until the request settles, whichever way it goes
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const errorTimer = useRef(null);

  // A failed load (e.g. the session isn't ready yet, or the server is busy
  // generating) is retried a couple of times, so the cards show up without a page refresh
  useEffect(() => {
    let live = true;
    let timer;
    const load = (attempt) => {
      apiClient
        .get("/recommendations", { auth: true })
        .then((next) => { if (live) { setData(next); setLoading(false); } })
        .catch(() => {
          if (!live) return;
          if (attempt < 2) timer = setTimeout(() => load(attempt + 1), 1500 * (attempt + 1));
          else setLoading(false);
        });
    };
    load(0);
    return () => { live = false; clearTimeout(timer); };
  }, [reloadKey]);

  // Web only: back on the tab after logging something elsewhere, pick up the new cards
  useEffect(() => {
    if (typeof document === "undefined" || !document.addEventListener) return undefined;
    const onVisible = () => { if (document.visibilityState === "visible") setReloadKey((k) => k + 1); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setReloadKey((k) => k + 1);
      focusedOnce.current = true;
    }, []),
  );

  usePullRefresh(() => setReloadKey((k) => k + 1));

  // Gone from the strip right away; the request follows
  const close = useCallback((id, status) => {
    setData((d) => d && { ...d, items: d.items.filter((i) => i.id !== id) });
    apiClient.patch(`/recommendations/${id}`, { status }, { auth: true }).catch(() => {});
  }, []);

  const rate = useCallback((id, feedback) => {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === id ? { ...i, feedback } : i)) });
    apiClient.patch(`/recommendations/${id}`, { feedback }, { auth: true }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setData(await apiClient.post("/recommendations/refresh", {}, { auth: true }));
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't refresh your recommendations.");
      // A pacing message isn't worth keeping on screen
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(""), 5000);
    } finally {
      setBusy(false);
    }
  }, []);

  return { items: data?.items || [], loading, loaded: !!data, canRefresh: !!data?.canRefresh, busy, error, close, rate, refresh };
}