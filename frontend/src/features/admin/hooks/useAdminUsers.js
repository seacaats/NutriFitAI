import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Backs the users management table.
 *
 * @param {{ role?: string|null, limit?: number }} options
 */

/** Long enough that typing a name is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

// Account actions want the whole envelope, for the server's message
const options = { auth: true, full: true };

export function useAdminUsers({ role = null, limit = 25 } = {}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(role);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Guards against a slow earlier request resolving after a faster later one
   * and overwriting it with stale rows -- the classic search race, and very
   * reachable here because each keystroke schedules a request
   *
   * A counter rather than AbortController: the request still completes (no
   * bandwidth saved either way at this size), but its result is discarded.
   * That also keeps `loading` honest, since an aborted fetch would reject and
   * have to be distinguished from a real failure
   */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);

    try {
      const data = await apiClient.get(`/admin/users?${params.toString()}`, { auth: true });
      if (id !== requestId.current) return;

      setRows(data.rows || []);
      setCounts(data.counts || null);
      setPagination(data.pagination || { page: 1, pageCount: 1, total: 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Couldn't load this list.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, limit, search, roleFilter]);

  /**
   * Debounced on `search` only. Changing the page or the role filter fires
   * immediately -- those are deliberate single clicks, and making a button
   * feel 300ms late is the wrong half of the trade this debounce exists for
   */
  useEffect(() => {
    if (!search.trim()) {
      load();
      return undefined;
    }
    const timer = setTimeout(load, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [load, search]);

  /** Resetting to page 1 when the filters change. Without this, narrowing a
   *  search while on page 4 lands on an empty page and reads as "no results" */
  const updateSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const updateRoleFilter = useCallback((value) => {
    setRoleFilter(value);
    setPage(1);
  }, []);

  // Account actions. Return { ok, message } rather than throwing, because
  // every caller wants to show the server's own message either way, and
  // every one takes the reason the audit entry records
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

  const updateName = useCallback(
    (userId, names, reason) =>
      runAction(() => apiClient.patch(`/admin/users/${userId}/profile`, { ...names, reason }, options), "Couldn't update that name."),
    [runAction],
  );
  const suspend = useCallback(
    (userId, reason) => runAction(() => apiClient.post(`/admin/users/${userId}/suspend`, { reason }, options), "Couldn't suspend that account."),
    [runAction],
  );
  const reinstate = useCallback(
    (userId, reason) => runAction(() => apiClient.post(`/admin/users/${userId}/reinstate`, { reason }, options), "Couldn't reinstate that account."),
    [runAction],
  );
  const forcePasswordReset = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.post(`/admin/users/${userId}/password-reset`, { reason }, options), "Couldn't require a password reset."),
    [runAction],
  );
  const cancelPasswordReset = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.post(`/admin/users/${userId}/password-reset/cancel`, { reason }, options), "Couldn't cancel the password reset."),
    [runAction],
  );
  // The email is not editable and no password is set here: the person is emailed
  // how to choose their own (the server decides, see POST /admin/users)
  const createUser = useCallback(
    (fields, reason) => runAction(() => apiClient.post("/admin/users", { ...fields, reason }, options), "Couldn't create that account."),
    [runAction],
  );
  // Clears their authenticator, they set up a new one at their next sign-in
  const resetAuthenticator = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.post(`/admin/users/${userId}/authenticator-reset`, { reason }, options), "Couldn't reset the authenticator."),
    [runAction],
  );
  // Read only, so it skips runAction (which reloads the table). Throws with the server's message
  const loadSessions = useCallback((userId) => apiClient.get(`/admin/users/${userId}/sessions`, { auth: true }), []);
  const revokeSession = useCallback(
    (userId, sessionId, reason) =>
      runAction(() => apiClient.delete(`/admin/users/${userId}/sessions/${sessionId}`, { ...options, body: { reason } }), "Couldn't end that session."),
    [runAction],
  );
  const revokeAllSessions = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.delete(`/admin/users/${userId}/sessions`, { ...options, body: { reason } }), "Couldn't sign them out."),
    [runAction],
  );
  const deleteUser = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.delete(`/admin/users/${userId}`, { ...options, body: { reason } }), "Couldn't schedule that deletion."),
    [runAction],
  );
  const cancelDeletion = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.post(`/admin/users/${userId}/deletion/cancel`, { reason }, options), "Couldn't cancel the deletion."),
    [runAction],
  );

  return {
    rows,
    counts,
    pagination,
    loading,
    error,
    search,
    setSearch: updateSearch,
    roleFilter,
    setRoleFilter: updateRoleFilter,
    page,
    setPage,
    refresh: load,
    updateName,
    suspend,
    reinstate,
    forcePasswordReset,
    cancelPasswordReset,
    createUser,
    resetAuthenticator,
    loadSessions,
    revokeSession,
    revokeAllSessions,
    deleteUser,
    cancelDeletion,
  };
}