import { apiClient } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "3m", label: "3 Months" },
  { key: "year", label: "Year" },
];

// "YYYY-MM-DD" read at noon UTC and formatted in UTC, so the day never
// shifts with the device's own timezone
const at = (day) => new Date(`${day}T12:00:00Z`);
const fmt = (day, options) => at(day).toLocaleDateString(undefined, { timeZone: "UTC", ...options });

const PERIOD_NAMES = {
  week: ["This week", "Last week", (n) => `${n} weeks ago`],
  month: ["This month", "Last month", (n) => `${n} months ago`],
  "3m": ["Last 3 months", "The 3 months before", (n) => `${n * 3} months back`],
  year: ["This year", "Last year", (n) => `${n} years ago`],
};

export function periodTitle(period, offset) {
  const [current, previous, older] = PERIOD_NAMES[period];
  if (offset === 0) return current;
  if (offset === 1) return previous;
  return older(offset);
}

// "Sep 27 – Oct 3, 2026", "October 2026", "Aug – Oct 2026", "2026"
function rangeLabel(period, from, to) {
  if (period === "month") return fmt(from, { month: "long", year: "numeric" });
  if (period === "year") return from.slice(0, 4);
  if (period === "3m") return `${fmt(from, { month: "short" })} – ${fmt(to, { month: "short", year: "numeric" })}`;
  return `${fmt(from, { month: "short", day: "numeric" })} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" })}`;
}

// A chart label for each group, `tick` marks the ones worth printing so a
// 31-day month doesn't cram 31 labels under the chart
function bucketLabel(period, bucket, index) {
  if (period === "week") return { label: fmt(bucket.from, { weekday: "short" }), tick: true };
  if (period === "month") {
    const dayOfMonth = Number(bucket.from.slice(8));
    return { label: String(dayOfMonth), tick: dayOfMonth === 1 || dayOfMonth % 5 === 0 };
  }
  if (period === "3m") return { label: fmt(bucket.from, { month: "short", day: "numeric" }), tick: index % 2 === 0 };
  return { label: fmt(bucket.from, { month: "short" }), tick: true };
}

/**
 * The Progress page's data: one request per period, all of it from
 * GET /api/progress. Switching period or stepping back keeps the last
 * numbers on screen until the new ones land (`loading`); only the very
 * first load has nothing to show (`loaded` false, the skeletons).
 * Refetches quietly whenever the screen comes back into focus, so a meal or
 * workout logged elsewhere shows up without a manual refresh
 */
export function useProgress() {
  const [period, setPeriodState] = useState("week");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Only the latest request may write, a slow older one is dropped
  const requestRef = useRef(0);

  useEffect(() => {
    const id = ++requestRef.current;
    setLoading(true);
    setError("");
    apiClient
      .get(`/progress?period=${period}&offset=${offset}`, { auth: true })
      .then((next) => { if (id === requestRef.current) setData(next); })
      .catch((err) => { if (id === requestRef.current) setError(err?.message || "Couldn't load your progress."); })
      .finally(() => { if (id === requestRef.current) setLoading(false); });
  }, [period, offset, reloadKey]);

  // Skips the first focus, the effect above already covers it
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setReloadKey((k) => k + 1);
      focusedOnce.current = true;
    }, []),
  );

  const setPeriod = useCallback((next) => {
    setPeriodState(next);
    setOffset(0);
  }, []);
  const older = useCallback(() => setOffset((o) => Math.min(o + 1, 520)), []);
  const newer = useCallback(() => setOffset((o) => Math.max(o - 1, 0)), []);

  const view = useMemo(() => {
    if (!data) return null;
    const { totals, targets, goals, buckets, weight } = data;
    // Days only count once they've happened, a period in progress stops at today
    const past = buckets.filter((b) => b.days > 0);
    const perDay = data.period === "3m" || data.period === "year";

    // Calories per day, or for 3 months and a year (grouped by week and
    // month) the average per logged day, so every point reads against the
    // daily goal
    const calories = past.map((b, i) => ({
      ...bucketLabel(data.period, b, i),
      value: perDay ? (b.mealDays ? Math.round(b.caloriesKcal / b.mealDays) : 0) : b.caloriesKcal,
    }));

    // Share of calories, not of grams: a gram of fat is 9 kcal, the others 4
    const macroKcal = { protein: totals.proteinG * 4, carbs: totals.carbsG * 4, fat: totals.fatG * 9 };
    const macroSum = macroKcal.protein + macroKcal.carbs + macroKcal.fat;
    const share = (k) => (macroSum ? Math.round((macroKcal[k] / macroSum) * 100) : 0);

    return {
      title: periodTitle(data.period, data.offset),
      range: rangeLabel(data.period, data.from, data.to),
      perDay,
      calories,
      caloriesAverage: totals.mealDays ? Math.round(totals.caloriesKcal / totals.mealDays) : 0,
      macros: [
        { key: "protein", label: "Protein", grams: totals.proteinG, percent: share("protein") },
        { key: "carbs", label: "Carbs", grams: totals.carbsG, percent: share("carbs") },
        { key: "fat", label: "Fat", grams: totals.fatG, percent: share("fat") },
      ],
      hasMacros: macroSum > 0,
      workouts: past.map((b, i) => ({ ...bucketLabel(data.period, b, i), value: b.workouts })),
      weightPoints: weight.points.map((p) => ({ label: fmt(p.date, { month: "short", day: "numeric" }), value: p.weightKg })),
      weight,
      totals,
      targets,
      goals,
      streak: data.streak,
    };
  }, [data]);

  // Pull-to-refresh on the phone: back to the skeletons, then reload
  usePullRefresh(() => {
    setData(null);
    setReloadKey((k) => k + 1);
  });

  return {
    period,
    setPeriod,
    offset,
    older,
    newer,
    canGoNewer: offset > 0,
    data,
    view,
    loaded: !!data,
    loading,
    error,
    // Quiet refetch, after the weight target is changed
    reload: () => setReloadKey((k) => k + 1),
  };
}
/**
 * The dashboard's data, from GET /api/progress/today: today's food, steps
 * and next workout, the last 7 days, 30 days of weight and the streak.
 * Water and the weekly workout count come from useWater and
 * useWorkoutSessions, which the dashboard already uses. Refetches on focus,
 * like useProgress
 */
export function useDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    apiClient
      .get("/progress/today", { auth: true })
      .then((next) => { if (live) { setData(next); setError(""); } })
      .catch((err) => { if (live) setError(err?.message || "Couldn't load your dashboard."); });
    return () => { live = false; };
  }, [reloadKey]);

  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setReloadKey((k) => k + 1);
      focusedOnce.current = true;
    }, []),
  );

  const view = useMemo(() => {
    if (!data) return null;
    const { nutrition, week, weight } = data;
    // Share of calories, as on Progress: fat is 9 kcal a gram, the others 4
    const kcal = { protein: nutrition.proteinG * 4, carbs: nutrition.carbsG * 4, fat: nutrition.fatG * 9 };
    const sum = kcal.protein + kcal.carbs + kcal.fat;
    const share = (k) => (sum ? Math.round((kcal[k] / sum) * 100) : 0);
    const logged = week.filter((d) => d.caloriesKcal > 0);

    return {
      ...data,
      macros: [
        { key: "protein", label: "Protein", grams: nutrition.proteinG, goal: data.goals?.dailyProteinG ?? null, percent: share("protein") },
        { key: "carbs", label: "Carbs", grams: nutrition.carbsG, goal: data.goals?.dailyCarbsG ?? null, percent: share("carbs") },
        { key: "fat", label: "Fat", grams: nutrition.fatG, goal: data.goals?.dailyFatG ?? null, percent: share("fat") },
      ],
      hasMacros: sum > 0,
      // Daily calorie target from the Food Scanner, null when not set
      goalKcal: data.goals?.dailyCaloriesKcal ?? null,
      caloriesWeek: week.map((d) => ({ label: fmt(d.day, { weekday: "short" }), value: d.caloriesKcal })),
      // Average over days with food logged, so an empty day doesn't drag it down
      caloriesAverage: logged.length ? Math.round(logged.reduce((s, d) => s + d.caloriesKcal, 0) / logged.length) : 0,
      weightPoints: weight.points.map((p) => ({ label: fmt(p.date, { month: "short", day: "numeric" }), value: p.weightKg })),
      mealsLogged: data.meals.filter((m) => m.count > 0).length,
    };
  }, [data]);

  usePullRefresh(() => {
    setData(null);
    setReloadKey((k) => k + 1);
  });

  return { view, loaded: !!data, error, reload: () => setReloadKey((k) => k + 1) };
}