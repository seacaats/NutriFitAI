import { ACTIVITY_LEVELS, GENDERS, GOALS, useRegisterForm } from "@/features/auth/hooks/useRegisterForm";
import FormInput from "@/shared/components/ui/FormInput";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing } from "@/shared/theme/nutrifit";
import { registerStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVITY_LABELS = ACTIVITY_LEVELS.map((a) => a.label);

export default function RegisterScreen() {
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
          {/* Step 2 replaces step 1 in place -- same container */}
          {!form.detailsOpen ? (
            <>
              <Pressable style={styles.brandRow} onPress={() => router.push("/")} hitSlop={8}>
                <NutriFitLogo small />
              </Pressable>

              <View style={styles.headerBlock}>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Start your healthy lifestyle today!</Text>
              </View>

              <View style={[styles.row, styles.fieldSpacing]}>
                <FormInput
                  icon="person-outline"
                  placeholder="First Name"
                  value={form.firstName}
                  onChangeText={form.setFirstName}
                  style={styles.thirdField}
                />
                <FormInput
                  placeholder="Last Name"
                  value={form.lastName}
                  onChangeText={form.setLastName}
                  style={styles.thirdField}
                />
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

              <FormInput
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
                <FormInput icon="calendar-outline" placeholder="Age" value={form.age} onChangeText={form.setAge} keyboardType="number-pad" style={styles.thirdField} />
                <FormInput icon="resize-outline" placeholder="Height" value={form.height} onChangeText={form.setHeight} style={styles.thirdField} />
                <FormInput icon="barbell-outline" placeholder="Weight" value={form.weight} onChangeText={form.setWeight} style={styles.thirdField} />
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
                <Text style={styles.title}>Nutrition & health</Text>
                <Text style={styles.subtitle}>Help us tailor your plan. Everything here is optional except the consent below.</Text>
              </View>

              <Text style={styles.sectionLabel}>
                <Ionicons name="restaurant-outline" size={13} color={colors.green700} /> Diet Preference
              </Text>
              <FormInput
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
                  I consent to NutriFit AI collecting and storing the dietary and health information I provide above, as described in the{" "}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  ...registerStyles,

  root: { flex: 1, backgroundColor: colors.bgMint },
  flex1: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, justifyContent: "center" },

  brandRow: { alignSelf: "flex-start", marginTop: spacing.sm, marginBottom: spacing.lg },

  headerBlock: { marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  fieldSpacing: { marginBottom: spacing.sm },
  genderPill: { flex: 1, paddingVertical: 12, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  goalSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
  },

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