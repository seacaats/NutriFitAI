import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors } from "@/shared/theme/nutrifit";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

const REQUIRED_ROLES = ["admin", "superadmin"];

export default function AdminLayout() {
  const { status, isAuthenticated, emailVerified, hasRole, refresh } = useAuth();
  const pathname = usePathname();

  if (status === AUTH_STATUS.LOADING) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint }}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }


  // server unreachable but token is still held
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

  if (!hasRole(REQUIRED_ROLES)) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "forbidden", from: pathname } }} />;
  }

  if (Platform.OS !== "web" && hasRole(["admin", "superadmin"])) {
    return <Redirect href={{ pathname: "/access-denied", params: { reason: "admin-web-only", from: pathname } }} />;
  }  

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="audit-logs" options={{ title: "Audit Logs" }} />
    </Stack>
  );
}