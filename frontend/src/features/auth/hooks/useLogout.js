import { unregisterDevice } from "@/features/notifications/push";
import { useAuth } from "@/shared/context/AuthContext";
import { useCallback } from "react";

/**
 * Ends the session. The route guard then sees the session gone and, since it
 * was the user's choice, takes them to the landing page.
 *
 * Delegates to AuthContext.signOut() rather than clearing storage directly:
 * the token and the context must go anonymous together. Clearing only storage
 * leaves AuthContext reporting AUTHENTICATED, and the (auth) route guard then
 * bounces the user straight back to /dashboard
 */
export function useLogout() {
  const { signOut } = useAuth();

  return useCallback(async () => {
    // While the session is still valid, so the next person on this phone
    // doesn't get this account's notifications
    await unregisterDevice();
    await signOut({ byUser: true });
  }, [signOut]);
}