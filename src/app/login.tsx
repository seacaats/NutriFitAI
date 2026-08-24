import FormInput from "@/components/nutrifit/FormInput";
import PrimaryButton from "@/components/nutrifit/PrimaryButton";
import { colors, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // mock auth call
    setTimeout(() => {
      setLoading(false);
      router.replace("/(tabs)/home");
    }, 800);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="barbell-outline" size={40} color={colors.white} />
          </View>
          <Text style={styles.brand}>NutriFit AI</Text>
        </View>

        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Login to continue your journey</Text>

        <View style={styles.form}>
          <FormInput
            icon="mail-outline"
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.fieldSpacing}
          />
          <FormInput
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            showToggle
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            style={styles.fieldSpacing}
          />

          <View style={styles.row}>
            <Pressable style={styles.checkboxRow} onPress={() => setRememberMe((v) => !v)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </Pressable>
            <Pressable onPress={() => {}}>
              <Text style={styles.link}>Forgot Password?</Text>
            </Pressable>
          </View>

          <PrimaryButton title="Login" onPress={handleLogin} loading={loading} style={styles.loginBtn} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn}>
              <Ionicons name="logo-google" size={18} color="#8BC34A" />
              <Text style={styles.socialText}>Google</Text>
            </Pressable>
            <Pressable style={styles.socialBtn}>
              <Ionicons name="logo-facebook" size={18} color="#8BC34A"/>
              <Text style={styles.socialText}>Facebook</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Dont have an account? </Text>
            <Pressable onPress={() => router.push("/register")}>
              <Text style={styles.link}>Register</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  container: {
    flexGrow: 1,
    backgroundColor: colors.bgMint,
    paddingHorizontal: spacing.lg,
    paddingTop: 80,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  logoWrap: { alignItems: "center", marginBottom: spacing.lg },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md
  },
  brand: { ...typography.h1, color: colors.primaryLight },
  title: { ...typography.h2, textAlign: "center", marginTop: spacing.lg },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  form: { width: "100%" },
  fieldSpacing: { marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  rememberText: { ...typography.caption, color: colors.textPrimary },
  link: { color: colors.primary, fontWeight: "700" },
  loginBtn: { backgroundColor: colors.primaryLight, marginBottom: spacing.lg },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#000000" },
  orText: { textAlign: "center", color: colors.textSecondary, marginHorizontal: 10 },
  socialRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xl },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 4,
    gap: 8,
    ...Platform.select({
      web: { boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.05)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  socialText: { fontWeight: "700", color: colors.textPrimary },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: colors.textSecondary },
});