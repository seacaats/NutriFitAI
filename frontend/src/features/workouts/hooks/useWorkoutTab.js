import { useAuth } from "@/shared/context/AuthContext";
import { getRemembered, setRemembered } from "@/shared/utils/rememberedState";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";

export const WORKOUT_TABS = [
  { key: "browse", label: "Browse", icon: "search" },
  { key: "routines", label: "Routines", icon: "list" },
  { key: "favorites", label: "Favorites", icon: "heart" },
  { key: "upcoming", label: "Upcoming", icon: "calendar" },
  { key: "recent", label: "Recent", icon: "time" },
];

// A tab is remembered for a few hours. After that the page opens on Browse
// ("Picked for you"), the more useful start to a new session
const TAB_MEMORY_MS = 4 * 60 * 60 * 1000;
const isTab = (key) => WORKOUT_TABS.some((t) => t.key === key);

// The open tab. A link's ?tab= (a workout reminder, the dashboard's plan)
// opens that tab without being remembered; otherwise the last tab this
// account picked recently, else Browse. Unknown values are ignored
export function useWorkoutTab() {
  const userId = useAuth().user?.id;
  const { tab: linked } = useLocalSearchParams();
  const [tab, setTabState] = useState(isTab(linked) ? linked : "browse");

  useEffect(() => {
    if (isTab(linked)) {
      setTabState(linked);
      return;
    }
    getRemembered("workouts-tab", userId, TAB_MEMORY_MS).then((saved) => {
      if (isTab(saved)) setTabState(saved);
    });
  }, [linked, userId]);

  const setTab = useCallback((next) => {
    setTabState(next);
    setRemembered("workouts-tab", userId, next);
  }, [userId]);

  return [tab, setTab];
}
