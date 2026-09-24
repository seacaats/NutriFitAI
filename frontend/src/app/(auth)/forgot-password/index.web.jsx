import { useForgotPasswordForm } from "@/features/auth/hooks/useForgotPasswordForm";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { forgotPasswordStyles } from "@/shared/theme/screenStyles";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";


// forgot-password -> verify-reset-password -> reset-password
export default function ForgotPasswordScreen() {
  const form = useForgotPasswordForm();

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📧</Text>

          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>Enter your account email and we'll send you a 4-digit reset code.</Text>

          <FormInput
            icon="mail-outline"
            placeholder="Email Address"
            value={form.email}
            onChangeText={form.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.fieldSpacing, styles.grayInput]}
          />

          {!!form.error && <Text style={styles.error}>{form.error}</Text>}

          <PrimaryButton title="Send Code" onPress={form.handleSubmit} loading={form.loading} style={styles.button} />

          <Pressable onPress={form.goToLogin}>
            <Text style={styles.backLink}>Back to login</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ...forgotPasswordStyles,

  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 384,
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
  fieldSpacing: { marginBottom: spacing.md, width: "100%" },
  grayInput: { backgroundColor: colors.grayInputBg },
  button: { width: "100%" },
  backLink: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
});