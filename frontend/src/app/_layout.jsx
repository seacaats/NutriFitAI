import { AuthProvider } from "@/shared/context/AuthContext";
import { ThemeProvider, useTheme } from "@/shared/context/ThemeContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

function RootLayoutInner() {
  const { darkMode } = useTheme();

  return (
    <>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(superadmin)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(main)" />
      </Stack>
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