import { apiClient } from "@/shared/api/apiClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// "YYYY-MM-DD" read at noon UTC, so the label never shifts a day
const label = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" });

/**
 * The Analytics page's data, from GET /admin/analytics. Counts only, the
 * same for every admin. `refresh` re-reads on demand; the page
 * doesn't poll
 */
export function useAdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Only the latest request may write
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await apiClient.get("/admin/analytics", { auth: true });
      if (id === requestId.current) {
        setData(next);
        setError("");
      }
    } catch (err) {
      if (id === requestId.current) setError(err?.message || "Couldn't load analytics.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Chart series. Every 5th label printed, so 30 days stay readable
  const view = useMemo(() => {
    if (!data) return null;
    const series = (key) => data.daily.map((d, i) => ({ label: i % 5 === 0 ? label(d.day) : "", tip: label(d.day), value: d[key] }));
    return {
      ...data,
      activeSeries: series("activeUsers"),
      signupSeries: series("signups"),
      signupsTotal: data.daily.reduce((s, d) => s + d.signups, 0),
    };
  }, [data]);

  return { view, loading, error, refresh };
}