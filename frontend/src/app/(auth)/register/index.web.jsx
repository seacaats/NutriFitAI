import {
  ACTIVITY_OPTIONS,
  DIET_PREFERENCES,
  GOAL_OPTIONS,
  SEXES,
  useRegisterForm,
} from "@/features/auth/hooks/useRegisterForm";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import OptionSelect from "@/shared/components/ui/OptionSelect";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { registerStyles } from "@/shared/theme/screenStyles";
import { EMAIL_MAX, NAME_MAX } from "@/shared/utils/authValidators";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const BREAKPOINT = 1024;
const COMPACT_FORM = 500;

export default function RegisterScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useRegisterForm();
  const { width } = useWindowDimensions();
  const isWide = width >= BREAKPOINT;
  // The form's own width: half the screen beside the brand panel. Under
  // COMPACT_FORM the paired fields stack so their placeholders fit
  const compact = (isWide ? width / 2 : width) < COMPACT_FORM;

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
                <FormAlert tone="info" message={form.notice} onDismiss={form.dismissNotice} />

                {/* Stacked on small screens so each placeholder shows in full */}
                <View style={[styles.row, styles.accountFieldSpacing, compact && styles.stackedRow]}>
                  <FormInput size="sm"
                    label="First Name"
                    required
                    icon="person-outline"
                    placeholder="First name (e.g. Juan)"
                    maxLength={NAME_MAX} value={form.firstName}
                    onChangeText={form.setFirstName}
                    onSubmitEditing={form.onSubmitEditing}
                    style={!compact && styles.thirdField}
                  />
                  <FormInput size="sm"
                    label="Last Name"
                    optional
                    placeholder="Last name (e.g. Dela Cruz)"
                    maxLength={NAME_MAX} value={form.lastName}
                    onChangeText={form.setLastName}
                    onSubmitEditing={form.onSubmitEditing}
                    style={!compact && styles.thirdField}
                  />
                </View>

                <FormInput size="sm"
                  label="Email"
                  required
                  icon="mail-outline"
                  placeholder="Email (e.g. name@example.com)"
                  maxLength={EMAIL_MAX} value={form.email}
                  onChangeText={form.setEmail}
                  onSubmitEditing={form.onSubmitEditing}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.accountFieldSpacing}
                />

                <FormInput size="sm"
                  label="Password"
                  required
                  icon="lock-closed-outline"
                  placeholder="Password (min. 8 characters)"
                  value={form.password}
                  maxLength={64}
                  onChangeText={form.setPassword}
                  onSubmitEditing={form.onSubmitEditing}
                  secureTextEntry
                  showToggle
                  visible={form.showPassword}
                  onToggleVisible={form.toggleShowPassword}
                  style={styles.accountFieldSpacing}
                />


                <FormInput size="sm"
                  label="Confirm Password"
                  required
                  icon="lock-closed-outline"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  maxLength={64}
                  onChangeText={form.setConfirmPassword}
                  onSubmitEditing={form.onSubmitEditing}
                  secureTextEntry
                  showToggle
                  visible={form.showConfirmPassword}
                  onToggleVisible={form.toggleShowConfirmPassword}
                  style={styles.accountFieldSpacing}
                />

                <FormAlert message={form.error} onDismiss={form.dismissError} />

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

                <Text style={styles.title}>About You</Text>
                <Text style={styles.subtitle}>Help us tailor your plan. You can update your details later from your profile page.</Text>

                {/* Age / Height / Weight: one row, or on small screens age on its own row with height and weight below, like the phone */}
                {compact ? (
                  <>
                    <FormInput size="sm" label="Age" required icon="calendar-outline" placeholder="Age" maxLength={3} value={form.age} onChangeText={form.setAge} onSubmitEditing={form.onSubmitEditing} keyboardType="number-pad" style={styles.fieldSpacing} />
                    <View style={[styles.row, styles.fieldSpacing]}>
                      <FormInput size="sm" label="Height (cm)" required icon="resize-outline" placeholder="Height (cm)" maxLength={6} value={form.height} onChangeText={form.setHeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
                      <FormInput size="sm" label="Weight (kg)" required icon="barbell-outline" placeholder="Weight (kg)" maxLength={6} value={form.weight} onChangeText={form.setWeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
                    </View>
                  </>
                ) : (
                  <View style={[styles.row, styles.fieldSpacing]}>
                    <FormInput size="sm" label="Age" required icon="calendar-outline" placeholder="Age" maxLength={3} value={form.age} onChangeText={form.setAge} onSubmitEditing={form.onSubmitEditing} keyboardType="number-pad" style={styles.thirdField} />
                    <FormInput size="sm" label="Height (cm)" required icon="resize-outline" placeholder="Height (cm)" maxLength={6} value={form.height} onChangeText={form.setHeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
                    <FormInput size="sm" label="Weight (kg)" required icon="barbell-outline" placeholder="Weight (kg)" maxLength={6} value={form.weight} onChangeText={form.setWeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
                  </View>
                )}

                {/* Sex -- optional; tap again to clear */}
                <Text style={styles.sectionLabel}>
                  <Ionicons name="person-circle-outline" size={13} color={colors.green700} /> Sex <Text style={styles.optional}>(Optional)</Text>
                </Text>
                <View style={[styles.genderRow, styles.fieldSpacing]}>
                  {SEXES.map((g) => (
                    <Pressable key={g} onPress={() => form.selectSex(g)} style={[styles.genderPill, form.sex === g && styles.genderPillActive]}>
                      <Text style={[styles.genderText, form.sex === g && styles.genderTextActive]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>
                  <Ionicons name="restaurant-outline" size={13} color={colors.green700} /> Diet Preference <Text style={styles.required}>*</Text>
                </Text>
                <OptionSelect
                  multiple
                  size="sm"
                  icon="nutrition-outline"
                  placeholder="Select any that apply"
                  options={DIET_PREFERENCES}
                  value={form.dietPreference}
                  open={form.openPicker === "diet"}
                  onToggle={() => form.togglePicker("diet")}
                  onSelect={form.toggleDietPreference}
                  otherValue={form.dietOther}
                  onOtherChange={form.setDietOther}
                  otherPlaceholder="Your diet (e.g. Intermittent Fasting)"
                  style={styles.fieldSpacing}
                />

                <Text style={styles.sectionLabel}>
                  <Ionicons name="medkit-outline" size={13} color={colors.green700} /> Health Conditions <Text style={styles.required}>*</Text>
                </Text>
                <OptionSelect size="sm"
                  multiple
                  icon="medkit-outline"
                  placeholder="Select any that apply (or None)"
                  options={form.healthOptions}
                  value={form.healthConditions}
                  open={form.openPicker === "health"}
                  onToggle={() => form.togglePicker("health")}
                  onSelect={form.toggleHealthCondition}
                  otherValue={form.healthOther}
                  onOtherChange={form.setHealthOther}
                  otherPlaceholder="Your condition (e.g. Gout)"
                  style={styles.fieldSpacing}
                />

                <Text style={styles.sectionLabel}>
                  <Ionicons name="pulse-outline" size={13} color={colors.green700} /> Activity Level <Text style={styles.required}>*</Text>
                </Text>
                <OptionSelect size="sm"
                  icon="pulse-outline"
                  placeholder="Select your activity level"
                  options={ACTIVITY_OPTIONS}
                  value={form.activity}
                  open={form.openPicker === "activity"}
                  onToggle={() => form.togglePicker("activity")}
                  onSelect={form.selectActivity}
                  otherValue={form.activityOther}
                  onOtherChange={form.setActivityOther}
                  otherPlaceholder="Your activity (e.g. Shift work, on my feet)" otherMaxLength={50}
                  style={styles.fieldSpacing}
                />

                <Text style={styles.sectionLabel}>
                  <Ionicons name="flag-outline" size={13} color={colors.green700} /> Fitness Goal <Text style={styles.required}>*</Text>
                </Text>
                <OptionSelect size="sm"
                  icon="flag-outline"
                  placeholder="Select your goal"
                  options={GOAL_OPTIONS}
                  value={form.goal}
                  open={form.openPicker === "goal"}
                  onToggle={() => form.togglePicker("goal")}
                  onSelect={form.selectGoal}
                  otherValue={form.goalOther}
                  onOtherChange={form.setGoalOther}
                  otherPlaceholder="Your goal (e.g. Run a 10K)" otherMaxLength={50}
                  style={styles.fieldSpacing}
                />

                {/* Consent */}
                <Pressable style={styles.termsRow} onPress={form.toggleAgreeTerms}>
                  <View style={[styles.checkbox, form.agreeTerms && styles.checkboxChecked]}>
                    {form.agreeTerms && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                  </View>
                  <Text style={styles.termsText}>
                    I consent to NutriFitAI collecting and storing the dietary and health information I provide above, as described in the{" "}
                    <Text onPress={form.goToTerms} style={styles.termsLink}>
                      Terms of Service and Privacy Policy
                    </Text>
                    .
                  </Text>
                </Pressable>

                <FormAlert message={form.error} onDismiss={form.dismissError} />

                <PrimaryButton title="Create Account" onPress={form.handleCreateAccount} loading={form.loading} style={styles.submitBtn} />
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

const createStyles = (colors) => StyleSheet.create({
  ...registerStyles(colors),

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
  fieldSpacing: { marginBottom: 14 },
  // Sits under the field above it, inside that field's spacing
  fieldNote: { marginTop: -8, marginBottom: 14, fontSize: 11, lineHeight: 16, color: colors.textSecondary },
  genderPill: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.inputBg, alignItems: "center" },
  hint: { ...typography.tiny, color: colors.textSecondary, marginTop: -4, marginBottom: 10 },

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