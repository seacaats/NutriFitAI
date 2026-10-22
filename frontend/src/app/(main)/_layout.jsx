import { RoleGuard } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { Stack } from "expo-router";

/**
 * User-facing screens. Role rules live in AuthContext.js (ROUTE_ROLES): every
 * screen here is user-only except /profile (all roles). An admin
 * who reaches a user-only screen is sent to /users.
 *
 * Usability boundary, not a security one -- the API enforces the same split
 * at its mount points (src/routes/index.js).
 */
export default function MainLayout() {
  const { shell } = useTheme();
  // Theme background between screens, not the default white
  return (
    <RoleGuard>
      <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: shell.shellBg } }} />
    </RoleGuard>
  );
}