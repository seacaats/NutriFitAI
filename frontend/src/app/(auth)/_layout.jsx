import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors } from "@/shared/theme/nutrifit";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";

/**
 * Routes here that must stay reachable regardless of session state.
 *
 * /google-auth is the OAuth popup's landing page. It runs *after* a token may
 * already be stored, so bouncing it to /dashboard would kill the popup before
 * it reports its result back to the opener
 * 
 */
const ALWAYS_ALLOWED = ["/google-auth", "/access-denied", "/verified", "/unverified"];

export default function AuthLayout() {
  const { status, isAuthenticated, emailVerified } = useAuth();
  const pathname = usePathname();

  if (ALWAYS_ALLOWED.includes(pathname)) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  if (status === AUTH_STATUS.LOADING) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint }}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  // Only a fully usable session displaces the auth screens. Someone signed in
  // but unverified still needs to reach verify-registration
  if (isAuthenticated && emailVerified) {
    return <Redirect href="/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}