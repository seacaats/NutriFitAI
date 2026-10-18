import { useResetPasswordForm } from "@/features/auth/hooks/useForgotPasswordForm";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";


export default function ResetPasswordScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useResetPasswordForm();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔑</Text>

          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            {form.email ? `For ${form.email}` : "Choose a new password for your account."}
          </Text>

          <FormInput
            label="New Password"
            placeholder="New password"
            value={form.password}
            maxLength={64}
            onChangeText={form.setPassword}
            onSubmitEditing={form.onSubmitEditing}
            secureTextEntry
            showToggle
            visible={form.showPassword}
            onToggleVisible={form.toggleShowPassword}
            style={styles.fieldSpacing}
            boxStyle={styles.grayInput}
          />

          <FormInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={form.confirmPassword}
            maxLength={64}
            onChangeText={form.setConfirmPassword}
            onSubmitEditing={form.onSubmitEditing}
            secureTextEntry
            showToggle
            visible={form.showConfirmPassword}
            onToggleVisible={form.toggleShowConfirmPassword}
            style={styles.fieldSpacing}
            boxStyle={styles.grayInput}
          />

          <FormAlert message={form.error} onDismiss={form.dismissError} />
          <FormAlert tone="success" message={form.success} onDismiss={form.dismissSuccess} />

          <PrimaryButton title="Reset Password" onPress={form.handleSubmit} loading={form.loading} style={styles.button} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
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
  hint: { ...typography.tiny, color: colors.textSecondary, marginTop: -8, marginBottom: spacing.md, alignSelf: "stretch" },
  button: { width: "100%" },
});