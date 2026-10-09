import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useState } from "react";

// One unread count for the whole app: the bell, the nav dots and the list
// all read it, so marking something read clears every dot at once
let sharedUnread = 0;
const listeners = new Set();
function setSharedUnread(next) {
  sharedUnread = typeof next === "function" ? next(sharedUnread) : next;
  listeners.forEach((fn) => fn(sharedUnread));
}

// Reads still being saved. A load that ran while one was in flight could
// bring back the old count (opening a notification navigates, and the new
// screen's bell loads before the server has marked it), so loads wait for
// pending reads, and a count from before the latest read is ignored
let pendingRead = Promise.resolve();
let readVersion = 0;

// The inbox, for the bell dropdown and the Notifications screen. `limit`
// is the first page's size; loadMore fetches the next older page
export function useNotifications({ limit = 30 } = {}) {
  const [rows, setRows] = useState([]);
  const [unread, setLocalUnread] = useState(sharedUnread);
  const setUnread = setSharedUnread;

  useEffect(() => {
    listeners.add(setLocalUnread);
    return () => listeners.delete(setLocalUnread);
  }, []);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await pendingRead;
      const version = readVersion;
      const data = await apiClient.get(`/notifications?limit=${limit}`, { auth: true });
      setRows(data.rows || []);
      if (version === readVersion) setUnread(data.unread || 0);
      setNextBefore(data.nextBefore || null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextBefore) return;
    try {
      const params = new URLSearchParams({ limit: String(limit), before: new Date(nextBefore).toISOString() });
      const data = await apiClient.get(`/notifications?${params.toString()}`, { auth: true });
      setRows((current) => [...current, ...(data.rows || [])]);
      setNextBefore(data.nextBefore || null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load more.");
    }
  }, [limit, nextBefore]);

  // Optimistic: the row reads as read at once, and the count drops
  const markRead = useCallback(async (ids = []) => {
    const now = new Date().toISOString();
    // Only rows that were still unread lower the count
    const newlyRead = rows.filter((r) => !r.readAt && ids.includes(r.id)).length;
    setRows((current) => current.map((r) => (!ids.length || ids.includes(r.id) ? { ...r, readAt: r.readAt || now } : r)));
    setUnread((n) => (ids.length ? Math.max(n - newlyRead, 0) : 0));
    readVersion += 1;
    const saving = apiClient.post("/notifications/read", ids.length ? { ids } : {}, { auth: true });
    pendingRead = saving.then(() => {}, () => {});
    try {
      await saving;
    } catch {
      load();
    }
  }, [load, rows]);

  usePullRefresh(() => {
    setRows([]);
    return load();
  });

  return { rows, unread, loading, error, refresh: load, loadMore, hasMore: Boolean(nextBefore), markRead };
}