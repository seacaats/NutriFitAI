import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const BREAKPOINT = 640;

export default function PublicHeader({ isAuthenticated = false }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < BREAKPOINT;

  return (
    <View style={styles.bar}>
      <Pressable style={styles.brand} onPress={() => router.push("/")} hitSlop={8}>
        <NutriFitLogo small={compact} />
      </Pressable>

      <View style={styles.actions}>
        {isAuthenticated ? (
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/dashboard")}>
            <Text style={styles.primaryBtnText}>Dashboard</Text>
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