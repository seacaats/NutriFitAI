import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, radii, shellColors } from "@/shared/theme/nutrifit";
import { progressStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

const WEIGHT_DATA = [
  { label: "Week 1", value: 72.5 },
  { label: "Week 2", value: 72 },
  { label: "Week 3", value: 71.5 },
  { label: "Week 4", value: 71 },
  { label: "Week 5", value: 70.5 },
  { label: "Week 6", value: 70 },
];

const SUMMARY_CARDS = [
  { icon: "trending-down", iconColor: colors.green600, title: "Weight", value: "70 kg", delta: "▼ 2.5 kg", deltaColor: colors.green600, note: "Since last month" },
  { key: "workouts", icon: "barbell", iconColor: shellColors.primary, title: "Workouts", value: "\u2014", suffix: "sessions", delta: null, deltaColor: colors.green600, note: "This week" },
  { icon: "flame", iconColor: colors.orange400, title: "Calories Burned", value: "12,480", delta: "+8.4%", deltaColor: colors.green600, note: "Compared to last month" },
  { icon: "footsteps", iconColor: colors.green600, title: "Average Steps", value: "8,421", delta: "84% of goal", deltaColor: colors.green600, note: "Daily average" },
];

/**
 * Only the Workouts card is real so far. The delta line is dropped rather than
 * faked: "+4 this month" needs a previous-period comparison the summary does
 * not provide, and inventing it would be worse than omitting it.
 */
function resolveSummaryCards(summary) {
  return SUMMARY_CARDS.map((card) => {
    if (card.key !== "workouts" || !summary) return card;
    return {
      ...card,
      value: summary.target ? `${summary.completed}/${summary.target}` : `${summary.completed}`,
      note: summary.target ? `Goal: ${summary.target} this week` : "This week",
    };
  });
}

const WORKOUT_BARS = [
  { label: "Strength Training", value: "75%", width: "75%" },
  { label: "Cardio", value: "60%", width: "60%" },
  { label: "Flexibility", value: "45%", width: "45%" },
  { label: "Endurance", value: "70%", width: "70%" },
];

export default function ProgressScreen() {
  const { summary } = useWorkoutSessions();
  const summaryCards = resolveSummaryCards(summary);

  const { width } = useWindowDimensions();
  const narrow = width < 980;
  const phone = width < 620;
  const { darkMode } = useTheme();

  const { card, textColor } = getScreenPalette(darkMode);
  const trackBg = { backgroundColor: card.borderColor };

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, textColor]}>Progress</Text>
        <Text style={styles.pageSubtitle}>Track your fitness journey and see how far you've come.</Text>
      </View>

      {/* Summary*/}
      <View style={[styles.summaryRow, styles.wrapRow]}>
        {summaryCards.map((item) => (
          <View key={item.title} style={[styles.card, card, styles.summaryCard, phone && styles.fullWidth]}>
            <View style={styles.summaryHeader}>
              <Ionicons name={item.icon} size={20} color={item.iconColor} />
              <Text style={[styles.summaryTitle, textColor]}>{item.title}</Text>
            </View>

            <View style={styles.summaryValueRow}>
              <Text style={[styles.summaryValue, textColor]}>{item.value}</Text>
              {item.suffix && <Text style={styles.summarySuffix}> {item.suffix}</Text>}
            </View>

            <Text style={[styles.summaryDelta, { color: item.deltaColor }]}>{item.delta}</Text>
            <Text style={styles.summaryNote}>{item.note}</Text>
          </View>
        ))}
      </View>

      {/* Progress */}
      <View style={[styles.mainRow, narrow && styles.stackRow]}>
        <View style={[styles.card, card, styles.flex1]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.sectionTitle, textColor]}>Weight Progress</Text>
              <Text style={styles.sectionSubtitle}>Your weight changes over the past weeks</Text>
            </View>

            <View style={styles.alignRight}>
              <Text style={[styles.bigNum, textColor]}>70 kg</Text>
              <Text style={styles.weightDelta}>▼ 2.5 kg</Text>
            </View>
          </View>

          <View style={styles.chartWrap}>
            <AreaChartMini
              data={WEIGHT_DATA}
              height={230}
              stroke={shellColors.primary}
              fill={shellColors.light.activeNavBg}
              yMin={68}
              yMax={74}
              yTicks={[68, 70, 72, 74]}
              showXLabels
              dotRadius={3}
              name="Weight"
              unit="kg"
            />
          </View>
        </View>

        {/* Workout */}
        <View style={[styles.card, card, styles.flex1]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.sectionTitle, textColor]}>Workout Progress</Text>
              <Text style={styles.sectionSubtitle}>Your weekly workout activity</Text>
            </View>

            <Ionicons name="barbell" size={22} color={shellColors.primary} />
          </View>

          <View style={styles.barsList}>
            {WORKOUT_BARS.map((bar) => (
              <ProgressBar key={bar.label} {...bar} textColor={textColor} trackBg={trackBg} />
            ))}
          </View>

          {/* Weekly total */}
          <View style={[styles.weeklyGoal, { backgroundColor: darkMode ? colors.mintTintDark : colors.mintTint }]}>
            <View style={styles.weeklyGoalHeader}>
              <View style={[styles.weeklyGoalIcon, { backgroundColor: darkMode ? "#394d32" : shellColors.light.activeNavBg }]}>
                <Ionicons name="locate" size={20} color={shellColors.primary} />
              </View>

              <View>
                <Text style={[styles.weeklyGoalTitle, textColor]}>Weekly Goal</Text>
                <Text style={styles.weeklyGoalNote}>4 of 5 workouts completed</Text>
              </View>
            </View>

            <View style={[styles.progressTrack, trackBg, styles.weeklyGoalTrack]}>
              <View style={[styles.progressFill, { width: "80%" }]} />
            </View>
          </View>
        </View>
      </View>
    </DashboardLayout>
  );
}


function ProgressBar({ label, value, width, textColor, trackBg }) {
  return (
    <View>
      <View style={styles.rowBetween}>
        <Text style={[styles.barLabel, textColor]}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>

      <View style={[styles.progressTrack, trackBg, styles.mt2]}>
        <View style={[styles.progressFill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...progressStyles,

  wrapRow: { flexWrap: "wrap" },
  fullWidth: { width: "100%", minWidth: 0, boxSizing: "border-box" },
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-4
  mt2: { marginTop: 8 },

  // Header
  pageHeader: { marginBottom: 20 }, // mb-5
  pageTitle: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  pageSubtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted }, // mt-1 text-sm

  // Summary
  summaryRow: { flexDirection: "row", gap: 12 }, // gap-3
  summaryCard: { flexGrow: 1, flexBasis: 190, minWidth: 180 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryTitle: { fontSize: 12, fontWeight: "600" }, // text-xs font-semibold
  summaryValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 16 }, // mt-4
  summaryValue: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  summarySuffix: { fontSize: 12, color: colors.textMuted },
  summaryDelta: { marginTop: 4, fontSize: 12, fontWeight: "600" }, // mt-1 text-xs font-semibold
  summaryNote: { marginTop: 4, fontSize: 10, color: colors.textMuted }, // mt-1 text-[10px]

  // Progress
  mainRow: { flexDirection: "row", gap: 12, marginTop: 12 }, // mt-3 gap-3
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 10, color: colors.textMuted }, // mt-1 text-[10px]

  bigNum: { fontSize: 20, fontWeight: "700" }, // text-xl font-bold
  weightDelta: { fontSize: 10, fontWeight: "600", color: colors.green600 },

  chartWrap: { marginTop: 16 }, // mt-4

  // Workout
  barsList: { marginTop: 20, gap: 16 }, // mt-5 space-y-4
  barLabel: { fontSize: 12, fontWeight: "600" }, // text-xs font-semibold
  barValue: { fontSize: 10, fontWeight: "600", color: shellColors.primary }, // text-[10px] font-semibold

  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: shellColors.primary },

  // Weekly goal
  weeklyGoal: { marginTop: 24, borderRadius: radii.sm, padding: 16 }, // mt-6 p-4
  weeklyGoalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  weeklyGoalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  weeklyGoalTitle: { fontSize: 14, fontWeight: "700" }, // text-sm font-bold
  weeklyGoalNote: { fontSize: 10, color: colors.textMuted },
  weeklyGoalTrack: { marginTop: 12 },
});