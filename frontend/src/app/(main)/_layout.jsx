import { RoleGuard } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { Stack } from "expo-router";

/**
 * User-facing app layout guarded by ROUTE_ROLES in AuthContext.js.
 * All routes here are user-only except /profile and /settings (shared with admins).
 */
export default function MainLayout() {
  const { shell } = useTheme();
  return (
    <RoleGuard>
      <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: shell.shellBg } }} />
    </RoleGuard>
  );
}
