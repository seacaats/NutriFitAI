import { createContext, createElement, useContext, useEffect, useState } from "react";

// How many skeleton blocks are on screen. Shared by Skeleton.jsx and
// Skeleton.web.jsx; the layouts hide their scrollbar while any are (a first
// load, nothing saved to show yet)
let mounted = 0;
const listeners = new Set();

function track(delta) {
  const before = mounted > 0;
  mounted += delta;
  if (before !== mounted > 0) listeners.forEach((fn) => fn(mounted > 0));
}

// Skeletons outside the page body (e.g. the header's notification dropdown)
// sit under this, so loading them doesn't hide the page's scrollbar and
// shift its content sideways
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
