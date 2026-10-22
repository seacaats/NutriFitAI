import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for admin moderation queue.
 *
 * @param {{ limit?: number }} options
 */

// Auth options with full response envelope
const options = { auth: true, full: true };

const NO_FILTERS = { kind: null, category: null, days: null, repeat: false, subject: null };

export function useAdminImageReviews({ limit = 25 } = {}) {
  const [tab, setTab] = useState("review");
  const [page, setPage] = useState(1);
  // Combined filter state
  const [filters, setFilters] = useState(NO_FILTERS);

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Request counter to guard against out-of-order async responses
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ tab, page: String(page), limit: String(limit) });
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.category) params.set("category", filters.category);
    if (filters.days) params.set("days", String(filters.days));
    if (filters.repeat) params.set("repeat", "true");
    if (filters.subject) params.set("userId", filters.subject.id);
    try {
      const data = await apiClient.get(`/admin/image-reviews?${params.toString()}`, { auth: true });
      if (id !== requestId.current) return;

      setRows(data.rows || []);
      setCounts(data.counts || null);
      setPagination(data.pagination || { page: 1, pageCount: 1, total: 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Couldn't load this list.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [tab, page, limit, filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 on tab change
  const updateTab = useCallback((value) => {
    setTab(value);
    setPage(1);
  }, []);

  // Reset to page 1 on filter update
  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setFilters(NO_FILTERS);
    setPage(1);
  }, []);
  const hasFilters = Object.keys(NO_FILTERS).some((k) => filters[k] !== NO_FILTERS[k]);

  // Returns action result payload
  const runAction = useCallback(
    async (request, fallback) => {
      try {
        const payload = await request();
        await load();
        return { ok: true, message: payload.message || "Done" };
      } catch (err) {
        return { ok: false, message: err instanceof ApiClientError ? err.message : fallback };
      }
    },
    [load],
  );

  // Fetches audited temporary image URL on demand
  const viewUrl = useCallback(async (id) => (await apiClient.get(`/admin/image-reviews/${id}/image`, { auth: true })).url, []);

  const approve = useCallback(
    (id, reason) => runAction(() => apiClient.post(`/admin/image-reviews/${id}/approve`, { reason }, options), "Couldn't approve that photo."),
    [runAction],
  );

  const remove = useCallback(
    (id, reason) => runAction(() => apiClient.post(`/admin/image-reviews/${id}/remove`, { reason }, options), "Couldn't remove that photo."),
    [runAction],
  );

  return {
    tab,
    setTab: updateTab,
    page,
    setPage,
    filters,
    setFilter,
    clearFilters,
    hasFilters,
    rows,
    counts,
    pagination,
    loading,
    error,
    refresh: load,
    viewUrl,
    approve,
    remove,
  };
}
