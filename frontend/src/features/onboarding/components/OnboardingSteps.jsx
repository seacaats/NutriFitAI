import CoachToneOptions from "@/features/coach/components/CoachToneOptions";
import TargetWeightFields from "@/features/progress/components/TargetWeightFields";
import WorkoutPrefsPicker, { describeWorkoutPrefs } from "@/features/workouts/components/WorkoutPrefsPicker";
import MfaSetup from "@/shared/components/ui/MfaSetup";
import NumberBox from "@/shared/components/ui/NumberBox";
import Stepper from "@/shared/components/ui/Stepper";
import TimeStepper, { formatTime } from "@/shared/components/ui/TimeStepper";
import {
  COACH_TONES,
  decimalOrNull,
  GLASS_ML,
  NUTRITION_GOAL_FIELDS,
  paceLabel,
  STEP_GOAL,
  WATER_GOAL,
} from "@/shared/constants/goalOptions";
import { chipTints, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

// The onboarding's step bodies. Inputs are the same kinds the goal cards
// use (number boxes, steppers, chips), so nothing looks new later on.
// `onSubmit` moves to the next step, for Enter in a text box

function NutritionStep({ onboarding, onSubmit, darkMode }) {
  const tone = getScreenTones(darkMode);
  const { answers, update, suggestedKcal } = onboarding;
  const setField = (key, text) => update({ nutrition: { ...answers.nutrition, [key]: text } });
  const showSuggestion = suggestedKcal && answers.nutrition.dailyCaloriesKcal !== String(suggestedKcal);

  return (
    <View style={styles.gap}>
      {showSuggestion && (
        <View style={[styles.hintRow, { backgroundColor: tone.soft }]}>
          <Ionicons name="bulb-outline" size={16} color={shellColors.primary} />
          <Text style={[styles.hintText, { color: tone.text }]}>
            Around {suggestedKcal.toLocaleString()} kcal suits your profile and goal.
          </Text>
          <Pressable onPress={() => setField("dailyCaloriesKcal", String(suggestedKcal))} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Use it</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.grid}>
        {NUTRITION_GOAL_FIELDS.map((f) => (
          <View key={f.key} style={styles.gridItem}>
            <View style={styles.labelRow}>
              <Ionicons name={f.icon} size={14} color={chipTints[f.tint].icon} />
              <Text style={[styles.label, { color: tone.text }]}>{f.label}</Text>
            </View>
            <NumberBox
              value={answers.nutrition[f.key]}
              onChangeText={(t) => setField(f.key, t)}
              unit={f.unit}
              label={`Daily ${f.label.toLowerCase()} goal`}
              onSubmit={onSubmit}
              darkMode={darkMode}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function QuietStep({ onboarding, darkMode }) {
  const tone = getScreenTones(darkMode);
  const { answers, update } = onboarding;
  return (
    <View style={styles.gap}>
      <View style={styles.rowBetween}>
        <Text style={[styles.label, { color: tone.text }]}>Pause reminders at night</Text>
        <Switch
          value={answers.quietOn}
          onValueChange={(v) => update({ quietOn: v })}
          trackColor={{ true: shellColors.primary, false: tone.border }}
          thumbColor="#ffffff"
          accessibilityLabel="Quiet hours"
        />
      </View>
      {answers.quietOn && (
        <>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: tone.text }]}>From</Text>
            <TimeStepper value={answers.quietStart} onChange={(t) => update({ quietStart: t })} darkMode={darkMode} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: tone.text }]}>To</Text>
            <TimeStepper value={answers.quietEnd} onChange={(t) => update({ quietEnd: t })} darkMode={darkMode} />
          </View>
        </>
      )}
      <Text style={[styles.muted, { color: tone.muted }]}>Account notices still arrive. Change this any time in Settings.</Text>
    </View>
  );
}

// One line per step for the review, in the same words the steps use
function summaryOf(key, onboarding, workoutOptions) {
  const { answers } = onboarding;
  switch (key) {
    case "nutrition": {
      const set = NUTRITION_GOAL_FIELDS.filter((f) => answers.nutrition[f.key]);
      return set.map((f) => `${f.label} ${Number(answers.nutrition[f.key]).toLocaleString()} ${f.unit}`).join(" · ") || "Not set";
    }
    case "workouts":
      return describeWorkoutPrefs(answers.workoutPrefs, workoutOptions) || "No preference";
    case "steps":
      return `${answers.dailySteps.toLocaleString()} steps`;
    case "water":
      return `${answers.waterGlasses} glasses (${(answers.waterGlasses * GLASS_ML).toLocaleString()} ml)`;
    case "weight": {
      const parts = [answers.targetWeight && `${answers.targetWeight} kg`, paceLabel(decimalOrNull(answers.weeklyPace))].filter(Boolean);
      return parts.join(" · ") || "Not set";
    }
    case "coach":
      return COACH_TONES.find((t) => t.value === answers.coachTone)?.label || "Not set";
    case "security":
      return answers.mfaOn ? "On" : "Off";
    case "quiet":
      return answers.quietOn ? `${formatTime(answers.quietStart)} – ${formatTime(answers.quietEnd)}` : "Off";
    default:
      return "";
  }
}

function ReviewStep({ onboarding, workoutOptions, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View>
      {onboarding.steps.filter((s) => s.key !== "review").map((s, i, list) => {
        const kept = onboarding.kept.has(s.key);
        return (
          <View
            key={s.key}
            style={[styles.reviewRow, i < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: tone.border }]}
          >
            <View style={styles.flex1}>
              <Text style={[styles.label, { color: tone.text }]}>{s.title}</Text>
              <Text style={[styles.muted, { color: tone.muted }]}>
                {kept ? summaryOf(s.key, onboarding, workoutOptions) : "Skipped"}
              </Text>
            </View>
            <Pressable
              onPress={() => onboarding.goTo(onboarding.steps.indexOf(s))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${s.title.toLowerCase()}`}
            >
              <Text style={styles.link}>Edit</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function OnboardingStepBody({ onboarding, workoutOptions, onSubmit, darkMode }) {
  const { answers, update } = onboarding;
  switch (onboarding.step.key) {
    case "nutrition":
      return <NutritionStep onboarding={onboarding} onSubmit={onSubmit} darkMode={darkMode} />;
    case "workouts":
      return (
        <WorkoutPrefsPicker
          value={answers.workoutPrefs}
          onChange={(workoutPrefs) => update({ workoutPrefs })}
          options={workoutOptions}
          darkMode={darkMode}
        />
      );
    case "steps":
      return (
        <Stepper
          label="Steps"
          value={answers.dailySteps}
          onChange={(dailySteps) => update({ dailySteps })}
          min={STEP_GOAL.min}
          max={STEP_GOAL.max}
          step={STEP_GOAL.step}
          darkMode={darkMode}
        />
      );
    case "water":
      return (
        <View style={styles.gap}>
          <Stepper
            label="Glasses"
            value={answers.waterGlasses}
            onChange={(waterGlasses) => update({ waterGlasses })}
            min={WATER_GOAL.minGlasses}
            max={WATER_GOAL.maxGlasses}
            darkMode={darkMode}
          />
          <Text style={[styles.muted, { color: getScreenTones(darkMode).muted }]}>
            {(answers.waterGlasses * GLASS_ML).toLocaleString()} ml a day
          </Text>
        </View>
      );
    case "weight":
      return (
        <TargetWeightFields
          target={answers.targetWeight}
          pace={answers.weeklyPace}
          onTarget={(targetWeight) => update({ targetWeight })}
          onPace={(weeklyPace) => update({ weeklyPace })}
          currentKg={onboarding.profile?.weightKg}
          onSubmit={onSubmit}
          darkMode={darkMode}
        />
      );
    case "coach":
      return <CoachToneOptions value={answers.coachTone} onChange={(coachTone) => update({ coachTone })} darkMode={darkMode} />;
    case "quiet":
      return <QuietStep onboarding={onboarding} darkMode={darkMode} />;
    case "security":
      return (
        <MfaSetup
          method="email"
          enabled={answers.mfaOn}
          onChange={(mfaOn) => update({ mfaOn })}
          darkMode={darkMode}
        />
      );
    default:
      return <ReviewStep onboarding={onboarding} workoutOptions={workoutOptions} darkMode={darkMode} />;
  }
}

const styles = StyleSheet.create({
  gap: { gap: 14 },
  flex1: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  // minWidth 0 so two boxes fit side by side without spilling out of the card
  gridItem: { flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, fontWeight: "700" },
  muted: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radii.sm, padding: 10 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: "700", color: shellColors.primary },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});