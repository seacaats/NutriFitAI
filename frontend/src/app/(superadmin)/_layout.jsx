import { RoleGuard } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { Stack } from "expo-router";

/** Superadmin-only screens (web only). Rules: ROUTE_ROLES in AuthContext.js */
export default function SuperadminLayout() {
  const { shell } = useTheme();
  return (
    <RoleGuard>
      <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: shell.shellBg } }}>
        <Stack.Screen name="admins" options={{ title: "Admins" }} />
      </Stack>
    </RoleGuard>
  );
}