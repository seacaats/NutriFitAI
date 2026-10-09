import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import { AUTH_STATUS, safeReturnTo, useAuth } from "@/shared/context/AuthContext";
import { Redirect, Stack, useGlobalSearchParams, usePathname } from "expo-router";

/**
 * Routes here that must stay reachable regardless of session state.
 *
 * /google-auth is the OAuth popup's landing page. It runs *after* a token may
 * already be stored, so bouncing it to the home screen would kill the popup before
 * it reports its result back to the opener
 */
const ALWAYS_ALLOWED = ["/google-auth", "/access-denied"];

export default function AuthLayout() {
  const { status, isAuthenticated, emailVerified, role } = useAuth();
  const pathname = usePathname();
  // `next`: the page they were heading to before login, checked against the role
  const { next } = useGlobalSearchParams();
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);

  if (ALWAYS_ALLOWED.includes(pathname)) {
    return <Stack screenOptions={{ headerShown: false, animation: "ios_from_right" }} />;
  }

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  // Only a fully usable session displaces the auth screens. The server no
  // longer issues sessions to unverified accounts; the emailVerified check
  // stays as a guard in case one ever exists. This is the one place a
  // sign-in navigates in: the login screen only refreshes the session
  if (isAuthenticated && emailVerified) {
    return <Redirect href={safeReturnTo(next, role)} />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "ios_from_right" }} />;
}