import { useForgotPasswordForm } from "@/features/auth/hooks/useForgotPasswordForm";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { forgotPasswordStyles } from "@/shared/theme/screenStyles";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";


// forgot-password -> verify-reset-password -> reset-password
export default function ForgotPasswordScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useForgotPasswordForm();

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📧</Text>

          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>Enter your account email and we'll send you a 4-digit reset code.</Text>

          <FormInput
            label="Email"
            icon="mail-outline"
            placeholder="Enter your email address"
            value={form.email}
            onChangeText={form.setEmail}
            onSubmitEditing={form.onSubmitEditing}
            keyboardType="email-address"
            maxLength={254}
            autoCapitalize="none"
            style={styles.fieldSpacing}
            boxStyle={styles.grayInput}
          />

          <FormAlert message={form.error} onDismiss={form.dismissError} />

          <PrimaryButton title="Send Code" onPress={form.handleSubmit} loading={form.loading} style={styles.button} />

          <Pressable onPress={form.goToLogin}>
            <Text style={styles.backLink}>Back to login</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  ...forgotPasswordStyles(colors),

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
  fieldSpacing: { marginBottom: 20, width: "100%" },
  grayInput: { backgroundColor: colors.grayInputBg },
  button: { width: "100%" },
  backLink: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
});