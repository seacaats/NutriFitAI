import { usePushSetup } from "@/features/notifications/hooks/usePushSetup";
import { AuthProvider } from "@/shared/context/AuthContext";
import { PullRefreshProvider } from "@/shared/context/PullRefreshContext";
import { ThemeProvider, useTheme } from "@/shared/context/ThemeContext";
import { useWebScrollbar } from "@/shared/hooks/useWebScrollbar";
import { appFonts, applyAppFont } from "@/shared/theme/fonts";
import { getAuthColors, getPublicTones } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Set Inter as the default font on all Text and TextInput components.
applyAppFont();

function RootLayoutInner() {
  const { darkMode, shell } = useTheme();
  // Register push notifications and notification tap handlers within the active auth session.
  usePushSetup();
  useWebScrollbar(darkMode);

  return (
    <>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <PullRefreshProvider>
        {/* Match screen container backgrounds to the active theme to prevent flashes during navigation */}
        <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: shell.shellBg } }}>
          <Stack.Screen name="(public)" options={{ contentStyle: { backgroundColor: getPublicTones(darkMode).bg } }} />
          <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: getAuthColors(darkMode).bgMint } }} />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </PullRefreshProvider>
    </>
  );
}

export default function RootLayout() {
  // Wait for Inter and Ionicons fonts before initial render to prevent font swapping or missing glyphs.
  const [fontsLoaded, fontError] = useFonts({ ...appFonts, ...Ionicons.font });
  // On web, wait until document.fonts finishes loading the font faces before painting.
  const [webReady, setWebReady] = useState(Platform.OS !== "web");
  useEffect(() => {
    if (Platform.OS !== "web" || (!fontsLoaded && !fontError)) return;
    let alive = true;
    Promise.all(Object.keys(appFonts).map((name) => document.fonts.load(`16px "${name}"`)))
      .catch(() => {})
      .finally(() => alive && setWebReady(true));
    return () => { alive = false; };
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !webReady) return null;

  return (
    <AuthProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </AuthProvider>
  );
}
