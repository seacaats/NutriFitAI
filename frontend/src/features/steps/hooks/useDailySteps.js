import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  eachDay,
  monthLabel,
  rangeFor,
  RANGES,
  todayISO,
  weekdayLabel,
} from "@/shared/utils/dates";

/**
 * Backs both step screens -- app/(main)/steps/index.jsx and index.web.jsx -- so
 * the two stay consistent on daily averages and goal days.
 *
 * Handles fetching and aggregation only; sensor syncing lives in useStepSync
 * so the web screen can use this hook directly.
 */

/**
 * Groups days into the buckets a range displays.
 *
 * Missing days stay null (`steps: null` renders as a gap), distinct from a
 * recorded zero-step day (`steps: 0`).
 */
function bucketDays(days, preset, from, to) {
  const byDate = new Map(days.map((d) => [d.activityDate, d]));
  const allDates = eachDay(from, to);
  const { bucket } = RANGES[preset] || RANGES.Week;

  if (bucket === "day") {
    return allDates.map((date) => {
      const row = byDate.get(date);
      return {
        key: date,
        date,
        label: weekdayLabel(date),
        steps: row ? row.stepCount : null,
        // One day: its own count. Grouped buckets average theirs (below)
        avg: row ? row.stepCount : null,
        distanceMeters: row?.distanceMeters ?? null,
        source: row?.source ?? null,
      };
    });
  }

  // Week and month buckets sum whatever exists inside them; empty buckets stay null.
  // Months key on "YYYY-MM" since a 365-day window can span the same month name twice.
  const groups = new Map();
  allDates.forEach((date, index) => {
    const key = bucket === "week"
      ? `W${Math.floor(index / 7) + 1}`
      : date.slice(0, 7);
    const label = bucket === "week" ? key : monthLabel(date);

    if (!groups.has(key)) groups.set(key, { key, label, date, steps: null, days: 0 });
    const group = groups.get(key);

    const row = byDate.get(date);
    if (row) {
      group.steps = (group.steps ?? 0) + row.stepCount;
      group.days += 1;
    }
  });

  // Steps per day over the days that have data, so a week or month bar
  // compares against the daily goal like a single day does
  return Array.from(groups.values()).map((g) => ({
    ...g,
    avg: g.steps === null ? null : Math.round(g.steps / g.days),
  }));
}

/**
 * @param {{ initialRange?: 'Week'|'Month'|'Year' }} [options]
 */
export function useDailySteps(options = {}) {
  const [range, setRange] = useState(options.initialRange || "Week");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Guards against out-of-order responses when switching ranges
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async (preset) => {
    const requestId = ++requestIdRef.current;
    const { from, to } = rangeFor(preset);

    setLoading(true);
    setError("");

    try {
      const data = await apiClient.get(`/steps?from=${from}&to=${to}`, { auth: true });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      // Keep the preset with its data so old days aren't bucketed by a newly selected range before its fetch completes
      setPayload({ ...data, from, to, preset });
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Couldn't load your step history.",
      );
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const refresh = useCallback(() => load(range), [load, range]);

  // Pull-to-refresh: back to the first-load skeletons. The Steps screen's own
  // pull handler syncs the phone and then reloads
  usePullRefresh(() => {
    setPayload(null);
    setLoading(true);
  });

  const derived = useMemo(() => {
    const from = payload?.from ?? rangeFor(range).from;
    const to = payload?.to ?? rangeFor(range).to;
    const days = payload?.days ?? [];
    const dailyGoal = payload?.dailyGoal ?? 10000;

    const series = bucketDays(days, payload?.preset ?? range, from, to);
    const recorded = days.filter((d) => Number.isFinite(d.stepCount));

    const total = recorded.reduce((sum, d) => sum + d.stepCount, 0);
    // Averaged over recorded days rather than the full calendar window
    const average = recorded.length > 0 ? Math.round(total / recorded.length) : 0;
    const goalDays = recorded.filter((d) => d.stepCount >= dailyGoal).length;

    const today = todayISO();
    const todayRow = days.find((d) => d.activityDate === today) || null;
    const distanceMeters = recorded.reduce((sum, d) => sum + (d.distanceMeters || 0), 0);

    return {
      from,
      to,
      days,
      series,
      total,
      average,
      goalDays,
      distanceMeters,
      recordedDays: recorded.length,
      bestDay: recorded.reduce((best, d) => (d.stepCount > (best?.stepCount ?? -1) ? d : best), null),
      todaySteps: todayRow ? todayRow.stepCount : null,
      dailyGoal,
      goalPercent: todayRow ? Math.min(Math.round((todayRow.stepCount / dailyGoal) * 100), 100) : 0,
      // Recent days, newest first, for the activity list. Only real rows
      recentDays: [...recorded].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)).slice(0, 5),
      tracking: payload?.tracking ?? { source: null, connectedAt: null, lastSyncAt: null },
      hasData: recorded.length > 0,
    };
  }, [payload, range]);

  // `loaded` turns true with the first response and stays true, so screens
  // show skeletons on the first load only, not on every range switch
  return { range, setRange, ranges: Object.keys(RANGES), loading, loaded: Boolean(payload), error, refresh, ...derived };
}
