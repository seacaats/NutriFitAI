import OtpInputRow from "@/features/auth/components/OtpInputRow";
import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { verifyRegistrationStyles } from "@/shared/theme/screenStyles";
import { validateOtp } from "@/shared/utils/authValidators";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VerifyRegistrationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const otp = useOtpInput(4);
  const insets = useSafeAreaInsets();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    // Reached directly or after a reload, this screen can render without the
    // email it needs to verify against
    if (!email) {
      setSuccess("");
      setError("We don't know which account to verify. Please register or log in again.");
      return;
    }

    const otpError = validateOtp(otp.codeValue, otp.length);
    if (otpError) {
      setSuccess("");
      setError(otpError);
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const payload = await apiClient.post(
        "/auth/verify-registration",
        { email: email?.toLowerCase(), code: otp.codeValue },
        { full: true },
      );

      setSuccess(payload?.message || "Email verified successfully!");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      // A wrong or expired code leaves stale digits in the boxes otherwise
      otp.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setSuccess("");
      setError("We don't know which email to send the code to. Please register or log in again.");
      return;
    }

    setError("");
    setSuccess("");
    setResending(true);

    try {
      const payload = await apiClient.post(
        "/auth/resend-registration-otp",
        { email: email?.toLowerCase() },
        { full: true },
      );
      // The server answers generically ("If an account exists…") on purpose,
      // so show its wording rather than implying the account exists
      setSuccess(payload?.message || "If an account exists for this email, a new code has been sent.");
      otp.reset();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Couldn't resend the code. Try again.";
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <NutriFitLogo small />
          </View>

          <View style={styles.iconCircle}>
            <Ionicons name="mail-open-outline" size={40} color={colors.primary} />
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>We've sent a 4-digit verification code to</Text>
            <Text style={styles.email}>{email || "your email address"}</Text>
            <Text style={styles.hint}>Enter the code below to complete your registration.</Text>
          </View>

          <View style={styles.otpWrap}>
            <OtpInputRow otp={otp} variant="primaryBorder" />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!success && <Text style={styles.success}>{success}</Text>}

          <View style={styles.resendBlock}>
            <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
            <Pressable onPress={handleResend} disabled={resending} hitSlop={6}>
              <Text style={styles.link}>{resending ? "Sending..." : "Resend OTP"}</Text>
            </Pressable>
          </View>

          <View style={styles.spacer} />

          <PrimaryButton title="Verify Email" onPress={handleVerify} loading={loading} />

          <Pressable style={styles.backLinkWrap} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backLink}>Back to Registration</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  ...verifyRegistrationStyles,

  flex1: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: "center" },

  brandRow: { position: "absolute", top: spacing.sm, left: spacing.lg },

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
  error: { ...typography.caption, color: colors.danger, marginTop: 4, textAlign: "center" },
  success: { ...typography.caption, color: colors.primary, fontWeight: "700", marginTop: 4, textAlign: "center" },

  resendBlock: { alignItems: "center", marginTop: spacing.md },
  resendPrompt: { ...typography.caption, color: colors.textMuted },

  spacer: { height: spacing.lg },
  backLinkWrap: { alignSelf: "center", marginTop: spacing.md },
  backLink: { ...typography.caption, color: colors.textMuted },
});