import GoogleIcon from "@/features/auth/components/GoogleIcon";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";
import { apiClient } from "@/shared/api/apiClient";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { loginStyles } from "@/shared/theme/screenStyles";
import { getAccessToken } from "@/shared/utils/authStorage";
import { Ionicons } from "@expo/vector-icons";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const form = useLoginForm();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      // back by that screen's own auth guard.
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.brandRow} onPress={() => router.push("/")} hitSlop={8}>
            <NutriFitLogo small />
          </Pressable>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.subtitle}>Login to continue your journey</Text>
          </View>

          <View style={styles.form}>
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
              <Pressable style={styles.checkboxRow} onPress={form.toggleRememberMe} hitSlop={6}>
                <View style={[styles.checkbox, form.rememberMe && styles.checkboxChecked]}>
                  {form.rememberMe && <Ionicons name="checkmark" size={11} color={colors.white} />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable style={styles.forgotRow} onPress={form.goToForgotPassword} hitSlop={6}>
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            {!!form.error && <Text style={styles.errorText}>{form.error}</Text>}

            <View style={styles.spacer} />

            <PrimaryButton title="Login" onPress={form.handleLogin} loading={form.loading} />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.socialBtn, form.googleLoading && styles.socialBtnDisabled]}
              onPress={form.handleGoogleLogin}
              disabled={form.googleLoading}
            >
              <GoogleIcon size={16} />
              <Text style={styles.socialText}>{form.googleLoading ? "Connecting…" : "Continue with Google"}</Text>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Pressable onPress={form.goToRegister} hitSlop={6}>
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

  root: { flex: 1, backgroundColor: colors.bgMint },
  flex1: { flex: 1 },

  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },

  brandRow: { alignSelf: "flex-start", marginBottom: spacing.xl, marginTop: spacing.sm },

  headerBlock: { marginBottom: spacing.lg },
  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  form: {},
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberText: { ...typography.caption, color: colors.textSecondary },
  forgotRow: {},
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },

  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  spacer: { height: spacing.lg },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  socialBtnDisabled: { opacity: 0.6 },

  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});