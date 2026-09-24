import { apiClient } from "@/shared/api/apiClient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import healthSync, { MAX_BACKFILL_DAYS } from "@/shared/services/steps/healthSync";
import { addDays, todayISO } from "@/shared/services/steps/stepDates";

/**
 * Owns the permission handshake and the three sync triggers
 *
 * There is no background daemon and no webhook. Both CoreMotion and Health
 * Connect accumulate on their own while the app is closed, so all this hook has
 * to do is read the recent window whenever the user is looking 
 *
 * Safe to mount on web: healthSync resolves to the no-op implementation there,
 * isAvailable() returns false, and every trigger short-circuits
 */

/** Don't re-read the sensors more than once every few minutes on foreground */
const SYNC_COOLDOWN_MS = 3 * 60 * 1000;

export function useStepSync({ onSynced } = {}) {
  const [available, setAvailable] = useState(null); // null = still checking
  const [availabilityReason, setAvailabilityReason] = useState(null);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const lastSyncRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  // Held in a ref so the sync callbacks stay stable and don't re-register the
  // AppState listener on every render of the parent screen
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detail = healthSync.getAvailability
        ? await healthSync.getAvailability()
        : { available: await healthSync.isAvailable(), reason: null };

      const granted = detail.available ? await healthSync.hasPermission() : false;
      if (cancelled) return;

      setAvailable(detail.available);
      setAvailabilityReason(detail.reason);
      setConnected(granted);
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Reads the sensor window and pushes it up
   *
   * `force` bypasses the cooldown for an explicit pull-to-refresh; the
   * automatic triggers respect it so that tabbing in and out of the app doesn't
   * produce a burst of identical requests
   */
  const sync = useCallback(async ({ force = false, days = MAX_BACKFILL_DAYS } = {}) => {
    if (!healthSync.source) return null;
    // A second call while one is running would read the same window twice and
    // race on the response
    if (inFlightRef.current) return null;
    if (!force && Date.now() - lastSyncRef.current < SYNC_COOLDOWN_MS) return null;
    if (!(await healthSync.hasPermission())) return null;

    inFlightRef.current = true;
    if (mountedRef.current) { setSyncing(true); setError(""); }

    try {
      const to = todayISO();
      const from = addDays(to, -(Math.max(1, days) - 1));
      const readings = await healthSync.readDailyTotals(from, to);

      // Nothing to send is a normal outcome (a brand-new Health Connect store,
      // or a user who genuinely hasn't moved). Record the attempt so the
      // cooldown still applies and we don't retry in a tight loop
      if (readings.length === 0) {
        lastSyncRef.current = Date.now();
        return { received: 0, updated: 0 };
      }

      const result = await apiClient.post(
        "/steps/sync",
        { source: healthSync.source, days: readings },
        { auth: true },
      );

      lastSyncRef.current = Date.now();
      if (mountedRef.current) setLastSyncAt(new Date());
      onSyncedRef.current?.(result);
      return result;
    } catch (err) {
      // A failed sync is not worth an error banner over stale-but-valid data;
      // the screen keeps showing what the server already has. Surfaced only on
      // an explicit, user-initiated refresh
      if (mountedRef.current && force) {
        setError(err?.message || "Couldn't sync your steps.");
      }
      return null;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setSyncing(false);
    }
  }, []);

  /**
   * Prompts for the OS health permission, then records the grant server-side
   *
   * Telling the backend matters for a surface that can't ask for itself: the
   * WEB dashboard reads user_profiles.step_permission_at to decide between
   * "connect your phone" and "no data this week"
   */
  const connect = useCallback(async () => {
    setError("");
    const granted = await healthSync.requestPermission();

    if (!granted) {
      if (mountedRef.current) {
        setError("Permission denied. You can grant access later in your device settings.");
      }
      return false;
    }

    try {
      await apiClient.patch("/steps/source", { source: healthSync.source }, { auth: true });
    } catch {
      // The grant is real even if we failed to record it; a later sync will
      // set step_source anyway. Don't block the user on a bookkeeping call
    }

    if (mountedRef.current) setConnected(true);
    await sync({ force: true });
    return true;
  }, [sync]);

  const disconnect = useCallback(async () => {
    try {
      await apiClient.delete("/steps/source", { auth: true });
    } finally {
      if (mountedRef.current) setConnected(false);
    }
    // The OS-level grant is not ours to revoke — that lives in iOS Settings or
    // the Health Connect app — so the screen points the user there
  }, []);

  /**
   * Re-reads the OS/Health Connect permission and syncs `connected` state to
   * match. Returns the freshly-read grant so callers can decide whether to
   * pull data immediately, without waiting on a state update to land.
   *
   * This exists because `connected` was previously only ever set from
   * `connect()`'s own request — never re-checked afterward. That made a grant
   * from anywhere OUTSIDE this hook's own button invisible to it: on Android,
   * Health Connect's permission dialog (or its standalone app's "manage
   * permissions" screen) is a completely separate flow from the app's own
   * requestPermission() call, so a user who grants access there — including
   * one who first denied it and had to re-grant it from Health Connect or
   * Settings, since Android does not let an app re-trigger its own prompt
   * after a denial — would come back to this screen still showing
   * "not connected" forever, because nothing ever asked again
   */
  const checkPermission = useCallback(async () => {
    if (!available) return false;
    const granted = await healthSync.hasPermission();
    if (mountedRef.current) setConnected(granted);
    return granted;
  }, [available]);

  // Trigger 1: app returns to the foreground. Always re-checks permission
  // first (not just when this hook already believes it's connected) — that
  // re-check is what notices a grant made outside the app while it was
  // backgrounded, e.g. from the Health Connect app or the OS Settings screen.
  // Only then does it backfill the full window, covering however many days
  // the user was away
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      const granted = await checkPermission();
      if (granted) sync();
    });
    return () => subscription.remove();
  }, [checkPermission, sync]);

  // Trigger 2: the steps screen gains focus. Same re-check as above, then
  // today only — the number should be current the moment the user is
  // looking at it
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const granted = await checkPermission();
        if (granted) sync({ days: 1 });
      })();
    }, [checkPermission, sync]),
  );

  return {
    // null while the availability probe is in flight, so the UI can hold off
    // rendering "not supported" before it knows
    available,
    availabilityReason,
    connected,
    syncing,
    error,
    lastSyncAt,
    label: healthSync.label,
    // Trigger 3: explicit pull-to-refresh
    refresh: () => sync({ force: true }),
    connect,
    disconnect,
    openSettings: healthSync.openSettings,
  };
}