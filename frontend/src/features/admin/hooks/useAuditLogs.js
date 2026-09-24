import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Backs the audit log table for BOTH roles.
 *
 * There is no admin variant and no superadmin variant, because the client
 * does not decide what it sees. GET /admin/audit-logs reads the caller's role
 * from their session -- refreshed against the database, not taken from the
 * token -- and returns rows already filtered and already redacted. This hook
 * fetches and paginates; it holds no visibility logic at all, which is the
 * only arrangement where the client cannot be talked into showing more than
 * it should
 *
 * What comes back per row is a rendered sentence (`message`) plus the columns
 * the table sorts on. The phrasing lives in the backend's
 * src/utils/auditActions.js registry, deliberately not mirrored here: a second
 * copy of the templates would drift, and would have to carry the
 * superadmin-only strings into a bundle every user downloads
 */

const DEFAULT_LIMIT = 25;

export function useAuditLogs({ subjectId = null, limit = DEFAULT_LIMIT } = {}) {
  const [category, setCategory] = useState(null);
  const [action, setAction] = useState(null);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestId = useRef(0);

  /**
   * The filter menu's options, fetched once.
   *
   * Derived from the registry server-side rather than from distinct values in
   * the collection -- which matters right now more than it will later, since
   * nothing writes most of these actions yet. Deriving from data would render
   * an empty filter menu over an empty table, and the catalogue is exactly
   * what is worth seeing while the producers are still being wired up.
   * 
   */
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/admin/audit-logs/meta", { auth: true })
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (subjectId) params.set("subjectId", subjectId);

    try {
      const data = await apiClient.get(`/admin/audit-logs?${params.toString()}`, { auth: true });
      // Discard a stale response that lost the race to a newer one
      if (id !== requestId.current) return;

      setRows(data.rows || []);
      setPagination(data.pagination || { page: 1, pageCount: 1, total: 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(
        err instanceof ApiClientError ? err.message : "Something went wrong loading the log.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, limit, category, action, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Selecting a category clears any action drilled into within the previous
   *  one -- otherwise the two filters contradict each other and the table
   *  goes empty for a reason nothing on screen explains */
  const updateCategory = useCallback((value) => {
    setCategory(value);
    setAction(null);
    setPage(1);
  }, []);

  const updateAction = useCallback((value) => {
    setAction(value);
    setPage(1);
  }, []);

  return {
    rows,
    pagination,
    loading,
    error,
    meta,
    /** True when the server withheld IPs and before/after values from this
     *  viewer -- the table labels the omission rather than rendering blank
     *  columns, which reads as a bug */
    redacted: meta ? meta.redacted : true,
    viewerRole: meta ? meta.viewerRole : null,
    category,
    setCategory: updateCategory,
    action,
    setAction: updateAction,
    page,
    setPage,
    refresh: load,
  };
}
