import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Shown when a route guard refuses a navigation. Three variants:
 *  - unauthenticated: no session at all
 *  - unverified:      signed in, email not confirmed
 *  - forbidden:       signed in and verified, but the role isn't permitted
 */
const VARIANTS = {
  unauthenticated: {
    emoji: "🔒",
    title: "Sign in required",
    body: "You need to be signed in to open this page.",
    action: "Go to Login",
  },
  unverified: {
    emoji: "📧",
    title: "Verify your email",
    body: "Confirm your email address to unlock the rest of NutriFit.",
    action: "Verify Email",
  },
  forbidden: {
    emoji: "⛔",
    title: "Access denied",
    body: "Your account doesn't have permission to view this page.",
    action: "Back to Dashboard",
  },
  "admin-web-only": {
    icon: "🖥️",
    title: "Please use the web app",
    body: "Admin and superadmin accounts aren't supported on mobile. Please sign in from the web interface instead.",
    action: "Logout and Go to Login",
  },
};

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccessDeniedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, role, signOut } = useAuth();

  const reason = firstParam(params.reason) || "unauthenticated";
  const from = firstParam(params.from);
  const variant = VARIANTS[reason] || VARIANTS.unauthenticated;

  async function handlePrimary() {
    if (reason === "unverified") {
      router.replace({ pathname: "/verify-registration", params: { email: user?.email } });
      return;
    }
    if (reason === "forbidden") {
      router.replace("/dashboard");
      return;
    }

    // unauthenticated/web-admin-only flagged
    // clear any stale token, then send user to login.
    await signOut();
    router.replace({ pathname: "/login", params: from ? { next: from } : {} });
  }

  return (
    <View style={styles.flex}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{variant.emoji}</Text>
          <Text style={styles.title}>{variant.title}</Text>
          <Text style={styles.subtitle}>{variant.body}</Text>

          {reason === "forbidden" && (
            <Text style={styles.pathHint}>Signed in as {user?.email || "your account"} ({role})</Text>
          )}

          <PrimaryButton title={variant.action} onPress={handlePrimary} style={styles.button} />

          {reason !== "unauthenticated" && reason !== "admin-web-only" && (
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: spacing.lg,
  },
  pathHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
  button: { width: "100%" },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: spacing.md },
});