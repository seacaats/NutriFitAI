import FormInput from "@/components/nutrifit/FormInput";
import PrimaryButton from "@/components/nutrifit/PrimaryButton";
import { GOALS, useRegisterForm } from "@/hooks/use-register-form";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function RegisterScreen() {
  const form = useRegisterForm();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.logoCircle}>
            <Ionicons name="barbell-outline" size={22} color={colors.white} />
          </View>
          <Text style={styles.brand}>NutriFit AI</Text>
        </View>

        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>Start your healthy lifestyle today!</Text>

        <FormInput icon="person-outline" placeholder="Full Name" value={form.fullName} onChangeText={form.setFullName} style={styles.fieldSpacing} />
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

        <View style={[styles.row, styles.fieldSpacing]}>
          <FormInput placeholder="Age" value={form.age} onChangeText={form.setAge} keyboardType="number-pad" style={styles.thirdField} />
          <FormInput placeholder="Height (cm)" value={form.height} onChangeText={form.setHeight} keyboardType="number-pad" style={styles.thirdField} />
          <FormInput placeholder="Weight (kg)" value={form.weight} onChangeText={form.setWeight} keyboardType="number-pad" style={styles.thirdField} />
        </View>

        <View style={[styles.genderRow, styles.fieldSpacing]}>
          <Text style={styles.genderLabel}>Gender</Text>
          <Pressable onPress={() => form.setGender("Male")} style={[styles.genderPill, form.gender === "Male" && styles.genderPillActive]}>
            <Text style={[styles.genderText, form.gender === "Male" && styles.genderTextActive]}>Male</Text>
          </Pressable>
          <Pressable onPress={() => form.setGender("Female")} style={[styles.genderPill, form.gender === "Female" && styles.genderPillActive]}>
            <Text style={[styles.genderText, form.gender === "Female" && styles.genderTextActive]}>Female</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Fitness Goal</Text>
        <Pressable style={[styles.goalSelect, styles.fieldSpacing]} onPress={form.toggleGoalPicker}>
          <Text style={form.goal ? styles.goalText : styles.goalPlaceholder}>{form.goal || "Select your goal"}</Text>
          <Ionicons name={form.goalPickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </Pressable>

        {form.goalPickerOpen && (
          <View style={styles.goalOptions}>
            {GOALS.map((g) => (
              <Pressable key={g} style={styles.goalOption} onPress={() => form.selectGoal(g)}>
                <Text style={styles.goalOptionText}>{g}</Text>
                {form.goal === g && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        )}

        <PrimaryButton title="Create Account" onPress={form.handleCreateAccount} loading={form.loading} style={styles.createBtn} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={form.goToLogin}>
            <Text style={styles.link}>Login</Text>
          </Pressable>
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
    paddingTop: 50,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  logoCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  brand: { ...typography.h3, color: colors.primaryLight },
  title: { ...typography.h1, marginBottom: 4 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  fieldSpacing: { marginBottom: spacing.md },
  row: { flexDirection: "row", gap: 8 },
  thirdField: { flex: 1 },
  genderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  genderLabel: { ...typography.bodyBold, marginRight: 4 },
  genderPill: { flex: 1, height: 48, borderRadius: radii.lg, backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" },
  genderPillActive: { backgroundColor: colors.primary },
  genderText: { ...typography.bodyBold, color: colors.textPrimary },
  genderTextActive: { color: colors.white },
  sectionLabel: { ...typography.h3, marginBottom: 8 },
  goalSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.inputBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    height: 56,
  },
  goalPlaceholder: { color: colors.textMuted, fontSize: 16 },
  goalText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  goalOptions: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.cardBorder, marginTop: -8, marginBottom: spacing.md, overflow: "hidden" },
  goalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  goalOptionText: { fontSize: 15, color: colors.textPrimary },
  createBtn: { marginTop: spacing.md, marginBottom: spacing.lg },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: "700" },
});