import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { validatePassword } from "@/shared/utils/authValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";


export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email, resetToken } = useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // The token is a route param, so it's missing on a direct visit or reload
    if (!resetToken) {
      setError("Your reset session has expired. Please start over from Forgot password.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const payload = await apiClient.post("/auth/reset-password", { resetToken, password }, { full: true });
      setSuccess(payload?.message || "Password reset! Redirecting to login...");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);

      // A rejected token can't be retried from this screen — send the user
      // back to the start of the flow instead of leaving them stuck here
      if (err instanceof ApiClientError && err.status === 401) {
        setTimeout(() => router.replace("/forgot-password"), 1800);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔑</Text>

          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            {email ? `For ${email}` : "Choose a new password for your account."}
          </Text>

          <FormInput
            placeholder="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.fieldSpacing, styles.grayInput]}
          />

          <FormInput
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={[styles.fieldSpacing, styles.grayInput]}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!success && <Text style={styles.success}>{success}</Text>}

          <PrimaryButton title="Reset Password" onPress={handleSubmit} loading={loading} style={styles.button} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
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
  fieldSpacing: { marginBottom: spacing.md, width: "100%" },
  grayInput: { backgroundColor: "#f9fafb" },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  success: { ...typography.caption, color: colors.primary, fontWeight: "700", marginBottom: spacing.sm },
  button: { width: "100%" },
});