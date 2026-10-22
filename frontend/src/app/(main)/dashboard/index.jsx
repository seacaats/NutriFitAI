import { DASH, MacroRow, pct, PlannedWorkouts, RecommendationsStrip } from "@/features/dashboard/components/DashboardWidgets";
import { useRecommendations } from "@/features/dashboard/hooks/useRecommendations";
import OnboardingPrompt from "@/features/onboarding/components/OnboardingPrompt";
import { useDashboard } from "@/features/progress/hooks/useProgress";
import { WaterCard } from "@/features/water/components/WaterCards";
import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getScreenPalette, radii, shellColors } from "@/shared/theme/nutrifitai";
import { dashboardStyles } from "@/shared/theme/screenStyles";
import { getGreeting } from "@/shared/utils/greeting";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Mobile dashboard screen: daily calories and macros, hydration, steps, streak, quick actions, and today's plan.
export default function DashboardScreen() {
  const { summary: workoutSummary } = useWorkoutSessions();
  const dash = useDashboard();
  const recs = useRecommendations();
  const v = dash.view;
  const stepGoal = v?.goals.dailySteps ?? 0;

  const { shell: c, darkMode } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const { firstName, loading } = useAuth();

  const { card, textColor, mutedText } = getScreenPalette(darkMode);
  const trackBg = { backgroundColor: card.borderColor };
  const shortcut = [styles.shortcutCard, card];

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerName}>
          <Text style={[styles.greeting, textColor]}>{getGreeting()},</Text>
          <Text style={[styles.greetingName, textColor]} numberOfLines={1}>
            {loading ? "..." : firstName}!👋
          </Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} accessibilityLabel="Notifications" hitSlop={8}>
          <Ionicons name="notifications-outline" size={24} color={c.notifIcon} />
        </Pressable>
      </View>

      <OnboardingPrompt darkMode={darkMode} />

      <RecommendationsStrip recs={recs} darkMode={darkMode} onOpen={(item) => router.push(item.action.route)} style={styles.recs} />

      {/* Today's calories and macros */}
      <Pressable onPress={() => router.push("/food-scanner")} style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Today&apos;s Calories</Text>

        <View style={styles.rowBetween}>
          <Text style={[styles.bigNum, textColor]}>
            {v ? v.nutrition.caloriesKcal.toLocaleString() : DASH}
            <Text style={styles.kcalSuffix}>{v?.goalKcal ? ` / ${v.goalKcal.toLocaleString()} kcal` : " kcal"}</Text>
          </Text>
          <Text style={styles.pctGreen}>{v ? `${v.mealsLogged}/4 meals` : DASH}</Text>
        </View>

        <MacroRow macros={v?.macros} darkMode={darkMode} />
      </Pressable>

      {/* Hydration */}
      <WaterCard darkMode={darkMode} style={styles.waterCard} />

      {/* Steps and streak */}
      <View style={[styles.shortcutRow, compact && styles.stackRow]}>
        <Pressable onPress={() => router.push("/steps")} style={[styles.miniCard, card]}>
          <View style={styles.miniHead}>
            <Ionicons name="footsteps" size={18} color={colors.green600} />
            <Text style={[styles.miniTitle, textColor]}>Steps</Text>
          </View>
          <Text style={[styles.miniValue, textColor]}>
            {v ? v.steps.toLocaleString() : DASH}
            <Text style={styles.miniSuffix}> / {stepGoal.toLocaleString()}</Text>
          </Text>
          <Text style={styles.planMeta}>{v ? `${pct(v.steps, stepGoal)}% of daily goal` : DASH}</Text>
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${v ? pct(v.steps, stepGoal) : 0}%`, backgroundColor: shellColors.primary }]} />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/progress")} style={[styles.miniCard, card]}>
          <View style={styles.miniHead}>
            <Ionicons name="trophy" size={18} color={chipTints.orange.icon} />
            <Text style={[styles.miniTitle, textColor]}>Streak</Text>
          </View>
          <Text style={[styles.miniValue, textColor]}>
            {v ? `${v.streak.days} ${v.streak.days === 1 ? "day" : "days"}` : DASH}
          </Text>
          <Text style={styles.planMeta}>
            {!v ? DASH : v.streak.loggedToday ? "Logged today" : v.streak.days ? "Log today to keep it" : "Log anything to start one"}
          </Text>
        </Pressable>
      </View>

      {/* Shortcuts */}
      <View style={[styles.shortcutRow, compact && styles.stackRow]}>
        <Pressable onPress={() => router.push("/food-scanner")} style={shortcut}>
          <View style={styles.shortcutText}>
            <Text style={[styles.shortcutTitle, textColor]}>Scan Food</Text>
            <Text style={[styles.shortcutSub, mutedText]}>Analyze your food</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: shellColors.primary }]}>
            <Ionicons name="camera" size={20} color={colors.white} />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/ai-coach")} style={shortcut}>
          <View style={styles.shortcutText}>
            <Text style={[styles.shortcutTitle, textColor]}>AI Coach</Text>
            <Text style={[styles.shortcutSub, mutedText]}>Chat with your coach</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: shellColors.primary }]}>
            <Ionicons name="hardware-chip" size={20} color={colors.white} />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/workouts")} style={shortcut}>
          <View style={styles.shortcutText}>
            <Text style={[styles.shortcutTitle, textColor]}>Workout Planner</Text>
            <Text style={[styles.shortcutSub, mutedText]}>Plan your workouts</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: shellColors.primary }]}>
            <Ionicons name="barbell" size={20} color={colors.white} />
          </View>
        </Pressable>
      </View>

      {/* Today's Plan */}
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, textColor]}>Today's Plan</Text>
        <Pressable onPress={() => router.push("/workouts")}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.planRow}>
        <Pressable onPress={() => router.push("/food-scanner")} style={[styles.planCard, card]}>
          <Ionicons name="restaurant" size={20} color={shellColors.primary} />
          <Text style={[styles.planTitle, textColor]}>Meals</Text>
          <Text style={styles.planMeta}>{v ? `${v.mealsLogged}/4 logged` : DASH}</Text>
          <Text style={styles.planMeta}>{v ? `${v.nutrition.caloriesKcal} kcal` : DASH}</Text>
        </Pressable>
      </View>

      <View style={[styles.card, card, styles.workoutsCard]}>
        <Text style={[styles.cardTitle, textColor]}>Workouts</Text>
        <PlannedWorkouts view={v} summary={workoutSummary} darkMode={darkMode} onOpen={() => router.push("/workouts?tab=upcoming")} />
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...dashboardStyles,
  waterCard: { marginBottom: 16 },
  recs: { marginBottom: 12 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "700" },
  greetingName: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  headerName: { flex: 1, minWidth: 0, paddingRight: 12 },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bigNum: { fontSize: 26, fontWeight: "800" },
  kcalSuffix: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  pctGreen: { fontSize: 15, fontWeight: "700", color: shellColors.primary },

  progressTrack: { marginTop: 10, height: 8, borderRadius: 4, overflow: "hidden" },

  shortcutRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  shortcutCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutText: { flexShrink: 1 },
  shortcutTitle: { fontSize: 12, fontWeight: "700" },
  shortcutSub: { fontSize: 10, marginTop: 2 },
  shortcutIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  sectionTitle: { fontSize: 18, fontWeight: "700" },

  planRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  workoutsCard: { marginTop: 12 },
  planCard: { flex: 1, borderRadius: radii.sm, borderColor: "transparent", borderWidth: 1, padding: 12 },
  planTitle: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  planMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  miniCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 12 },
  miniHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniTitle: { fontSize: 13, fontWeight: "700" },
  miniValue: { fontSize: 20, fontWeight: "800", marginTop: 6 },
  miniSuffix: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
});
