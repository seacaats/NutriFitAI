import { apiClient } from "@/shared/api/apiClient";
import { homeFor } from "@/shared/context/AuthContext";
import { getAccessToken } from "@/shared/utils/authStorage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

// Sends an already signed-in user from login to their home. True while
// that's still being checked, so the screen can hold its loading state
export function useSessionRedirect() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const token = await getAccessToken();

      if (!token) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      // A stored access token only proves one existed at some point — it may
      // be expired. Confirm the session is actually still valid via
      // /auth/me before redirecting away from login, otherwise an expired
      // token bounces the user to /dashboard only to get bounced straight
      // back by that screen's own auth guard
      try {
        const me = await apiClient.get("/auth/me", { auth: true });
        if (!cancelled) router.replace(homeFor(me?.role));
        return; // navigating away — don't flip checkingSession
      } catch {
        // Not authenticated after all (expired token, refresh cookie also expired, etc.)
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return checkingSession;
}
