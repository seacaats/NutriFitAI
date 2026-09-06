import FormInput from "@components/nutrifit/FormInput";
import PrimaryButton from "@components/nutrifit/PrimaryButton";
import GoogleIcon from "@components/nutrifit/GoogleIcon";
import FacebookIcon from "@components/nutrifit/FacebookIcon";
import { useLoginForm } from "@hooks/use-login-form";
import { colors, radii, spacing, typography } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const BREAKPOINT = 768;

export default function LoginScreen() {
  const form = useLoginForm();
  const { width } = useWindowDimensions();
  const isWide = width >= BREAKPOINT;

  return (
    <View style={styles.root}>
      {isWide && (
        <View style={styles.leftPanel}>
          <View style={styles.leftPanelContent}>
            <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.leftLogo} contentFit="contain" />
            <Text style={styles.leftHeading}>NutriFit AI</Text>
            <Text style={styles.leftQuote}>
              Your Food. Your Fitness. Your Future.{"\n"}Scan. Understand. Improve.
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView style={styles.rightPanel} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          {!isWide && (
            <View style={styles.mobileBrandWrap}>
              <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.mobileLogo} contentFit="contain" />
              <Text style={styles.mobileHeading}>NutriFit AI</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Login to continue your journey</Text>

            <FormInput
              icon="mail-outline"
              placeholder="Email Address"
              value={form.email}
              onChangeText={form.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.fieldSpacing}
            />

            <FormInput
              icon="lock-closed-outline"
              placeholder="Password"
              value={form.password}
              onChangeText={form.setPassword}
              secureTextEntry
              showToggle
              visible={form.showPassword}
              onToggleVisible={form.toggleShowPassword}
              style={styles.fieldSpacing}
            />

            <View style={styles.row}>
              <Pressable style={styles.checkboxRow} onPress={form.toggleRememberMe}>
                <View style={[styles.checkbox, form.rememberMe && styles.checkboxChecked]}>
                  {form.rememberMe && <Ionicons name="checkmark" size={11} color={colors.white} />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable style={styles.forgotRow} onPress={form.goToForgotPassword}>
                <Ionicons name="key-outline" size={11} color={colors.green700} />
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            <PrimaryButton title="Login" icon="log-in-outline" onPress={form.handleLogin} loading={form.loading} />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn}>
                <GoogleIcon size={16} />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
              <Pressable style={styles.socialBtn}>
                <FacebookIcon size={16} />
                <Text style={styles.socialText}>Facebook</Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Pressable onPress={form.goToRegister}>
                <Text style={styles.link}>Register</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.screenDark },

  //Left panel
  leftPanel: { flex: 1, backgroundColor: colors.brandPanel, alignItems: "center", justifyContent: "center" },
  leftPanelContent: { alignItems: "center", maxWidth: 400, paddingHorizontal: spacing.xl },
  leftLogo: { width: 220, height: 220, marginBottom: spacing.md },
  leftHeading: { ...typography.brandHeading, color: colors.brandLight, textAlign: "center" },
  leftQuote: { ...typography.body, color: colors.quoteText, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },

  //Right Panel
  rightPanel: { flex: 1, backgroundColor: colors.bgMint },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 40,
    width: "100%",
    maxWidth: 448, // max-w-md
    alignSelf: "center",
    justifyContent: "center",
  },

  mobileBrandWrap: { alignItems: "center", marginBottom: spacing.xl },
  mobileLogo: { width: 160, height: 160 },
  mobileHeading: { ...typography.h2, fontSize: 24, color: colors.brandDark, marginTop: 4 },

  card: { backgroundColor: colors.authCard, borderRadius: radii.lg, padding: spacing.xl },
  title: { ...typography.h2, textAlign: "center", color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  fieldSpacing: { marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },
  rememberText: { ...typography.tiny, color: colors.textSecondary },
  forgotRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { ...typography.tiny, color: colors.green700, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orText: { ...typography.tiny, color: colors.textMuted, marginHorizontal: 10 },
  socialRow: { flexDirection: "row", gap: spacing.sm },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingVertical: 12,
  },
  socialText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { ...typography.caption, color: colors.textSecondary },
});
