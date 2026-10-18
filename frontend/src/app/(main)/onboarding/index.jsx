import { OnboardingStepBody } from "@/features/onboarding/components/OnboardingSteps";
import { useOnboarding } from "@/features/onboarding/hooks/useOnboarding";
import { useWorkoutOptions } from "@/features/workouts/components/WorkoutPrefsPicker";
import Skeleton from "@/shared/components/Skeleton";
import ActionButton from "@/shared/components/ui/ActionButton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// The onboarding, one screen for web and phone: one step at a time with
// Back / Skip / Next at the bottom. A centered card on wide screens, full
// width on phones. No sidebar, so the steps get the whole screen

// Where each answer can be changed later, for the "Skip setup" dialog
const LATER_PLACES = [
  { icon: "nutrition-outline", what: "Calories and macros", where: "Food Scanner" },
  { icon: "footsteps-outline", what: "Daily steps", where: "Steps" },
  { icon: "water-outline", what: "Daily water", where: "Water" },
  { icon: "barbell-outline", what: "Workouts you like", where: "Workouts or Profile" },
  { icon: "flag-outline", what: "Target weight and pace", where: "Progress or Profile" },
  { icon: "chatbubbles-outline", what: "Coach tone", where: "AI Coach or Settings" },
  { icon: "moon-outline", what: "Quiet hours", where: "Settings" },
];

export default function OnboardingScreen() {
  const { darkMode, shell } = useTheme();
  const tone = getScreenTones(darkMode);
  const { firstName } = useAuth();
  const onboarding = useOnboarding();
  const workoutOptions = useWorkoutOptions();
  const { step, index, steps, isReview, saving } = onboarding;

  const [confirmSkip, setConfirmSkip] = useState(false);

  // Enter in a text box moves on, like Next
  const onSubmit = isReview ? onboarding.finish : onboarding.next;

  // Each step starts at the top, a long one (Workouts) can't leave the next scrolled down
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: shell.shellBg }]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
            <View style={styles.header}>
              <Text style={[styles.eyebrow, { color: tone.muted }]}>
                {index === 0 ? `Welcome, ${firstName}` : "Set up your plan"}
              </Text>
              <Pressable onPress={() => setConfirmSkip(true)} disabled={saving} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.skipAll, { color: tone.muted }]}>Skip setup</Text>
              </Pressable>
            </View>

            {/* Progress */}
            <View
              style={[styles.track, { backgroundColor: tone.track }]}
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
              accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
            >
              <View style={[styles.fill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
            </View>
            <Text style={[styles.stepCount, { color: tone.muted }]}>Step {index + 1} of {steps.length}</Text>

            <Text style={[styles.title, { color: tone.text }]} accessibilityRole="header">{step.title}</Text>
            <Text style={[styles.subtitle, { color: tone.muted }]}>{step.subtitle}</Text>

            <View style={styles.body}>
              {onboarding.loading ? (
                <View style={styles.skeletons}>
                  <Skeleton width="100%" height={44} borderRadius={radii.sm} />
                  <Skeleton width="70%" height={44} borderRadius={radii.sm} />
                </View>
              ) : (
                <OnboardingStepBody onboarding={onboarding} workoutOptions={workoutOptions} onSubmit={onSubmit} darkMode={darkMode} />
              )}
            </View>

            <ScreenError message={onboarding.error} onDismiss={onboarding.clearError} />

            {/* Back on the left, Skip and Next (or Finish) on the right */}
            <View style={[styles.footer, { borderTopColor: tone.border }]}>
              {index > 0 ? (
                <ActionButton variant="secondary" label="Back" onPress={onboarding.back} disabled={saving} darkMode={darkMode} />
              ) : <View />}
              <View style={styles.footerEnd}>
                {!isReview && (
                  <Pressable onPress={onboarding.skip} disabled={saving} hitSlop={8} accessibilityRole="button" style={styles.skipBtn}>
                    <Text style={[styles.skipText, { color: tone.muted }]}>Skip</Text>
                  </Pressable>
                )}
                <ActionButton
                  label={isReview ? "Finish" : "Next"}
                  onPress={onSubmit}
                  loading={saving}
                  disabled={onboarding.loading}
                  darkMode={darkMode}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Nothing is saved until this is confirmed */}
      <ConfirmModal
        visible={confirmSkip}
        title="Skip setup for now?"
        message="No problem. You can set any of these whenever you like:"
        confirmLabel="Skip for now"
        cancelLabel="Keep going"
        loading={saving}
        onConfirm={onboarding.skipAll}
        onCancel={() => setConfirmSkip(false)}
      >
        <View style={styles.laterList}>
          {LATER_PLACES.map((p) => (
            <View key={p.what} style={styles.laterRow}>
              <Ionicons name={p.icon} size={16} color={shellColors.primary} />
              <Text style={[styles.laterText, { color: tone.text }]}>
                {p.what} <Text style={{ color: tone.muted }}>· {p.where}</Text>
              </Text>
            </View>
          ))}
        </View>
      </ConfirmModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 560, alignSelf: "center", borderWidth: 1, borderRadius: radii.lg, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  eyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 1 },
  skipAll: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  track: { height: 6, borderRadius: radii.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: shellColors.primary },
  stepCount: { fontSize: 11, fontWeight: "700", marginTop: 6 },
  title: { fontSize: 22, fontWeight: "800", marginTop: 16 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  body: { marginTop: 18, marginBottom: 6 },
  skeletons: { gap: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, paddingTop: 16, marginTop: 14 },
  footerEnd: { flexDirection: "row", alignItems: "center", gap: 16 },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 13, fontWeight: "700" },
  laterList: { gap: 8, alignSelf: "stretch" },
  laterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  laterText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
