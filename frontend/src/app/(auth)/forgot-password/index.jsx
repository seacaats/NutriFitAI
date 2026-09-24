import { useForgotPasswordForm } from "@/features/auth/hooks/useForgotPasswordForm";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { forgotPasswordStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


// forgot-password -> verify-reset-password -> reset-password
export default function ForgotPasswordScreen() {
  const form = useForgotPasswordForm();
  const insets = useSafeAreaInsets();

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
            <Ionicons name="mail-outline" size={40} color={colors.primary} />
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>Enter your account email and we'll send you a 4-digit reset code.</Text>
          </View>

          <FormInput
            icon="mail-outline"
            placeholder="Email Address"
            value={form.email}
            onChangeText={form.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.fieldSpacing}
          />

          {!!form.error && <Text style={styles.error}>{form.error}</Text>}

          <View style={styles.spacer} />

          <PrimaryButton title="Send Code" onPress={form.handleSubmit} loading={form.loading} />

          <Pressable style={styles.backLinkWrap} onPress={form.goToLogin} hitSlop={8}>
            <Text style={styles.backLink}>Back to login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  ...forgotPasswordStyles,

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

  headerBlock: { marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6 },

  fieldSpacing: { marginBottom: spacing.md },
  spacer: { height: spacing.sm },

  backLinkWrap: { alignSelf: "center", marginTop: spacing.lg },
  backLink: { ...typography.caption, color: colors.textMuted },
});