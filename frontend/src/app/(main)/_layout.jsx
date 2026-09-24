import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors } from "@/shared/theme/nutrifit";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

/**
 * Guard for every screen in the (main) group.
 *
 * Deny by default: nothing here renders until the session has been confirmed
 * against the server, so a protected screen can't flash its contents before a
 * redirect lands.
 *
 * This is a usability boundary, not a security one — the API enforces the real
 * thing via requireAuth/requireRole. Both layers are needed: hiding a screen
 * protects nobody if the endpoint behind it is open.
 */

/**
 * Screens needing more than a plain signed-in session.
 *
 * Listed by EXACT pathname, matching how `hasRole` works (exact membership,
 * not hierarchy) -- so a route an admin and a superadmin may both reach names
 * both. Using hasAtLeastRole here instead would be shorter, but it would make
 * the superadmin-only routes silently admin-reachable the day someone
 * shortens "superadmin" to a minimum bound by mistake. Spelling out the set
 * is the version that fails loudly.
 *
 * The keys are pathnames, so a NESTED route under one of these is not covered
 * by its parent's entry -- /admin/users/:id would need its own line. Nothing
 * nests that deep yet; the moment something does, this map should become a
 * prefix match rather than gaining a near-duplicate row.
 */
const ROLE_REQUIREMENTS = {
  "/admin/users": ["admin", "superadmin"],
  "/admin/audit-logs": ["admin", "superadmin"],
  "/superadmin/admins": ["superadmin"],
};

const ADMIN_ROLES = ["admin", "superadmin"];

const ALWAYS_ALLOWED = ["/access-denied"];

export default function MainLayout() {
  const { status, isAuthenticated, emailVerified, hasRole, refresh } = useAuth();
  const pathname = usePathname();

  if (ALWAYS_ALLOWED.includes(pathname)) {
    return <Stack screenOptions={{ headerShown: false }}/>;
  }

  if (status === AUTH_STATUS.LOADING) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint }}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  // server unreachable: a token is held but cannot be confirmed due to lack of internet connectivity
  if (status === AUTH_STATUS.UNREACHABLE) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.bgMint }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
          Can&apos;t reach the server
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", maxWidth: 320, lineHeight: 19 }}>
          You&apos;re still signed in. Check your connection and try again.
        </Text>
        <Pressable
          onPress={refresh}
          style={{ backgroundColor: colors.green600, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 11 }}
        >
          <Text style={{ color: colors.white, fontWeight: "700", fontSize: 14 }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "unauthenticated", from: pathname } }} />;
  }

  if (!emailVerified) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "unverified", from: pathname } }} />;
  }

  if (Platform.OS !== "web" && hasRole(["admin", "superadmin"])) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "admin-web-only", from: pathname } }} />;
  }

  const required = ROLE_REQUIREMENTS[pathname];
  if (required && !hasRole(required)) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "forbidden", from: pathname } }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}