import { Card } from "@/components/nutrifit/Card";
import { DonutChart, LineChart } from "@/components/nutrifit/Charts";
import { progressStats } from "@/data/placeholders";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TABS = ["Week", "Month", "3 Months", "Year"];

function StatCard({ label, value, sub, goal, color, bg }: { label: string; value: string | number; sub?: string; goal?: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      {goal ? <Text style={styles.statGoal}>Goal: {goal}</Text> : null}
    </View>
  );
}

export default function ProgressScreen() {
  const [tab, setTab] = useState("Week");
  const s = progressStats;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Progress</Text>
        <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.weekNavRow}>
        <View>
          <Text style={styles.weekTitle}>This {tab}</Text>
          <Text style={styles.weekRange}>{s.weekLabel}</Text>
        </View>
        <View style={styles.weekArrows}>
          <Ionicons name="chevron-back-circle-outline" size={26} color={colors.textMuted} />
          <Ionicons name="chevron-forward-circle-outline" size={26} color={colors.textMuted} style={{ marginLeft: 10 }} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Calories" value={`${s.calories.value.toLocaleString()} kcal`} goal={s.calories.goal.toLocaleString()} color="#2E7D32" bg="#E3F5DC" />
        <StatCard label="Workouts" value={`${s.workouts.value}/${s.workouts.goal}`} sub="sessions" color="#1565C0" bg="#DCEBFB" />
        <StatCard label="Steps" value={s.steps.value.toLocaleString()} sub="Steps" goal={s.steps.goal.toLocaleString()} color="#AD1493" bg="#F9DDF3" />
        <StatCard label="Streak" value={s.streak} sub="Days" color="#E65100" bg="#FBE6D3" />
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>Calories Trend</Text>
          <Text style={styles.chartAvg}>Average: {s.caloriesTrendAvg} kcal</Text>
        </View>
      </Card>

      <View style={styles.twoColRow}>
        <Card style={styles.halfCard}>
          <Text style={styles.chartTitle}>Macronutrient{"\n"}Distribution</Text>
          <View style={styles.donutRow}>
            <DonutChart data={s.macroDistribution.map((m) => ({ ...m }))} size={110} strokeWidth={18} />
            <View style={styles.legend}>
              {s.macroDistribution.map((m) => (
                <View key={m.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                  <View>
                    <Text style={styles.legendLabel}>{m.label}</Text>
                    <Text style={styles.legendValue}>
                      {m.pct}% {m.grams}g
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Card style={styles.halfCard}>
          <Text style={styles.chartTitle}>Weight Progress</Text>
          <View style={styles.weightRow}>
            <Text style={styles.weightValue}>{s.weight.current} kg</Text>
            <Text style={styles.weightDelta}>
              {s.weight.deltaVsLastMonth < 0 ? "\u25bc" : "\u25b2"} {Math.abs(s.weight.deltaVsLastMonth)} kg
            </Text>
          </View>
          <Text style={styles.weightSub}>Current vs last month</Text>
          <LineChart data={s.weight.trend.map((d) => ({ label: d.label, value: d.kg }))} height={130} color="#2E7D32" />
        </Card>
      </View>

      <View style={styles.achievementsHeaderRow}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Pressable>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.achievementsGrid}>
        {s.achievements.map((a) => (
          <View key={a.id} style={[styles.achievementCard, { backgroundColor: a.bg }]}>
            <Ionicons name={a.icon} size={26} color={colors.textPrimary} style={{ marginBottom: 8 }} />
            <Text style={styles.achievementTitle}>{a.title}</Text>
            <Text style={styles.achievementSub}>{a.subtitle}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgWhite },
  container: { padding: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md, marginTop: 10 },
  title: { ...typography.h1 },
  tabsRow: { flexDirection: "row", backgroundColor: "#F0F0F0", borderRadius: radii.pill, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.pill, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  weekNavRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  weekTitle: { ...typography.h3 },
  weekRange: { color: colors.textSecondary, fontSize: 13 },
  weekArrows: { flexDirection: "row" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.lg },
  statCard: { width: "47.5%", borderRadius: radii.lg, padding: spacing.md },
  statLabel: { fontWeight: "700", fontSize: 13, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  statSub: { fontSize: 12, color: colors.textSecondary },
  statGoal: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  chartCard: { marginBottom: spacing.lg },
  chartHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  chartTitle: { ...typography.h3, fontSize: 15 },
  chartAvg: { fontSize: 12, color: colors.textSecondary },
  twoColRow: { flexDirection: "row", gap: 10, marginBottom: spacing.lg },
  halfCard: { flex: 1 },
  donutRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: 10 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  legendValue: { fontSize: 11, color: colors.textSecondary },
  weightRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  weightValue: { fontSize: 22, fontWeight: "800" },
  weightDelta: { color: colors.primary, fontWeight: "700" },
  weightSub: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
  achievementsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { ...typography.h3 },
  viewAll: { color: colors.primary, fontWeight: "700" },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { width: "47.5%", borderRadius: radii.lg, padding: spacing.md },
  achievementTitle: { fontWeight: "800", fontSize: 14 },
  achievementSub: { fontSize: 12, color: colors.textSecondary },
});
