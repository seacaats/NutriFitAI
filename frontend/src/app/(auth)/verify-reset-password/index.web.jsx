import OtpInputRow, { OtpHelpLine } from "@/features/auth/components/OtpInputRow";
import { useVerifyResetPassword } from "@/features/auth/hooks/useForgotPasswordForm";
import { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, spacing, typography } from "@/shared/theme/nutrifitai";
import { verifyResetPasswordStyles } from "@/shared/theme/screenStyles";
import { StyleSheet, Text, View } from "react-native";

export default function VerifyOtpScreen() {
  const form = useVerifyResetPassword();

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>We've sent a 4-digit code to</Text>
        <Text style={styles.email}>{form.email || "your email"}</Text>

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

        <PrimaryButton title="Verify" onPress={form.handleVerify} loading={form.loading} style={styles.verifyBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centred under the code boxes: FormAlert stretches by default, so with a
  // maxWidth alone it sat against the left edge
  alert: { marginTop: spacing.sm, marginBottom: 0, maxWidth: 384, width: "100%", alignSelf: "center" },
  ...verifyResetPasswordStyles,

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary },
  otpWrap: { marginTop: spacing.xl, marginBottom: spacing.sm },
  verifyBtn: { width: 208, marginTop: spacing.lg },
});