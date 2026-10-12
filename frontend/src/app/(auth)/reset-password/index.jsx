import { useResetPasswordForm } from "@/features/auth/hooks/useForgotPasswordForm";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const form = useResetPasswordForm();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={40} color={colors.primary} />
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>
              {form.email ? `For ${form.email}` : "Choose a new password for your account."}
            </Text>
          </View>

          <FormInput
            label="New Password"
            icon="lock-closed-outline"
            placeholder="New password (min. 8 characters, no spaces)"
            value={form.password}
            onChangeText={form.setPassword}
            secureTextEntry
            showToggle
            visible={form.showPassword}
            onToggleVisible={form.toggleShowPassword}
            style={styles.fieldSpacing}
          />

          <FormInput
            label="Confirm New Password"
            icon="lock-closed-outline"
            placeholder="Re-enter new password"
            value={form.confirmPassword}
            onChangeText={form.setConfirmPassword}
            secureTextEntry
            showToggle
            visible={form.showConfirmPassword}
            onToggleVisible={form.toggleShowConfirmPassword}
            style={styles.fieldSpacing}
          />

          <FormAlert message={form.error} onDismiss={form.dismissError} />
          <FormAlert tone="success" message={form.success} onDismiss={form.dismissSuccess} />

          <View style={styles.spacer} />

          <PrimaryButton title="Reset Password" onPress={form.handleSubmit} loading={form.loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
  flex1: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: "center" },


  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },

  headerBlock: { marginBottom: spacing.lg, alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: "center" },

  fieldSpacing: { marginBottom: 20 },
  hint: { ...typography.tiny, color: colors.textSecondary, marginTop: -8, marginBottom: spacing.md, alignSelf: "stretch" },
  spacer: { height: spacing.sm },
});