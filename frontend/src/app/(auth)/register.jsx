import FormInput from "@components/nutrifit/FormInput";
import PrimaryButton from "@components/nutrifit/PrimaryButton";
import { GENDERS, GOALS, useRegisterForm } from "@hooks/use-register-form";
import { colors, radii, spacing, typography } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";


const BREAKPOINT = 1024;

export default function RegisterScreen() {
  const form = useRegisterForm();
  const { width } = useWindowDimensions();
  const isWide = width >= BREAKPOINT;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.leftPanel} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          {!isWide && (
            <View style={styles.mobileBrandWrap}>
              <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.mobileLogo} contentFit="contain" />
              <Text style={styles.mobileHeading}>NutriFit AI</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Start your healthy lifestyle today!</Text>

            <FormInput size="sm" icon="person-outline" placeholder="Full Name" value={form.fullName} onChangeText={form.setFullName} style={styles.fieldSpacing} />

            <FormInput size="sm"
              icon="mail-outline"
              placeholder="Email Address"
              value={form.email}
              onChangeText={form.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.fieldSpacing}
            />

            <FormInput size="sm"
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

            <FormInput size="sm"
              icon="lock-closed-outline"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChangeText={form.setConfirmPassword}
              secureTextEntry
              showToggle
              visible={form.showConfirmPassword}
              onToggleVisible={form.toggleShowConfirmPassword}
              style={styles.fieldSpacing}
            />

            {/* Age / Height / Weight */}
            <View style={[styles.row, styles.fieldSpacing]}>
              <FormInput size="sm" icon="calendar-outline" placeholder="Age" value={form.age} onChangeText={form.setAge} keyboardType="number-pad" style={styles.thirdField} />
              <FormInput size="sm" icon="resize-outline" placeholder="Height" value={form.height} onChangeText={form.setHeight} style={styles.thirdField} />
              <FormInput size="sm" icon="barbell-outline" placeholder="Weight" value={form.weight} onChangeText={form.setWeight} style={styles.thirdField} />
            </View>

            {/* Gender */}
            <Text style={styles.sectionLabel}>
              <Ionicons name="person-circle-outline" size={13} color={colors.green700} /> Gender
            </Text>
            <View style={[styles.genderRow, styles.fieldSpacing]}>
              {GENDERS.map((g) => (
                <Pressable key={g} onPress={() => form.setGender(g)} style={[styles.genderPill, form.gender === g && styles.genderPillActive]}>
                  <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            {/* Fitness Goal */}
            <Pressable style={[styles.goalSelect, styles.fieldSpacing]} onPress={form.toggleGoalPicker}>
              <View style={styles.goalSelectLeft}>
                <Ionicons name="flag-outline" size={16} color={colors.green600} />
                <Text style={form.goal ? styles.goalText : styles.goalPlaceholder}>{form.goal || "Select your goal"}</Text>
              </View>
              <Ionicons name={form.goalPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.green600} />
            </Pressable>

            {form.goalPickerOpen && (
              <View style={[styles.goalOptions, styles.fieldSpacing]}>
                {GOALS.map((g) => (
                  <Pressable key={g.value} style={styles.goalOption} onPress={() => form.selectGoal(g.label)}>
                    <Text style={styles.goalOptionText}>{g.label}</Text>
                    {form.goal === g.label && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Terms */}
            <Pressable style={styles.termsRow} onPress={form.toggleAgreeTerms}>
              <View style={[styles.checkbox, form.agreeTerms && styles.checkboxChecked]}>
                {form.agreeTerms && <Ionicons name="checkmark" size={11} color={colors.white} />}
              </View>
              <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
            </Pressable>

            {!!form.error && <Text style={styles.error}>{form.error}</Text>}

            <PrimaryButton title="Create Account" icon="person-add-outline" onPress={form.handleCreateAccount} loading={form.loading} style={styles.submitBtn} />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable onPress={form.goToLogin}>
                <Text style={styles.link}>Login</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isWide && (
        <View style={styles.rightPanel}>
          <View style={styles.rightPanelContent}>
            <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.rightLogo} contentFit="contain" />
            <Text style={styles.rightHeading}>NutriFit AI</Text>
            <Text style={styles.rightQuote}>
              Your Food. Your Fitness. Your Future.{"\n"}Scan. Understand. Improve.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.screenDark },

  // Left panel
  leftPanel: { flex: 1, backgroundColor: colors.bgMint },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 32,
    width: "100%",
    maxWidth: 448, // max-w-md
    alignSelf: "center",
    justifyContent: "center",
  },

  mobileBrandWrap: { alignItems: "center", marginBottom: spacing.lg },
  mobileLogo: { width: 80, height: 80 },
  mobileHeading: { ...typography.h2, fontSize: 24, color: colors.brandDark },

  card: { backgroundColor: colors.authCard, borderRadius: radii.lg, padding: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  fieldSpacing: { marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  thirdField: { flex: 1 },
  sectionLabel: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: 6 },
  genderRow: { flexDirection: "row", gap: 8 },
  genderPill: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: "center" },
  genderPillActive: { borderWidth: 1.5, borderColor: colors.green600 },
  genderText: { ...typography.caption, color: colors.textPrimary },
  genderTextActive: { color: colors.green700, fontWeight: "700" },
  goalSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  goalSelectLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalPlaceholder: { ...typography.caption, color: colors.textMuted },
  goalText: { ...typography.caption, color: colors.textPrimary, fontWeight: "600" },
  goalOptions: { backgroundColor: colors.white, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  goalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalOptionText: { ...typography.caption, color: colors.textPrimary },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.md },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },
  termsText: { ...typography.tiny, color: colors.textSecondary, flex: 1 },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  submitBtn: { marginBottom: spacing.sm },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
  footerText: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },

  // Right panel
  rightPanel: { flex: 1, backgroundColor: colors.brandPanel, alignItems: "center", justifyContent: "center" },
  rightPanelContent: { alignItems: "center", maxWidth: 400, paddingHorizontal: spacing.xl },
  rightLogo: { width: 220, height: 220, marginBottom: spacing.md },
  rightHeading: { ...typography.brandHeading, color: colors.brandLight, textAlign: "center" },
  rightQuote: { ...typography.body, color: colors.quoteText, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },
});
