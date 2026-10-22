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

// Every <Text> and <TextInput> uses Inter from here on
applyAppFont();

function RootLayoutInner() {
  const { darkMode, shell } = useTheme();
  // Push registration and tap handling, inside AuthProvider so it knows the session
  usePushSetup();
  // Thin themed scrollbars on web
  useWebScrollbar(darkMode);

  return (
    <>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <PullRefreshProvider>
        {/* The theme's background behind every screen, so a screen change
            never flashes white (or black). Public and auth pages are mint in light */}
        <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: shell.shellBg } }}>
          {/* Public and auth pages follow the theme */}
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
  // Holds the first render until Inter and the icon font are ready, so text never
  // swaps fonts mid-screen and icons never show as empty boxes.
  const [fontsLoaded, fontError] = useFonts({ ...appFonts, ...Ionicons.font });
  // Web: useFonts can resolve before the browser has the font ready to paint, so
  // the text would show up in the fallback font first. Wait for the faces too
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