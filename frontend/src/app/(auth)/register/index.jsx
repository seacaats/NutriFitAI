import {
  ACTIVITY_OPTIONS,
  DIET_PREFERENCES,
  GOAL_OPTIONS,
  SEXES,
  useRegisterForm,
} from "@/features/auth/hooks/useRegisterForm";
import { AuthBackLink } from "@/shared/components/layout/PublicHeader";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import OptionSelect from "@/shared/components/ui/OptionSelect";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { registerStyles } from "@/shared/theme/screenStyles";
import { EMAIL_MAX, NAME_MAX } from "@/shared/utils/formValidators";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const form = useRegisterForm();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 2 replaces step 1 in place within the same container */}
          {!form.detailsOpen ? (
            <>
              <AuthBackLink fallback={form.backTo} />

              <View style={styles.headerBlock}>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Start your healthy lifestyle today!</Text>
              </View>
              <FormAlert tone="info" message={form.notice} onDismiss={form.dismissNotice} />

              <FormInput
                label="First Name"
                required
                icon="person-outline"
                placeholder="First name (e.g. Juan)"
                maxLength={NAME_MAX} value={form.firstName}
                onChangeText={form.setFirstName}
                onSubmitEditing={form.onSubmitEditing}
                style={styles.accountFieldSpacing}
              />
              <FormInput
                label="Last Name"
                optional
                icon="person-outline"
                placeholder="Last name (e.g. Dela Cruz)"
                maxLength={NAME_MAX} value={form.lastName}
                onChangeText={form.setLastName}
                onSubmitEditing={form.onSubmitEditing}
                style={styles.accountFieldSpacing}
              />

              <FormInput
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

              <FormInput
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

              <FormInput
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
                <Pressable onPress={form.goToLogin} hitSlop={6}>
                  <Text style={styles.link}>Login</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={form.backToAccount} hitSlop={8} style={styles.backRow}>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <View style={styles.headerBlock}>
                <Text style={styles.title}>About You</Text>
                <Text style={styles.subtitle}>Help us tailor your plan. You can update your details later from your profile page.</Text>
              </View>

              <FormInput
                label="Age"
                required
                icon="calendar-outline"
                placeholder="Age"
                maxLength={3} value={form.age}
                onChangeText={form.setAge}
                onSubmitEditing={form.onSubmitEditing}
                keyboardType="number-pad"
                style={styles.fieldSpacing}
              />

              <View style={[styles.row, styles.fieldSpacing]}>
                <FormInput label="Height (cm)" required icon="resize-outline" placeholder="Height (cm)" maxLength={6} value={form.height} onChangeText={form.setHeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
                <FormInput label="Weight (kg)" required icon="barbell-outline" placeholder="Weight (kg)" maxLength={6} value={form.weight} onChangeText={form.setWeight} onSubmitEditing={form.onSubmitEditing} keyboardType="decimal-pad" style={styles.thirdField} />
              </View>

              {/* Optional sex selector; tapping the active option clears it */}
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
              <OptionSelect
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
              <OptionSelect
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
              <OptionSelect
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  ...registerStyles(colors),

  root: { flex: 1, backgroundColor: colors.bgMint },
  flex1: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, justifyContent: "center" },

  brandRow: { alignSelf: "flex-start", marginTop: spacing.sm, marginBottom: spacing.lg },

  headerBlock: { marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  fieldSpacing: { marginBottom: 14 },
  fieldNote: { marginTop: -8, marginBottom: 14, fontSize: 11, lineHeight: 16, color: colors.textSecondary },
  genderPill: { flex: 1, paddingVertical: 12, borderRadius: radii.sm, backgroundColor: colors.inputBg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  hint: { ...typography.tiny, color: colors.textSecondary, marginTop: -4, marginBottom: 10 },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },

  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm, marginBottom: spacing.md, alignSelf: "flex-start" },
});
