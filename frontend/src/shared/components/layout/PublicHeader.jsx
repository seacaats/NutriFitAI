import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import { homeFor, useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const BREAKPOINT = 640;

export default function PublicHeader({ isAuthenticated = false }) {
  const router = useRouter();
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < BREAKPOINT;

  return (
    <View style={styles.bar}>
      <Pressable style={styles.brand} onPress={() => router.push("/")} hitSlop={8}>
        <NutriFitLogo small={compact} />
      </Pressable>

      <View style={styles.actions}>
        {isAuthenticated ? (
          <Pressable style={styles.primaryBtn} onPress={() => router.push(homeFor(role))}>
            <Text style={styles.primaryBtnText}>{role === "user" ? "To Dashboard" : "To Analytics"}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.loginLink} onPress={() => router.push("/login")} hitSlop={8}>
              <Text style={styles.loginText}>Log In</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => router.push("/register")}>
              <Text style={styles.primaryBtnText}>{compact ? "Sign Up" : "Register"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgMint,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  loginLink: { paddingHorizontal: 4, paddingVertical: 6 },
  loginText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  primaryBtnText: { ...typography.caption, color: colors.white, fontWeight: "700" },
});

// "← Back" to wherever the user came from, or "← Home" (the landing page)
// when there's no history, e.g. the auth screen was opened directly

// Always shown. With nothing to go back to (a fresh page, or a screen that
// replaced the one before it) it goes to `fallback` instead
export function AuthBackLink({ style, light = false, fallback = "/" }) {
  const router = useRouter();
  const color = light ? colors.white : colors.textSecondary;

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={8}
      accessibilityRole="link"
      style={[backLinkStyles.link, style]}
    >
      <Ionicons name="chevron-back" size={16} color={color} />
      <Text style={[backLinkStyles.text, { color }]}>Back</Text>
    </Pressable>
  );
}

const backLinkStyles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: 4, marginBottom: spacing.sm },
  text: { ...typography.caption, fontWeight: "700" },
});