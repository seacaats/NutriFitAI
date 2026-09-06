import NutriFitLogo from "@/components/nutrifit/NutriFitLogo";
import FormInput from "@/components/nutrifit/FormInput";
import PrimaryButton from "@/components/nutrifit/PrimaryButton";
import { useForgotPasswordForm } from "@/hooks/use-forgot-password-form";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";


export default function ForgotPasswordScreen() {
  const form = useForgotPasswordForm();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔐</Text>

          <Text style={styles.title}>Enter your email</Text>
          <Text style={styles.subtitle}>Please enter the email you used to{"\n"}create your account.</Text>

          <FormInput
            placeholder="Email Address"
            value={form.email}
            onChangeText={form.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.fieldSpacing, styles.grayInput]}
          />

          <PrimaryButton title="Send OTP" onPress={form.handleSubmit} loading={form.loading} style={styles.button} />

          <Pressable onPress={form.goToLogin}>
            <Text style={styles.link}>Back to Login</Text>
          </Pressable>
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
    maxWidth: 384, // max-w-sm
    backgroundColor: colors.white,
    borderRadius: radii.md, // rounded-xl
    padding: spacing.xl,
    alignItems: "center",
  },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: 8, marginBottom: spacing.lg },
  fieldSpacing: { marginBottom: spacing.md, width: "100%" },
  grayInput: { backgroundColor: "#f9fafb" }, // bg-gray-50
  button: { width: "100%" },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: spacing.md },
});
