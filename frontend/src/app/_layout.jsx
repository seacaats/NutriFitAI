import { ThemeProvider, useTheme } from "@context/ThemeContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

function RootLayoutInner() {
  const { darkMode } = useTheme();

  return (
    <>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <Stack screenOptions={{ headerShown: false }}>
        {/* AUTHENTICATION */}
        <Stack.Screen name="index" />
        
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="(auth)/verify-otp" />
        <Stack.Screen name="verify-registration" />
        <Stack.Screen name="(auth)/verified" />
        <Stack.Screen name="(auth)/unverified" />

        {/* APPLICATION */}
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="food-scanner" />
        <Stack.Screen name="workouts" />
        <Stack.Screen name="ai-coach" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="profile" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}