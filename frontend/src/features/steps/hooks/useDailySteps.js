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
 * Backs BOTH step screens -- app/(main)/steps/index.jsx and index.web.jsx -- so
 * the two cannot drift on what "daily average" or "goal days" means
 *
 * The hook owns fetching and aggregation only. It deliberately does NOT know
 * how to read a sensor: that is useStepSync's job on mobile, and impossible on
 * web. Keeping them separate is what lets the web screen use this untouched
 */

/**
 * Groups days into the buckets a range displays
 *
 * A missing day stays missing all the way through. `steps: null` means "we have
 * no data" and renders as a gap; `steps: 0` means "we asked and the answer was
 * none". Collapsing the two would make a week the user never opened the app
 * look identical to a week they spent in bed
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

  // Week and month buckets sum whatever exists inside them. A bucket with no
  // data at all stays null; a bucket with partial data reports the partial sum,
  // which is the honest number
  // Months key on "YYYY-MM": a 365-day year spans the same month name twice
  // (Oct last year and Oct now), and duplicate keys break the chart
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
  // compares against the DAILY goal like a single day does
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

  // Guards against a slow Week response landing after a fast Year response and
  // overwriting it -- the classic out-of-order fetch bug on a range selector
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
      // The range travels with its data: switching ranges re-renders before
      // the new data arrives, and bucketing old days by the new range is what
      // produced 30 bars all labelled Mon to Sun (duplicate "Thu" keys)
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
    // Averaged over days we actually have, not over the calendar window.
    // Dividing by 7 when only two days were recorded reports a slump that
    // never happened
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