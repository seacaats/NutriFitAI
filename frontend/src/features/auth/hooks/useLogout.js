import { useAuth } from "@/shared/context/AuthContext";
import { useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * Ends the session and returns to login.
 *
 * Delegates to AuthContext.signOut() rather than clearing storage directly:
 * the token and the context must go anonymous together. Clearing only storage
 * leaves AuthContext reporting AUTHENTICATED, and the (auth) route guard then
 * bounces the user straight back to /dashboard
 */
export function useLogout() {
  const router = useRouter();
  const { signOut } = useAuth();

  return useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut, router]);
}