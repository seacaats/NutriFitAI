import GoogleIcon from "@/features/auth/components/GoogleIcon";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";
import { apiClient } from "@/shared/api/apiClient";
import FormInput from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { loginStyles } from "@/shared/theme/screenStyles";
import { getAccessToken } from "@/shared/utils/authStorage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const BREAKPOINT = 768;

export default function LoginScreen() {
  const form = useLoginForm();
  const { width } = useWindowDimensions();
  const isWide = width >= BREAKPOINT;
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const token = await getAccessToken();

      if (!token) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      // A stored access token only proves one existed at some point — it may
      // be expired. Confirm the session is actually still valid via
      // /auth/me before redirecting away from login, otherwise an expired
      // token bounces the user to /dashboard only to get bounced straight
      // back by that screen's own auth guard
      try {
        await apiClient.get("/auth/me", { auth: true });
        if (!cancelled) router.replace("/dashboard");
        return; // navigating away — don't flip checkingSession
      } catch {
        // Not authenticated after all (expired token, refresh cookie also expired, etc.)
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSession) {
    return (
      <View style={styles.sessionCheckRoot}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {isWide && (
        <View style={styles.leftPanel}>
          <Pressable style={styles.leftPanelContent} onPress={() => router.push("/")} hitSlop={8}>
            <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.leftLogo} contentFit="contain" />
            <Text style={styles.leftHeading}>NutriFitAI</Text>
            <Text style={styles.leftQuote}>
              Your Food. Your Fitness. Your Future.{"\n"}Scan. Understand. Improve.
            </Text>
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView style={styles.rightPanel} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          {!isWide && (
            <Pressable style={styles.mobileBrandWrap} onPress={() => router.push("/")} hitSlop={8}>
              <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.mobileLogo} contentFit="contain" />
              <Text style={styles.mobileHeading}>NutriFitAI</Text>
            </Pressable>
          )}

          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Login to continue your journey</Text>

            <FormInput
              icon="mail-outline"
              placeholder="Email Address"
              value={form.email}
              onChangeText={form.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.fieldSpacing}
            />

            <FormInput
              icon="lock-closed-outline"
              placeholder="Password"
              value={form.password}
              onChangeText={form.setPassword}
              secureTextEntry
              showToggle
              visible={form.showPassword}
              onToggleVisible={form.toggleShowPassword}
              style={styles.fieldSpacing}
            />

            <View style={styles.row}>
              <Pressable style={styles.checkboxRow} onPress={form.toggleRememberMe}>
                <View style={[styles.checkbox, form.rememberMe && styles.checkboxChecked]}>
                  {form.rememberMe && <Ionicons name="checkmark" size={11} color={colors.white} />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable style={styles.forgotRow} onPress={form.goToForgotPassword}>
                <Ionicons name="key-outline" size={11} color={colors.green700} />
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            <PrimaryButton title="Login" onPress={form.handleLogin} loading={form.loading} />

            {!!form.error && <Text style={styles.errorText}>{form.error}</Text>}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <Pressable
                style={[styles.socialBtn, form.googleLoading && { opacity: 0.6 }]}
                onPress={form.handleGoogleLogin}
                disabled={form.googleLoading}
              >
                <GoogleIcon size={16} />
                <Text style={styles.socialText}>{form.googleLoading ? "Connecting…" : "Google"}</Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Pressable onPress={form.goToRegister}>
                <Text style={styles.link}>Register</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  ...loginStyles,

  root: { flex: 1, flexDirection: "row", backgroundColor: colors.screenDark },

  //Left panel
  leftPanel: { flex: 1, backgroundColor: colors.brandPanel, alignItems: "center", justifyContent: "center" },
  leftPanelContent: { alignItems: "center", maxWidth: 400, paddingHorizontal: spacing.xl },
  leftLogo: { width: 220, height: 220, marginBottom: spacing.md },
  leftHeading: { ...typography.brandHeading, color: colors.brandLight, textAlign: "center" },
  leftQuote: { ...typography.body, color: colors.quoteText, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },

  //Right Panel
  rightPanel: { flex: 1, backgroundColor: colors.bgMint },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 40,
    width: "100%",
    maxWidth: 448, // max-w-md
    alignSelf: "center",
    justifyContent: "center",
  },

  mobileBrandWrap: { alignItems: "center", marginBottom: spacing.xl },
  mobileLogo: { width: 160, height: 160 },
  mobileHeading: { ...typography.h2, fontSize: 24, color: colors.brandDark, marginTop: 4 },

  card: { backgroundColor: colors.authCard, borderRadius: radii.lg, padding: spacing.xl },
  title: { ...typography.h2, textAlign: "center", color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberText: { ...typography.tiny, color: colors.textSecondary },
  forgotRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { ...typography.tiny, color: colors.green700, fontWeight: "700" },
  socialRow: { flexDirection: "row", gap: spacing.sm },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingVertical: 12,
  },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },

  errorText: { ...typography.caption, color: colors.danger, marginTop: 16, textAlign: "center" },

  cancelRow: { alignItems: "center", marginTop: spacing.md, gap: 4 },
  cancelHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
});