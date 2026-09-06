import AreaChartMini from "@components/nutrifit/AreaChartMini";
import DashboardLayout from "@components/nutrifit/DashboardLayout";
import DonutChart from "@components/nutrifit/DonutChart";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


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

const SUMMARY_CARDS = [
  { key: "calories", title: "Calories", value: "13,850", unit: "kcal", note: "Goal: 15,400", bg: "#e7f9df", color: "#4CAF2F", icon: "flame" },
  { key: "workouts", title: "Workouts", value: "5/6", unit: "sessions", note: null, bg: "#e5f0ff", color: "#2b7fff", icon: "barbell" },
  { key: "steps", title: "Steps", value: "58,420", unit: "Steps", note: "Goal: 70,000", bg: "#fbe7fb", color: "#c86ee0", icon: "footsteps" },
  { key: "streak", title: "Streak", value: "7", unit: "Days", note: null, bg: "#fdeee0", color: "#fb923c", icon: "flame" },
];

const MACROS = [
  { label: "Protein", value: 35, grams: "487g", color: "#4CAF2F" },
  { label: "Carbs", value: 45, grams: "623g", color: "#60a5fa" },
  { label: "Fats", value: 20, grams: "245g", color: "#f59e0b" },
];

const ACHIEVEMENTS = [
  { title: "7 Day Streak", note: "Keep it Up!", bg: "#e7f9df", color: "#4CAF2F", kind: "text", label: "7" },
  { title: "Healthy Eater", note: "Eat Balanced", bg: "#fdeee0", color: "#fb923c", kind: "icon", icon: "restaurant" },
  { title: "Early Bird", note: "Morning Person", bg: "#fbe7fb", color: "#c86ee0", kind: "icon", icon: "sunny" },
  { title: "Workout Warrior", note: "5 Workouts", bg: "#e5f0ff", color: "#2b7fff", kind: "icon", icon: "barbell" },
];

export default function ProgressScreen() {
  const { shell: c } = useTheme();
  const [period, setPeriod] = useState("Week");

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
        {SUMMARY_CARDS.map((item) => (
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
            stroke="#00e51a"
            fill="#c9f9ce"
            yMin={0}
            yMax={2400}
            yTicks={[0, 800, 1600, 2400]}
            yTickFormat={(v) => (v === 2400 ? "2.4k" : v === 1600 ? "1.6k" : v === 800 ? "800" : "0")}
          />
        </View>
      </View>

      {/* Charts/Graphs*/}
      <View style={styles.midRow}>
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
            <AreaChartMini data={WEIGHT_DATA} height={110} stroke="#4CAF2F" fill="#dcffcc" yMin={68} yMax={74} showXLabels dotRadius={3} />
          </View>
        </View>
      </View>

      {/*  Achievements */}
      <View style={[styles.rowBetween, styles.achievementsHeader]}>
        <Text style={[styles.sectionTitle, textColor]}>Achievements</Text>
        <Pressable>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.achievementsGrid}>
        {ACHIEVEMENTS.map((a) => (
          <View key={a.title} style={styles.achievementCard}>
            <View style={[styles.achievementIcon, { backgroundColor: a.bg }]}>
              {a.kind === "text" ? (
                <Text style={[styles.achievementDigit, { color: a.color }]}>{a.label}</Text>
              ) : (
                <Ionicons name={a.icon} size={20} color={a.color} />
              )}
            </View>
            <Text style={[styles.achievementTitle, textColor]}>{a.title}</Text>
            <Text style={styles.achievementNote}>{a.note}</Text>
          </View>
        ))}
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alignRight: { alignItems: "flex-end" },

  pageTitle: { fontSize: 22, fontWeight: "800" },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14, marginBottom: 12 },

  // Period
  tabTrack: { flexDirection: "row", borderRadius: radii.pill, padding: 4, marginTop: 16, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#4CAF2F" },
  tabText: { fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#ffffff" },

  // This week
  weekRow: { marginBottom: 16 },
  weekTitle: { fontSize: 17, fontWeight: "700" },
  weekRange: { fontSize: 12, color: "#6a7282", marginTop: 2 },
  weekArrows: { flexDirection: "row", gap: 8 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Summary
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  summaryCard: { width: "48%", borderRadius: radii.sm, padding: 12 },
  summaryTitle: { fontSize: 13, fontWeight: "700" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginTop: 10 },
  summaryUnit: { fontSize: 12, fontWeight: "600", color: "#6a7282" },
  summaryNote: { fontSize: 10, color: "#6a7282", marginTop: 4 },

  sectionTitle: { fontSize: 15, fontWeight: "700" },
  mutedSmall: { fontSize: 11, color: "#6a7282" },

  // Donut/Graphs
  midRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 12 },
  legend: { marginTop: 12, gap: 8 },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  legendValue: { fontSize: 11, fontWeight: "700" },
  legendGrams: { fontSize: 9, fontWeight: "500", color: "#6a7282" },

  weightNum: { fontSize: 18, fontWeight: "800" },
  weightNote: { fontSize: 10, color: "#6a7282", marginTop: 2 },
  weightDelta: { fontSize: 12, fontWeight: "700", color: "#00a63e" },

  // Achievements
  achievementsHeader: { marginBottom: 12 },
  viewAll: { fontSize: 12, fontWeight: "600", color: "#4CAF2F" },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { width: "48%", borderRadius: radii.sm, padding: 4, alignItems: "flex-start" },
  achievementIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  achievementDigit: { fontSize: 18, fontWeight: "800" },
  achievementTitle: { fontSize: 13, fontWeight: "700" },
  achievementNote: { fontSize: 11, color: "#6a7282", marginTop: 2 },
});
