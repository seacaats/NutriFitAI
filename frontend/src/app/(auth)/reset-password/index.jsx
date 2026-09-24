import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { validatePassword } from "@/shared/utils/authValidators";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email, resetToken } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

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
            <Ionicons name="key-outline" size={40} color={colors.primary} />
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>
              {email ? `For ${email}` : "Choose a new password for your account."}
            </Text>
          </View>

          <FormInput
            icon="lock-closed-outline"
            placeholder="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.fieldSpacing}
          />

          <FormInput
            icon="lock-closed-outline"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.fieldSpacing}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!success && <Text style={styles.success}>{success}</Text>}

          <View style={styles.spacer} />

          <PrimaryButton title="Reset Password" onPress={handleSubmit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
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

  headerBlock: { marginBottom: spacing.lg, alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: "center" },

  fieldSpacing: { marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
  success: { ...typography.caption, color: colors.primary, fontWeight: "700", marginBottom: spacing.sm, textAlign: "center" },
  spacer: { height: spacing.sm },
});