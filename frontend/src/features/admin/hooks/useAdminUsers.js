import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Backs both the users management table and the admins management table.
 *
 * ONE HOOK FOR BOTH, because they are the same query against the same
 * collection with a different endpoint and a different default filter -- an
 * admin IS a user with a role
 *
 * @param {{ endpoint?: string, role?: string|null, limit?: number }} options
 */

/** Long enough that typing a name is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

export function useAdminUsers({ endpoint = "/admin/users", role = null, limit = 25 } = {}) {
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
      const data = await apiClient.get(`${endpoint}?${params.toString()}`, { auth: true });
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
          : "Something went wrong loading this list.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [endpoint, page, limit, search, roleFilter]);

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

  /**
   * Promote or demote. Returns { ok, message } rather than throwing, because
   * every caller wants to show the server's own message either way -- the
   * failures here are deliberate, specific and worth reading verbatim
   * ("This is the only superadmin", "You cannot change your own role")
   */
  const changeRole = useCallback(
    async (userId, nextRole, reason) => {
      try {
        const payload = await apiClient.patch(
          `/admin/users/${userId}/role`,
          { role: nextRole, reason },
          { auth: true, full: true },
        );
        await load();
        return { ok: true, message: payload.message || "Role updated" };
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof ApiClientError ? err.message : "Couldn't update that role.",
        };
      }
    },
    [load],
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
    changeRole,
  };
}
