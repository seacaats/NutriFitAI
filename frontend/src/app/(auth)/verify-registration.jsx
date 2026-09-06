import NutriFitLogo from "@components/nutrifit/NutriFitLogo";
import OtpInputRow from "@components/nutrifit/OtpInputRow";
import PrimaryButton from "@components/nutrifit/PrimaryButton";
import { useOtpInput } from "@hooks/use-otp-input";
import { colors, radii, spacing, typography } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


export default function VerifyRegistrationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const otp = useOtpInput(4);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerify = () => {
    if (otp.codeValue === "1234") {
      setSuccess("Email verified successfully!");
      setError("");
      setTimeout(() => router.replace("/login"), 1200);
    } else {
      setError("Invalid verification code. For testing, use 1234.");
      setSuccess("");
    }
  };

  const handleResend = () => {
    setSuccess("A new OTP has been sent to your email.");
    setError("");
  };

  return (
    <View style={styles.flex}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>We've sent a 4-digit verification code to</Text>
        <Text style={styles.email}>{email || "your email address"}</Text>
        <Text style={styles.hint}>Enter the code below to complete your registration.</Text>

        <View style={styles.otpWrap}>
          <OtpInputRow otp={otp} variant="primaryBorder" />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}

        <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
        <Pressable onPress={handleResend}>
          <Text style={styles.link}>Resend OTP</Text>
        </Pressable>

        <PrimaryButton title="Verify Email" onPress={handleVerify} style={styles.verifyBtn} />

        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Back to Registration</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
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
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10, textAlign: "center" },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2 },
  hint: { ...typography.tiny, color: colors.textMuted, marginTop: 6, textAlign: "center" },
  otpWrap: { marginTop: spacing.xl, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginTop: 4 },
  success: { ...typography.caption, color: colors.primary, fontWeight: "700", marginTop: 4 },
  resendPrompt: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: 4 },
  verifyBtn: { width: 208, marginTop: spacing.lg },
  backLink: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
});