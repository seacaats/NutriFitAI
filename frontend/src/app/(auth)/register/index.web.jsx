import { ACTIVITY_LEVELS, GENDERS, GOALS, useRegisterForm } from "@/features/auth/hooks/useRegisterForm";
import FormInput from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { registerStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View
} from "react-native";

const ACTIVITY_LABELS = ACTIVITY_LEVELS.map((a) => a.label);

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
            <Pressable style={styles.mobileBrandWrap} onPress={() => router.push("/")} hitSlop={8}>
              <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.mobileLogo} contentFit="contain" />
              <Text style={styles.mobileHeading}>NutriFitAI</Text>
            </Pressable>
          )}

          {/* Step 2 replaces step 1 in place -- same card */}
          <View style={styles.card}>
            {!form.detailsOpen ? (
              <>
                <Text style={styles.title}>Create Your Account</Text>
                <Text style={styles.subtitle}>Start your healthy lifestyle today!</Text>

                <View style={[styles.row, styles.fieldSpacing]}>
                  <FormInput size="sm"
                    icon="person-outline"
                    placeholder="First Name"
                    value={form.firstName}
                    onChangeText={form.setFirstName}
                    style={styles.thirdField}
                  />
                  <FormInput size="sm"
                    placeholder="Last Name"
                    value={form.lastName}
                    onChangeText={form.setLastName}
                    style={styles.thirdField}
                  />
                </View>

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

                {!!form.error && <Text style={styles.error}>{form.error}</Text>}

                <PrimaryButton title="Continue" onPress={form.continueToDetails} style={styles.submitBtn} />

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Pressable onPress={form.goToLogin}>
                    <Text style={styles.link}>Login</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Pressable onPress={form.backToAccount} hitSlop={8} style={styles.backRow}>
                  <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>

                <Text style={styles.title}>Nutrition & Health</Text>
                <Text style={styles.subtitle}>Help us tailor your plan. Everything here is optional except the consent below.</Text>

                <Text style={styles.sectionLabel}>
                  <Ionicons name="restaurant-outline" size={13} color={colors.green700} /> Diet Preference
                </Text>
                <FormInput
                  size="sm"
                  icon="nutrition-outline"
                  placeholder="e.g. High Protein, Vegetarian"
                  value={form.dietPreference}
                  onChangeText={form.setDietPreference}
                  style={styles.fieldSpacing}
                />

                <Text style={styles.sectionLabel}>
                  <Ionicons name="medkit-outline" size={13} color={colors.green700} /> Health Conditions
                </Text>
                <TextInput
                  style={[styles.textArea, styles.fieldSpacing]}
                  placeholder="e.g. Diabetes, food allergies -- or leave blank"
                  placeholderTextColor={colors.textMuted}
                  value={form.healthConditions}
                  onChangeText={form.setHealthConditions}
                  multiline
                  numberOfLines={3}
                />

                {/* Activity Level -- same dropdown pattern as Fitness Goal */}
                <Text style={styles.sectionLabel}>
                  <Ionicons name="pulse-outline" size={13} color={colors.green700} /> Activity Level
                </Text>
                <Pressable style={[styles.goalSelect, styles.fieldSpacing]} onPress={form.toggleActivityPicker}>
                  <View style={styles.goalSelectLeft}>
                    <Ionicons name="pulse-outline" size={16} color={colors.green600} />
                    <Text style={form.activity ? styles.goalText : styles.goalPlaceholder}>{form.activity || "Select your activity level"}</Text>
                  </View>
                  <Ionicons name={form.activityPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.green600} />
                </Pressable>

                {form.activityPickerOpen && (
                  <View style={[styles.goalOptions, styles.fieldSpacing]}>
                    {ACTIVITY_LABELS.map((label) => (
                      <Pressable key={label} style={styles.goalOption} onPress={() => form.selectActivity(label)}>
                        <Text style={styles.goalOptionText}>{label}</Text>
                        {form.activity === label && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Fitness Goal */}
                <Text style={styles.sectionLabel}>
                  <Ionicons name="flag-outline" size={13} color={colors.green700} /> Fitness Goal
                </Text>
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

                {/* Consent */}
                <Pressable style={styles.termsRow} onPress={form.toggleAgreeTerms}>
                  <View style={[styles.checkbox, form.agreeTerms && styles.checkboxChecked]}>
                    {form.agreeTerms && <Ionicons name="checkmark" size={11} color={colors.white} />}
                  </View>
                  <Text style={styles.termsText}>
                    I consent to NutriFitAI collecting and storing the dietary and health information I provide above, as described in the{" "}
                    <Text onPress={form.goToTerms} style={styles.termsLink}>
                      Terms of Service and Privacy Policy
                    </Text>
                    .
                  </Text>
                </Pressable>

                {!!form.error && <Text style={styles.error}>{form.error}</Text>}

                <PrimaryButton title="Create Account" icon="person-add-outline" onPress={form.handleCreateAccount} loading={form.loading} style={styles.submitBtn} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isWide && (
        <View style={styles.rightPanel}>
          <Pressable style={styles.rightPanelContent} onPress={() => router.push("/")} hitSlop={8}>
            <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.rightLogo} contentFit="contain" />
            <Text style={styles.rightHeading}>NutriFitAI</Text>
            <Text style={styles.rightQuote}>
              Your Food. Your Fitness. Your Future.{"\n"}Scan. Understand. Improve.
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ...registerStyles,

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
  genderPill: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: "center" },
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
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },

  // Right panel
  rightPanel: { flex: 1, backgroundColor: colors.brandPanel, alignItems: "center", justifyContent: "center" },
  rightPanelContent: { alignItems: "center", maxWidth: 400, paddingHorizontal: spacing.xl },
  rightLogo: { width: 220, height: 220, marginBottom: spacing.md },
  rightHeading: { ...typography.brandHeading, color: colors.brandLight, textAlign: "center" },
  rightQuote: { ...typography.body, color: colors.quoteText, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },

  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
});