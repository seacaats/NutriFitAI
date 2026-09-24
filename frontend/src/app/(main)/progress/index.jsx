import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DonutChart from "@/shared/components/charts/DonutChart";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, radii, shellColors } from "@/shared/theme/nutrifit";
import { progressStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";


const PERIODS = ["Week", "Month", "3 Months", "Year"];

const CALORIE_DATA = [
  { label: "Mon", value: 1600 },
  { label: "Tue", value: 1900 },
  { label: "Wed", value: 1650 },
  { label: "Thu", value: 1900 },
  { label: "Fri", value: 1550 },
  { label: "Sat", value: 2150 },
  { label: "Sun", value: 1900 },
];

const WEIGHT_DATA = [
  { label: "Apr 21", value: 72.5 },
  { label: "Apr 28", value: 72 },
  { label: "May 5", value: 71.3 },
  { label: "May 12", value: 70.6 },
  { label: "May 18", value: 70 },
];

/**
 * Card shells. Only Workouts carries real data so far — the others stay
 * hardcoded until meals and a streak rule exist, kept as placeholders so the
 * grid does not reflow as each is wired up in turn.
 */
const SUMMARY_CARDS = [
  { key: "calories", title: "Calories", value: "13,850", unit: "kcal", note: "Goal: 15,400", bg: chipTints.green.light, color: shellColors.primary, icon: "flame" },
  { key: "workouts", title: "Workouts", value: "—", unit: "sessions", note: null, bg: chipTints.blue.light, color: chipTints.blue.icon, icon: "barbell" },
  { key: "steps", title: "Steps", value: "58,420", unit: "Steps", note: "Goal: 70,000", bg: chipTints.purple.light, color: chipTints.purple.icon, icon: "footsteps" },
  { key: "streak", title: "Streak", value: "7", unit: "Days", note: null, bg: chipTints.orange.light, color: colors.orange400, icon: "flame" },
];

/**
 * "5/6" when a weekly goal is set, "5" when it is not.
 *
 * Deliberately not "5/0" or a 0% bar for a user without a goal: a denominator
 * of nothing is not progress, and rendering it implies they are failing at
 * something they never set.
 */
function resolveSummaryCards(summary) {
  return SUMMARY_CARDS.map((card) => {
    if (card.key !== "workouts") return card;
    if (!summary) return card;
    return {
      ...card,
      value: summary.target ? `${summary.completed}/${summary.target}` : `${summary.completed}`,
      note: summary.target ? `Goal: ${summary.target}` : null,
    };
  });
}

const MACROS = [
  { label: "Protein", value: 35, grams: "487g", color: shellColors.primary },
  { label: "Carbs", value: 45, grams: "623g", color: colors.blue400 },
  { label: "Fats", value: 20, grams: "245g", color: chipTints.orange.icon },
];

export default function ProgressScreen() {
  const { summary } = useWorkoutSessions();
  const summaryCards = resolveSummaryCards(summary);

  const { shell: c } = useTheme();
  const [period, setPeriod] = useState("Week");
  const { width } = useWindowDimensions();
  const compact = width < 400;

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const tabTrack = { backgroundColor: c.inactiveNavHoverBg };

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.rowBetween}>
        <Text style={[styles.pageTitle, textColor]}>My Progress</Text>
        <Ionicons name="calendar-outline" size={22} color={c.sidebarText} />
      </View>

      {/* Period */}
      <View style={[styles.tabTrack, tabTrack]}>
        {PERIODS.map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.tabBtn, p === period && styles.tabBtnActive]}>
            <Text style={[styles.tabText, p === period ? styles.tabTextActive : { color: c.inactiveNavText }]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {/* This Week */}
      <View style={[styles.rowBetween, styles.weekRow]}>
        <View>
          <Text style={[styles.weekTitle, textColor]}>This {period}</Text>
          <Text style={styles.weekRange}>May 12 – May 18, 2024</Text>
        </View>

        <View style={styles.weekArrows}>
          <Pressable style={[styles.arrowBtn, { backgroundColor: c.inactiveNavHoverBg }]}>
            <Ionicons name="chevron-back" size={16} color={c.sidebarText} />
          </Pressable>
          <Pressable style={[styles.arrowBtn, { backgroundColor: c.inactiveNavHoverBg }]}>
            <Ionicons name="chevron-forward" size={16} color={c.sidebarText} />
          </Pressable>
        </View>
      </View>

      {/*Summary */}
      <View style={styles.summaryGrid}>
        {summaryCards.map((item) => (
          <View key={item.key} style={[styles.summaryCard, { backgroundColor: item.bg }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.summaryTitle, { color: item.color }]}>{item.title}</Text>
              <Ionicons name={item.icon} size={16} color={item.color} />
            </View>
            <Text style={[styles.summaryValue, textColor]}>
              {item.value}
              <Text style={styles.summaryUnit}> {item.unit}</Text>
            </Text>
            {item.note && <Text style={styles.summaryNote}>{item.note}</Text>}
          </View>
        ))}
      </View>

      {/* Calories Trend */}
      <View style={[styles.card, card]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, textColor]}>Calories Trend</Text>
          <Text style={styles.mutedSmall}>Average: 1978 kcal</Text>
        </View>

        <View style={{ marginTop: 8 }}>
          <AreaChartMini
            data={CALORIE_DATA}
            height={160}
            stroke={colors.stepsChartStroke}
            fill={colors.stepsChartFill}
            yMin={0}
            yMax={2400}
            yTicks={[0, 800, 1600, 2400]}
            yTickFormat={(v) => (v === 2400 ? "2.4k" : v === 1600 ? "1.6k" : v === 800 ? "800" : "0")}
          />
        </View>
      </View>

      {/* Charts/Graphs*/}
      <View style={[styles.midRow, compact && styles.stackRow]}>
        {/* Macronutrient Distribution */}
        <View style={[styles.card, card, styles.flex1]}>
          <Text style={[styles.sectionTitle, textColor]}>Macronutrient Distribution</Text>

          <View style={styles.donutWrap}>
            <DonutChart
              size={92}
              strokeWidth={15}
              centerBg={c.cardBg}
              segments={MACROS.map((m) => ({ value: m.value, color: m.color }))}
            />
          </View>

          <View style={styles.legend}>
            {MACROS.map((m) => (
              <View key={m.label} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                  <Text style={[styles.legendLabel, textColor]}>{m.label}</Text>
                </View>
                <View style={styles.alignRight}>
                  <Text style={[styles.legendValue, textColor]}>{m.value}%</Text>
                  <Text style={styles.legendGrams}>{m.grams}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Weight Progress */}
        <View style={[styles.card, card, styles.flex1]}>
          <Text style={[styles.sectionTitle, textColor]}>Weight Progress</Text>

          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.weightNum, textColor]}>70 kg</Text>
              <Text style={styles.weightNote}>Current</Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={styles.weightDelta}>▼ 2.5 kg</Text>
              <Text style={styles.weightNote}>vs last month</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <AreaChartMini data={WEIGHT_DATA} height={110} stroke={shellColors.primary} fill={shellColors.light.activeNavBg} yMin={68} yMax={74} showXLabels dotRadius={3} />
          </View>
        </View>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...progressStyles,

  pageTitle: { fontSize: 22, fontWeight: "800" },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14, marginBottom: 12 },

  // Period
  tabTrack: { flexDirection: "row", borderRadius: radii.pill, padding: 4, marginTop: 16, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  tabBtnActive: { backgroundColor: shellColors.primary },
  tabText: { fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.white },

  // This week
  weekRow: { marginBottom: 16 },
  weekTitle: { fontSize: 17, fontWeight: "700" },
  weekRange: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  weekArrows: { flexDirection: "row", gap: 8 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Summary
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  summaryCard: { width: "48%", borderRadius: radii.sm, padding: 12 },
  summaryTitle: { fontSize: 13, fontWeight: "700" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginTop: 10 },
  summaryUnit: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  summaryNote: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  sectionTitle: { fontSize: 15, fontWeight: "700" },
  mutedSmall: { fontSize: 11, color: colors.textMuted },

  // Donut/Graphs
  midRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 12 },
  legend: { marginTop: 12, gap: 8 },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  legendValue: { fontSize: 11, fontWeight: "700" },
  legendGrams: { fontSize: 9, fontWeight: "500", color: colors.textMuted },

  weightNum: { fontSize: 18, fontWeight: "800" },
  weightNote: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  weightDelta: { fontSize: 12, fontWeight: "700", color: colors.green600 },
});