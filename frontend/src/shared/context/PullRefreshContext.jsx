import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Pull-to-refresh and active nav tab refresh registry.
// Screens register reset-and-reload callbacks while focused.

// Maximum duration for a pull-to-refresh spinner
const PULL_MAX_MS = 8000;

const PullRefreshContext = createContext(null);

export function PullRefreshProvider({ children }) {
  const fns = useRef(new Set());
  const listeners = useRef(new Set());
  const refreshing = useRef(false);
  const value = useMemo(() => {
    const setRefreshing = (on) => {
      refreshing.current = on;
      listeners.current.forEach((fn) => fn(on));
    };
    const runAll = () => Promise.allSettled([...fns.current].map((fn) => fn()));
    return {
      add(fn) {
        fns.current.add(fn);
        return () => fns.current.delete(fn);
      },
      // Silent reload across registered callbacks
      runAll,
      // Reload with the spinner showing
      async refresh() {
        if (refreshing.current) return;
        setRefreshing(true);
        await Promise.race([runAll(), new Promise((r) => setTimeout(r, PULL_MAX_MS))]);
        setRefreshing(false);
      },
      subscribe(fn) {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      isRefreshing: () => refreshing.current,
    };
  }, []);
  return <PullRefreshContext.Provider value={value}>{children}</PullRefreshContext.Provider>;
}

// Registers callback while the screen is focused
export function usePullRefresh(fn) {
  const ctx = useContext(PullRefreshContext);
  const latest = useRef(fn);
  latest.current = fn;
  useFocusEffect(useCallback(() => (ctx ? ctx.add(() => latest.current?.()) : undefined), [ctx]));
}

// Registry access for silent reloads
export function usePullRefreshRunner() {
  return useContext(PullRefreshContext);
}

// Returns { refreshing, refresh } for refresh indicators
export function usePullRefreshState() {
  const ctx = useContext(PullRefreshContext);
  const [refreshing, setRefreshing] = useState(() => ctx?.isRefreshing() ?? false);
  useEffect(() => ctx?.subscribe(setRefreshing), [ctx]);
  return ctx ? { refreshing, refresh: ctx.refresh } : null;
}
