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

// Tab persistence window before reverting to default Browse tab
const TAB_MEMORY_MS = 4 * 60 * 60 * 1000;
const isTab = (key) => WORKOUT_TABS.some((t) => t.key === key);

// Resolves active tab from query parameter, cached state, or default
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
