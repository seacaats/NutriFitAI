import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Shown when a route guard refuses a navigation. Three variants:
 *  - unauthenticated: no session at all
 *  - unverified:      signed in, email not confirmed
 *  - forbidden:       signed in and verified, but the role isn't permitted
 */
const VARIANTS = {
  unauthenticated: {
    icon: "lock-closed",
    title: "Sign in required",
    body: "You need to be signed in to open this page.",
    action: "Go to Login",
  },
  unverified: {
    icon: "mail",
    title: "Verify your email",
    body: "Confirm your email address to unlock the rest of NutriFit.",
    action: "Verify Email",
  },
  forbidden: {
    icon: "ban",
    title: "Access denied",
    body: "Your account doesn't have permission to view this page.",
    action: "Back to Dashboard",
  },
  "admin-web-only": {
    icon: "desktop-outline",
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
  const insets = useSafeAreaInsets();

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.brandRow}>
        <NutriFitLogo small />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name={variant.icon} size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>{variant.title}</Text>
        <Text style={styles.subtitle}>{variant.body}</Text>

        {reason === "forbidden" && (
          <Text style={styles.pathHint}>Signed in as {user?.email || "your account"} ({role})</Text>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton title={variant.action} onPress={handlePrimary} />

        {reason !== "unauthenticated" && reason !== "admin-web-only" && (
          <Pressable
            style={styles.signOutWrap}
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
            hitSlop={8}
          >
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
  brandRow: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },

  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  pathHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },

  footer: { paddingHorizontal: spacing.lg },
  signOutWrap: { alignSelf: "center", marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },
});