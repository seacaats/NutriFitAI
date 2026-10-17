import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import { AUTH_STATUS, safeReturnTo, useAuth } from "@/shared/context/AuthContext";
import { AuthColorsProvider, useTheme } from "@/shared/context/ThemeContext";
import { getAuthColors } from "@/shared/theme/nutrifitai";
import { Stack, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

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
  const router = useRouter();
  const { darkMode } = useTheme();
  const bg = getAuthColors(darkMode).bgMint;
  // `next`: the page they were heading to before login, checked against the role
  const { next } = useGlobalSearchParams();
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const allowed = ALWAYS_ALLOWED.includes(pathname);

  // Only a fully usable session displaces the auth screens. The server no
  // longer issues sessions to unverified accounts; the emailVerified check
  // stays as a guard in case one ever exists. This is the one place a
  // sign-in navigates in: the login screen only refreshes the session
  const target = !allowed && !gate.pending && isAuthenticated && emailVerified ? safeReturnTo(next, role) : null;

  // Once per destination, for the same reason as RoleGuard (AuthContext.js)
  const sentTo = useRef(null);
  useEffect(() => {
    if (!target) {
      sentTo.current = null;
      return;
    }
    if (sentTo.current === target) return;
    sentTo.current = target;
    router.replace(target);
  }, [target, router]);

  // The navigator always stays mounted (see RoleGuard); waiting for the
  // session or leaving covers it instead
  const cover = allowed ? null
    : gate.pending ? <LoadingScreen visible={gate.visible} />
    : target ? <View style={{ flex: 1, backgroundColor: bg }} />
    : null;

  return (
    <AuthColorsProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: bg } }} />
        {cover && <View style={StyleSheet.absoluteFill}>{cover}</View>}
      </View>
    </AuthColorsProvider>
  );
}