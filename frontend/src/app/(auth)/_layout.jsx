import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import { AUTH_STATUS, safeReturnTo, useAuth } from "@/shared/context/AuthContext";
import { AuthColorsProvider, useTheme } from "@/shared/context/ThemeContext";
import { getAuthColors } from "@/shared/theme/nutrifitai";
import { Stack, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

/**
 * Auth routes that remain accessible regardless of session state.
 * /google-auth must complete its popup handshake even after a token is stored.
 */
const ALWAYS_ALLOWED = ["/google-auth", "/access-denied"];

export default function AuthLayout() {
  const { status, isAuthenticated, emailVerified, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { darkMode } = useTheme();
  const bg = getAuthColors(darkMode).bgMint;
  const { next } = useGlobalSearchParams();
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const allowed = ALWAYS_ALLOWED.includes(pathname);

  // Redirect authenticated, verified sessions away from auth screens to their target destination.
  const target = !allowed && !gate.pending && isAuthenticated && emailVerified ? safeReturnTo(next, role) : null;

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

  // Keep the Stack mounted while covering it during session loading or redirect transitions.
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
