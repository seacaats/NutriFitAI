import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * Backs the audit log table.
 *
 * What comes back per row is a rendered sentence (`message`) plus the columns
 * the table sorts on. The phrasing lives in the backend's
 * src/utils/audit-logs/actions registry, deliberately not mirrored here: a
 * second copy of the templates would drift, and would ship them in a bundle
 * every user downloads
 */

const DEFAULT_LIMIT = 25;

// Pseudo-category for the "By User" tab. Not a server category: it switches
// the filter from "what kind of action" to "which person"
export const BY_USER = "__byUser";

// Pseudo-category for the "Held" tab: held copies (audit_holds) instead of
// the live log
export const HELD = "__held";

// Pseudo-category for the "Noted" tab: live rows that have notes
export const NOTED = "__noted";

// Notes and holds want the whole envelope, for the server's message
const options = { auth: true, full: true };

export function useAuditLogs({ subjectId = null, limit = DEFAULT_LIMIT } = {}) {
  const [category, setCategory] = useState(null);
  const [action, setAction] = useState(null);
  const [page, setPage] = useState(1);

  // "By User" tab: the picked account and which side of the action they're on
  const [subject, setSubject] = useState(null); // { id, label }
  const [subjectMode, setSubjectMode] = useState("all");
  const byUser = category === BY_USER;
  const held = category === HELD;
  const noted = category === NOTED;

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [meta, setMeta] = useState(null);
  // Until the filter menu arrives: its pills and the Export button show as skeletons
  const [metaLoading, setMetaLoading] = useState(true);
  // The page's first load: filters and Export stay skeletons until the table has arrived too
  const [loadedOnce, setLoadedOnce] = useState(false);
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

    // Nothing to show on "By User" until someone is picked
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
      // Discard a stale response that lost the race to a newer one
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

  // Notes, holds: same { ok, message } contract as the user actions, and a
  // reload so the row's markers (held, note count) catch up
  const run = useCallback(async (request, fallback) => {
    try {
      const payload = await request();
      await load();
      return { ok: true, message: payload.message || "Done", data: payload.data };
    } catch (err) {
      return { ok: false, message: err instanceof ApiClientError ? err.message : fallback };
    }
  }, [load]);

  // A row's notes, oldest first. Fetched when its drawer opens
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

  // Same filters as the table, no
  // paging. Web downloads the file; native has nowhere useful to put a CSV,
  // so it points to the web dashboard instead. Returns { ok, message }
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

// Name/email lookup for the audit log's "By User" tab. Reuses GET /admin/users
// (already admin-only), debounced so typing doesn't fire a request per key

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