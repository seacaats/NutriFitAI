import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useCallback, useEffect, useState } from "react";

function messageOf(err, fallback) {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Settings page data: notifications, timezone and account details come from
// GET /profile. Password changes go through /profile/password in two steps
export function useSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return apiClient.get("/profile", { auth: true })
      .then((data) => setProfile(data))
      .catch((err) => setError(messageOf(err, "Couldn't load your settings.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Same data without the loading state, so what's open on screen stays put
  // (2FA setup is showing recovery codes when this runs)
  const refreshQuietly = useCallback(
    () => apiClient.get("/profile", { auth: true }).then(setProfile).catch(() => {}),
    [],
  );
  usePullRefresh(load);

  // Optimistic: flips right away, rolls back if the save fails
  const setNotifications = useCallback(async (enabled) => {
    const previous = profile?.notificationsEnabled;
    setProfile((p) => ({ ...p, notificationsEnabled: enabled }));
    try {
      await apiClient.patch("/profile", { notificationsEnabled: enabled }, { auth: true });
      setError("");
    } catch (err) {
      setProfile((p) => ({ ...p, notificationsEnabled: previous }));
      setError(messageOf(err, "Couldn't save that setting."));
    }
  }, [profile?.notificationsEnabled]);

  // The per-category switches and quiet hours. Sent whole (the API wants the
  // full object), optimistic like the master switch
  const setNotificationPrefs = useCallback(async (changes) => {
    const previous = profile?.notificationPrefs;
    const next = { ...previous, ...changes };
    setProfile((p) => ({ ...p, notificationPrefs: next }));
    try {
      await apiClient.patch("/profile", { notificationPrefs: next }, { auth: true });
      setError("");
    } catch (err) {
      setProfile((p) => ({ ...p, notificationPrefs: previous }));
      setError(messageOf(err, "Couldn't save that setting."));
    }
  }, [profile?.notificationPrefs]);

  // Both throw with the server's message, for the form to show inline
  const verifyPassword = useCallback(
    (currentPassword) => apiClient.post("/profile/password/verify", { currentPassword }, { auth: true }),
    [],
  );
  const changePassword = useCallback(
    (currentPassword, newPassword) =>
      apiClient.put("/profile/password", { currentPassword, newPassword }, { auth: true }),
    [],
  );

  // Throws with the server's message. Sends the password along with the typed DELETE
  const deleteAccount = useCallback(
    (currentPassword) =>
      apiClient.delete("/profile", {
        auth: true,
        body: { confirm: "DELETE", currentPassword },
      }),
    [],
  );

  return {
    profile,
    loading,
    error,
    clearError: () => setError(""),
    reload: refreshQuietly,
    setNotifications,
    setNotificationPrefs,
    verifyPassword,
    changePassword,
    deleteAccount,
  };
}