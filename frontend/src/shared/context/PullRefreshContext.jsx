import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Pull-to-refresh, and tapping the nav entry of the screen you're on. Data
// hooks register a reset-and-reload while their screen is focused; refresh()
// runs them all, so the screen goes back to its first-load skeletons, same as
// opening it. The registry holds no state on purpose: a registry change must
// never re-render the layout. Only usePullRefreshState() subscribers re-render

// Longest a refresh spinner runs. Offline, uncached loads wait for the server;
// the spinner doesn't
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
      // Silent reload, e.g. when the server comes back
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

// Registers `fn` while the screen is focused. A no-op outside the provider
export function usePullRefresh(fn) {
  const ctx = useContext(PullRefreshContext);
  const latest = useRef(fn);
  latest.current = fn;
  useFocusEffect(useCallback(() => (ctx ? ctx.add(() => latest.current?.()) : undefined), [ctx]));
}

// Registry access for a silent runAll(). null outside the provider
export function usePullRefreshRunner() {
  return useContext(PullRefreshContext);
}

// { refreshing, refresh } for a RefreshControl or a nav tap. null outside the provider
export function usePullRefreshState() {
  const ctx = useContext(PullRefreshContext);
  const [refreshing, setRefreshing] = useState(() => ctx?.isRefreshing() ?? false);
  useEffect(() => ctx?.subscribe(setRefreshing), [ctx]);
  return ctx ? { refreshing, refresh: ctx.refresh } : null;
}
