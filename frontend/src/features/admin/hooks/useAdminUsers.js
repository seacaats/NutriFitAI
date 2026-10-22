import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Backs the users management table.
 *
 * @param {{ role?: string|null, limit?: number }} options
 */

const SEARCH_DEBOUNCE_MS = 300;

// Request the full response envelope so account actions can surface the server message
const options = { auth: true, full: true };

export function useAdminUsers({ role = null, limit = 25, search: initialSearch = "" } = {}) {
  // initialSearch allows Image Review to open this table filtered by a user's email
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState(role);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monotonic request counter to discard out-of-order responses during rapid search input
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

  // Debounce non-empty search queries while firing page and role filter changes immediately
  useEffect(() => {
    if (!search.trim()) {
      load();
      return undefined;
    }
    const timer = setTimeout(load, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Reset to page 1 when search or role filter changes
  const updateSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const updateRoleFilter = useCallback((value) => {
    setRoleFilter(value);
    setPage(1);
  }, []);

  // Execute an audited account action, reload the table, and return { ok, message }
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
    (userId, reason, userMessage) => runAction(() => apiClient.post(`/admin/users/${userId}/suspend`, { reason, ...(userMessage ? { userMessage } : {}) }, options), "Couldn't suspend that account."),
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
  // Creates the account and emails the user a password setup link (see POST /admin/users)
  const createUser = useCallback(
    (fields, reason) => runAction(() => apiClient.post("/admin/users", { ...fields, reason }, options), "Couldn't create that account."),
    [runAction],
  );
  // Clears the user's authenticator so a new one is configured on next sign-in
  const resetAuthenticator = useCallback(
    (userId, reason) =>
      runAction(() => apiClient.post(`/admin/users/${userId}/authenticator-reset`, { reason }, options), "Couldn't reset the authenticator."),
    [runAction],
  );
  // Read-only fetch of active sessions (does not reload the user table)
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
    (userId, reason, userMessage) =>
      runAction(() => apiClient.delete(`/admin/users/${userId}`, { ...options, body: { reason, ...(userMessage ? { userMessage } : {}) } }), "Couldn't schedule that deletion."),
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
