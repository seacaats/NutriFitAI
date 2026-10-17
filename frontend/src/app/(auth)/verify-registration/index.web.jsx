import OtpInputRow, { OtpHelpLine } from "@/features/auth/components/OtpInputRow";
import { useVerifyRegistration } from "@/features/auth/hooks/useRegisterForm";
import { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { verifyRegistrationStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function VerifyRegistrationScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useVerifyRegistration();

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>We've sent a 4-digit verification code to</Text>
        <Text style={styles.email}>{form.email || "your email address"}</Text>
        <Text style={styles.hint}>Enter the code below to complete your registration.</Text>
        <Text style={styles.hint}>Unverified accounts are removed after 48 hours.</Text>

        <View style={styles.otpWrap}>
          <OtpInputRow otp={form.otp} variant="primaryBorder" />
        </View>

        <FormAlert message={form.error} onDismiss={form.dismissError} style={styles.alert} />
        <FormAlert tone="success" message={form.success} onDismiss={form.dismissSuccess} style={styles.alert} />

        <OtpHelpLine
          onResend={form.handleResend}
          onUpdateEmail={form.updateEmail}
          resending={form.resending}
          cooldown={form.cooldown}
        />

        <PrimaryButton title="Verify Email" onPress={form.handleVerify} loading={form.loading} style={styles.verifyBtn} />
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  // Centred under the code boxes: FormAlert stretches by default, so with a
  // maxWidth alone it sat against the left edge
  alert: { marginTop: spacing.sm, marginBottom: 0, maxWidth: 384, width: "100%", alignSelf: "center" },
  ...verifyRegistrationStyles(colors),

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  otpWrap: { marginTop: spacing.xl, marginBottom: spacing.sm },
  verifyBtn: { width: 208, marginTop: spacing.lg },
});