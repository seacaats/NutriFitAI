import OtpInputRow, { OtpHelpLine } from "@/features/auth/components/OtpInputRow";
import { useVerifyResetPassword } from "@/features/auth/hooks/useForgotPasswordForm";
import { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing } from "@/shared/theme/nutrifitai";
import { verifyResetPasswordStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VerifyOtpScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useVerifyResetPassword();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>We've sent a 4-digit code to</Text>
            <Text style={styles.email}>{form.email || "your email"}</Text>
          </View>

          <View style={styles.otpWrap}>
            <OtpInputRow otp={form.otp} />
          </View>

          <FormAlert message={form.error} onDismiss={form.dismissError} style={styles.alert} />
          <FormAlert tone="success" message={form.success} onDismiss={form.dismissSuccess} style={styles.alert} />

          <OtpHelpLine
            onResend={form.handleResend}
            onUpdateEmail={form.updateEmail}
            resending={form.resending}
            cooldown={form.cooldown}
          />

          <View style={styles.spacer} />

          <PrimaryButton title="Verify" onPress={form.handleVerify} loading={form.loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  // Centred under the code boxes: FormAlert stretches by default, so with a
  // maxWidth alone it sat against the left edge
  alert: { marginTop: spacing.sm, marginBottom: 0, maxWidth: 384, width: "100%", alignSelf: "center" },
  ...verifyResetPasswordStyles(colors),

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

  headerBlock: { alignItems: "center", marginBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },

  otpWrap: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.sm },

  spacer: { height: spacing.lg },
});