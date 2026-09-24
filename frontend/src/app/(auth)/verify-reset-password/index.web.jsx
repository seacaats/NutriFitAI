import OtpInputRow from "@/features/auth/components/OtpInputRow";
import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { useResendCooldown } from "@/features/auth/hooks/useResendCooldown";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, spacing, typography } from "@/shared/theme/nutrifit";
import { verifyResetPasswordStyles } from "@/shared/theme/screenStyles";
import { validateOtp } from "@/shared/utils/authValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const otp = useOtpInput(4);
  const resend = useResendCooldown();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (!email) {
      setError("We've lost track of which account you're resetting. Please start again.");
      return;
    }

    const otpError = validateOtp(otp.codeValue, otp.length);
    if (otpError) {
      setError(otpError);
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // Verifies the OTP and exchanges it for a short-lived reset
      // authorization — the password itself hasn't changed yet
      const data = await apiClient.post("/auth/verify-password-reset", {
        email,
        code: otp.codeValue,
      });

      if (!data?.resetToken) {
        setError("The server didn't return a reset authorization. Please try again.");
        otp.reset();
        return;
      }

      router.replace({ pathname: "/reset-password", params: { email, resetToken: data.resetToken } });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      otp.reset();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!resend.canResend || resending) return;
    if (!email) {
      setError("We've lost track of which account you're resetting. Please start again.");
      return;
    }
    setResending(true);
    setError("");
    setSuccess("");
    try {
      // forgot-password invalidates any active challenge and issues a new
      // one, so it doubles as the resend endpoint for this flow
      const payload = await apiClient.post("/auth/forgot-password", { email }, { full: true });
      // Generic by design on the server, to avoid confirming the account exists
      setSuccess(payload?.message || "If an account exists for this email, a new code has been sent.");
      resend.start();
      otp.reset();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Couldn't resend the code.";
      setError(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.root}>
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
        {!!success && <Text style={styles.success}>{success}</Text>}

        <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
        <Pressable onPress={handleResend} disabled={!resend.canResend || resending}>
          <Text style={[styles.link, !resend.canResend && styles.linkDisabled]}>
            {resend.canResend ? "Resend OTP" : `Resend OTP (${resend.remaining}s)`}
          </Text>
        </Pressable>

        <PrimaryButton title="Verify" onPress={handleVerify} loading={loading} style={styles.verifyBtn} />

        <Pressable onPress={() => router.replace("/forgot-password")}>
          <Text style={styles.changeEmail}>Change email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...verifyResetPasswordStyles,

  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary },
  otpWrap: { marginTop: spacing.xl, marginBottom: spacing.sm },
  resendPrompt: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  verifyBtn: { width: 208, marginTop: spacing.lg },
  changeEmail: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
});