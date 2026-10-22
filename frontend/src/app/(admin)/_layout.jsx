import { RoleGuard } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { Stack } from "expo-router";

/** Admin screens (web only). Rules: ROUTE_ROLES in AuthContext.js */
export default function AdminLayout() {
  const { shell } = useTheme();
  return (
    <RoleGuard>
      <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: shell.shellBg } }}>
        <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
        <Stack.Screen name="users" options={{ title: "Users" }} />
        <Stack.Screen name="audit-logs" options={{ title: "Audit Logs" }} />
      </Stack>
    </RoleGuard>
  );
}