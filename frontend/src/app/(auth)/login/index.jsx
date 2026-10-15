import GoogleIcon from "@/features/auth/components/GoogleIcon";
import { MfaChallenge } from "@/features/auth/components/OtpInputRow";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";
import { AuthBackLink } from "@/shared/components/layout/PublicHeader";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { loginStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import {
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
  const insets = useSafeAreaInsets();

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
          {/* Back to the landing page (or wherever they came from) */}
          <AuthBackLink />

          <View style={styles.headerBlock}>
            <Text style={styles.title}>{form.mfa ? "Verify it's you" : "Welcome back!"}</Text>
            <Text style={styles.subtitle}>{form.mfa ? "Two-factor authentication" : "Login to continue your journey"}</Text>
          </View>

          <View style={styles.form}>
            {form.mfa ? (
              <MfaChallenge form={form} styles={styles} />
            ) : (
            <>
            <FormInput
              label="Email"
              icon="mail-outline"
              placeholder="Email"
              value={form.email}
              onChangeText={form.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.fieldSpacing}
            />

            <FormInput
              label="Password"
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

            <FormAlert message={form.error} onDismiss={form.dismissError} style={styles.alert} />

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
            </>
            )}
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

  alert: { marginTop: spacing.md, marginBottom: 0 },
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