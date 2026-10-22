import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * Backs the audit log table.
 * Each row includes a pre-rendered `message` from the backend action registry
 * (`src/utils/audit-logs/actions`) along with sortable metadata columns.
 */

const DEFAULT_LIMIT = 25;

// Client-side pseudo-categories for special audit log tabs
export const BY_USER = "__byUser";
export const HELD = "__held";
export const NOTED = "__noted";

// Request full response envelope for note and hold actions
const options = { auth: true, full: true };

export function useAuditLogs({ subjectId = null, limit = DEFAULT_LIMIT } = {}) {
  const [category, setCategory] = useState(null);
  const [action, setAction] = useState(null);
  const [page, setPage] = useState(1);

  // "By User" tab: selected user account and role filter (actor/target/all)
  const [subject, setSubject] = useState(null); // { id, label }
  const [subjectMode, setSubjectMode] = useState("all");
  const byUser = category === BY_USER;
  const held = category === HELD;
  const noted = category === NOTED;

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [meta, setMeta] = useState(null);
  // Keep filter pills and Export button in skeleton state until metadata and initial rows load
  const [metaLoading, setMetaLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestId = useRef(0);

  // Fetch available categories and actions from the server registry once on mount
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/admin/audit-logs/meta", { auth: true })
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    // Wait until a user is selected on the "By User" tab before querying
    if (byUser && !subject) {
      setRows([]);
      setPagination({ page: 1, pageCount: 1, total: 0 });
      setLoading(false);
      setLoadedOnce(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (held) params.set("held", "true");
    if (noted) params.set("noted", "true");
    if (category && !byUser && !held && !noted) params.set("category", category);
    if (action && !byUser && !held && !noted) params.set("action", action);
    const subjectToUse = byUser ? subject?.id : subjectId;
    if (subjectToUse) params.set("subjectId", subjectToUse);
    if (byUser && subjectMode !== "all") params.set("subjectMode", subjectMode);

    try {
      const data = await apiClient.get(`/admin/audit-logs?${params.toString()}`, { auth: true });
      // Discard stale responses superseded by a newer request
      if (id !== requestId.current) return;

      setRows(data.rows || []);
      setPagination(data.pagination || { page: 1, pageCount: 1, total: 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(
        err instanceof ApiClientError ? err.message : "Couldn't load the audit log.",
      );
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadedOnce(true);
      }
    }
  }, [page, limit, category, action, subjectId, byUser, held, noted, subject, subjectMode]);

  useEffect(() => {
    load();
  }, [load]);

  // Execute a note or hold mutation, reload the table so row indicators update, and return { ok, message }
  const run = useCallback(async (request, fallback) => {
    try {
      const payload = await request();
      await load();
      return { ok: true, message: payload.message || "Done", data: payload.data };
    } catch (err) {
      return { ok: false, message: err instanceof ApiClientError ? err.message : fallback };
    }
  }, [load]);

  // Fetch notes for a single audit log row (oldest first) when its drawer opens
  const listNotes = useCallback(
    (id) => apiClient.get(`/admin/audit-logs/${id}/notes`, { auth: true }),
    [],
  );
  const addNote = useCallback(
    (id, body) => run(() => apiClient.post(`/admin/audit-logs/${id}/notes`, { body }, options), "Couldn't add that note."),
    [run],
  );
  const hold = useCallback(
    (id, reason) => run(() => apiClient.post(`/admin/audit-logs/${id}/hold`, { reason }, options), "Couldn't hold that entry."),
    [run],
  );
  const release = useCallback(
    (id, reason) => run(() => apiClient.delete(`/admin/audit-logs/${id}/hold`, { ...options, body: { reason } }), "Couldn't release that hold."),
    [run],
  );

  // Export unpaginated CSV matching current filters (supported on web only)
  const exportCsv = useCallback(async () => {
    if (Platform.OS !== "web") {
      return { ok: false, message: "Export is available on the web dashboard." };
    }
    const params = new URLSearchParams();
    if (category && !byUser) params.set("category", category);
    if (action && !byUser) params.set("action", action);
    const subjectToUse = byUser ? subject?.id : subjectId;
    if (subjectToUse) params.set("subjectId", subjectToUse);
    if (byUser && subjectMode !== "all") params.set("subjectMode", subjectMode);

    try {
      const csv = await apiClient.get(`/admin/audit-logs/export?${params.toString()}`, { auth: true, as: "text" });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true, message: "Export downloaded" };
    } catch (err) {
      return { ok: false, message: err instanceof ApiClientError ? err.message : "Couldn't export the log." };
    }
  }, [category, action, subjectId, byUser, subject, subjectMode]);

  // Changing category clears the sub-action filter and resets to page 1
  const updateCategory = useCallback((value) => {
    setCategory(value);
    setAction(null);
    setPage(1);
  }, []);

  const updateAction = useCallback((value) => {
    setAction(value);
    setPage(1);
  }, []);

  const updateSubject = useCallback((value) => {
    setSubject(value);
    setPage(1);
  }, []);

  const updateSubjectMode = useCallback((value) => {
    setSubjectMode(value);
    setPage(1);
  }, []);

  return {
    rows,
    pagination,
    loading,
    error,
    meta,
    metaLoading,
    // Filters and Export show as skeletons until both have arrived
    firstLoad: metaLoading || !loadedOnce,
    category,
    setCategory: updateCategory,
    action,
    setAction: updateAction,
    byUser,
    subject,
    setSubject: updateSubject,
    subjectMode,
    setSubjectMode: updateSubjectMode,
    page,
    setPage,
    refresh: load,
    exportCsv,
    held,
    noted,
    listNotes,
    addNote,
    hold,
    release,
  };
}

// Debounced name/email lookup for the "By User" filter tab via GET /admin/users
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 6;

export function useUserSearch(term) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query, limit: String(RESULT_LIMIT) });
        const data = await apiClient.get(`/admin/users?${params.toString()}`, { auth: true });
        if (!cancelled) setResults(data.rows || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return { results, searching };
}
