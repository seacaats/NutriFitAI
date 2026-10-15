import { usePushSetup } from "@/features/notifications/hooks/usePushSetup";
import { AuthProvider } from "@/shared/context/AuthContext";
import { PullRefreshProvider } from "@/shared/context/PullRefreshContext";
import { ThemeProvider, useTheme } from "@/shared/context/ThemeContext";
import { useLandingOnResume } from "@/shared/hooks/useLandingOnResume";
import { useWebScrollbar } from "@/shared/hooks/useWebScrollbar";
import { colors, getPublicTones } from "@/shared/theme/nutrifitai";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

function RootLayoutInner() {
  const { darkMode, shell } = useTheme();
  // Push registration and tap handling, inside AuthProvider so it knows the session
  usePushSetup();
  // Thin themed scrollbars on web
  useWebScrollbar(darkMode);
  // Signed out on the phone: back from the background means back to the landing page
  useLandingOnResume();

  return (
    <>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <PullRefreshProvider>
        {/* The theme's background behind every screen, so a screen change
            never flashes white (or black). Public and auth pages are mint */}
        <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: shell.shellBg } }}>
          {/* Public pages follow the theme, the auth pages stay mint */}
          <Stack.Screen name="(public)" options={{ contentStyle: { backgroundColor: getPublicTones(darkMode).bg } }} />
          <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: colors.bgMint } }} />
          <Stack.Screen name="(superadmin)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </PullRefreshProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </AuthProvider>
  );
}