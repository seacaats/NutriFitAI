import { createContext, createElement, useContext, useEffect, useState } from "react";

// Global skeleton counter shared between native and web Skeleton components
let mounted = 0;
const listeners = new Set();

function track(delta) {
  const before = mounted > 0;
  mounted += delta;
  if (before !== mounted > 0) listeners.forEach((fn) => fn(mounted > 0));
}

// Context to exempt header/overlay skeletons from page-level scrollbar suppression
const TrackingContext = createContext(true);

export function UntrackedSkeletons({ children }) {
  return createElement(TrackingContext.Provider, { value: false }, children);
}

// Counts this skeleton block while it's mounted
export function useTrackSkeleton() {
  const tracked = useContext(TrackingContext);
  useEffect(() => {
    if (!tracked) return undefined;
    track(1);
    return () => track(-1);
  }, [tracked]);
}

export function useSkeletonsShowing() {
  const [showing, setShowing] = useState(mounted > 0);
  useEffect(() => {
    listeners.add(setShowing);
    setShowing(mounted > 0);
    return () => listeners.delete(setShowing);
  }, []);
  return showing;
}
