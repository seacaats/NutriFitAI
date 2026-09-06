import NutriFitLogo from "@components/nutrifit/NutriFitLogo";
import OtpInputRow from "@components/nutrifit/OtpInputRow";
import PrimaryButton from "@components/nutrifit/PrimaryButton";
import { useOtpInput } from "@hooks/use-otp-input";
import { colors, spacing, typography } from "@theme/nutrifit";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const otp = useOtpInput(4);
  const [error, setError] = useState("");

  const handleVerify = () => {
    if (otp.codeValue === "1234") {
      router.replace("/verified");
    } else {
      setError("Invalid OTP. For testing, use 1234.");
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>We've sent a 4-digit code to</Text>
        <Text style={styles.email}>{email || "your email"}</Text>

        <View style={styles.otpWrap}>
          <OtpInputRow otp={otp} />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
        <Pressable onPress={() => setError("")}>
          <Text style={styles.link}>Resend OTP</Text>
        </Pressable>

        <PrimaryButton title="Verify" onPress={handleVerify} style={styles.verifyBtn} />

        <Pressable onPress={() => router.replace("/forgot-password")}>
          <Text style={styles.changeEmail}>Change email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10 },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2 },
  otpWrap: { marginTop: spacing.xl, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginTop: 4 },
  resendPrompt: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: 4 },
  verifyBtn: { width: 208, marginTop: spacing.lg },
  changeEmail: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
});