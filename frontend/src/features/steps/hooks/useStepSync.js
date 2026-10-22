import { apiClient } from "@/shared/api/apiClient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import healthSync, { MAX_BACKFILL_DAYS } from "@/shared/services/steps/healthSync";
import { addDays, todayISO } from "@/shared/utils/dates";

/**
 * Owns the permission handshake and the three sync triggers.
 *
 * CoreMotion and Health Connect accumulate while the app is closed, so this
 * hook reads the recent window when the app is active or the screen focuses.
 * Safe to mount on web where healthSync resolves to a no-op.
 */

/** Cooldown between automatic foreground sensor reads */
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
   * Reads the sensor window and pushes it to the server.
   * `force` bypasses the cooldown for explicit pull-to-refresh.
   */
  const sync = useCallback(async ({ force = false, days = MAX_BACKFILL_DAYS } = {}) => {
    if (!healthSync.source) return null;
    if (inFlightRef.current) return null;
    if (!force && Date.now() - lastSyncRef.current < SYNC_COOLDOWN_MS) return null;
    if (!(await healthSync.hasPermission())) return null;

    inFlightRef.current = true;
    if (mountedRef.current) { setSyncing(true); setError(""); }

    try {
      const to = todayISO();
      const from = addDays(to, -(Math.max(1, days) - 1));
      const readings = await healthSync.readDailyTotals(from, to);

      // Record the attempt even when empty so the cooldown applies
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
      // Surface errors only on an explicit, user-initiated refresh
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
   * so the web dashboard can distinguish "connect your phone" from "no data this week".
   */
  const connect = useCallback(async () => {
    setError("");
    const asked = Date.now();
    const granted = await healthSync.requestPermission();

    if (!granted) {
      // After two denials Android stops showing the dialog and refuses at once;
      // an instant "no" means nobody was asked, so open the settings to grant it there
      // (the foreground re-check picks the grant up on return)
      const notShown = Date.now() - asked < 800;
      if (notShown) await healthSync.openSettings?.();
      if (mountedRef.current) {
        setError(notShown
          ? `Allow step access in ${healthSync.label}, then come back.`
          : "Permission denied. You can grant access later in your device settings.");
      }
      return false;
    }

    try {
      await apiClient.patch("/steps/source", { source: healthSync.source }, { auth: true });
    } catch {
      // A later sync will set step_source anyway; don't block on this call
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
    // OS-level permissions must be revoked in iOS Settings or Health Connect
  }, []);

  /**
   * Re-reads the OS/Health Connect permission and updates `connected` so grants
   * made outside the app's own prompt (e.g. in Health Connect or OS Settings)
   * are picked up when returning.
   */
  const checkPermission = useCallback(async () => {
    if (!available) return false;
    const granted = await healthSync.hasPermission();
    if (mountedRef.current) setConnected(granted);
    return granted;
  }, [available]);

  // Trigger 1: app returns to the foreground — re-check permission and backfill the full window
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      const granted = await checkPermission();
      if (granted) sync();
    });
    return () => subscription.remove();
  }, [checkPermission, sync]);

  // Trigger 2: the steps screen gains focus — re-check permission and sync today
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
