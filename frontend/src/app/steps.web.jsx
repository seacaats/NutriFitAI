import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const RANGE_DATA = {
  Week: [
    { day: "Mon", steps: 8240 }, { day: "Tue", steps: 10120 }, { day: "Wed", steps: 7680 },
    { day: "Thu", steps: 9240 }, { day: "Fri", steps: 8460 }, { day: "Sat", steps: 7365 }, { day: "Sun", steps: 7842 },
  ],
  Month: [
    { day: "W1", steps: 7840 }, { day: "W2", steps: 9180 }, { day: "W3", steps: 8421 }, { day: "W4", steps: 9560 },
  ],
  Year: [
    { day: "Jan", steps: 6920 }, { day: "Feb", steps: 7280 }, { day: "Mar", steps: 7810 },
    { day: "Apr", steps: 8160 }, { day: "May", steps: 8421 }, { day: "Jun", steps: 8750 },
    { day: "Jul", steps: 9120 }, { day: "Aug", steps: 8890 }, { day: "Sep", steps: 9340 },
  ],
};

const RECENT_ACTIVITIES = [
  { title: "Morning neighborhood walk", date: "Today, 7:12 AM", steps: "3,482", distance: "2.6 km", time: "31 min", icon: "sunny-outline" },
  { title: "Lunch break walk", date: "Yesterday, 12:36 PM", steps: "2,196", distance: "1.7 km", time: "22 min", icon: "restaurant-outline" },
  { title: "Evening park loop", date: "Sep 8, 6:04 PM", steps: "5,032", distance: "3.9 km", time: "47 min", icon: "leaf-outline" },
];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);

export default function StepsScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const phone = width < 620;
  const { darkMode } = useTheme();
  const [range, setRange] = useState("Week");
  const [isTracking, setIsTracking] = useState(false);
  const [sessionSteps, setSessionSteps] = useState(0);
  const data = useMemo(() => RANGE_DATA[range].map((item, index, items) => (
    index === items.length - 1 ? { ...item, steps: item.steps + sessionSteps } : item
  )), [range, sessionSteps]);
  const total = useMemo(() => data.reduce((sum, item) => sum + item.steps, 0), [data]);
  const average = Math.round(total / data.length);
  const goalDays = data.filter((item) => item.steps >= 10000).length;
  const todaySteps = 7842 + sessionSteps;
  const goalPercent = Math.min(Math.round((todaySteps / 10000) * 100), 100);
  const challengeTotal = 58947 + sessionSteps;
  const challengeRemaining = Math.max(60000 - challengeTotal, 0);

  useEffect(() => {
    if (!isTracking) return undefined;
    const interval = setInterval(() => setSessionSteps((steps) => steps + 1), 600);
    return () => clearInterval(interval);
  }, [isTracking]);
  const palette = {
    card: darkMode ? "#222222" : "#ffffff", border: darkMode ? "#364153" : "#e5e7eb",
    text: darkMode ? "#ffffff" : "#172015", muted: darkMode ? "#9ca3af" : "#6a7282",
    soft: darkMode ? "#293328" : "#f1f8ed", track: darkMode ? "#364153" : "#e8ece6",
  };

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>ACTIVITY</Text>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Steps</Text>
          <Text style={[styles.pageSubtitle, { color: palette.muted }]}>Move more, build consistency, and make every step count.</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.syncPill, { backgroundColor: palette.soft }]}>
            <View style={styles.liveDot} />
            <Text style={styles.syncText}>Frontend demo tracker</Text>
          </View>
          <Pressable onPress={() => setIsTracking((tracking) => !tracking)} style={[styles.startButton, isTracking && styles.pauseButton]}>
            <Ionicons name={isTracking ? "pause" : "walk"} size={17} color="#ffffff" />
            <Text style={styles.startButtonText}>{isTracking ? "Pause walk" : sessionSteps ? "Resume walk" : "Start walking"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.heroRow}>
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGap}>
              <View style={styles.stepIcon}><Ionicons name="footsteps" size={24} color="#ffffff" /></View>
              <View>
                <Text style={[styles.cardKicker, { color: palette.muted }]}>TODAY'S STEPS</Text>
                <Text style={[styles.heroValue, { color: palette.text }]}>{formatNumber(todaySteps)}</Text>
              </View>
            </View>
            <Text style={styles.goalPercent}>{goalPercent}%</Text>
          </View>
          <View style={[styles.goalTrack, { backgroundColor: palette.track }]}><View style={[styles.goalFill, { width: `${goalPercent}%` }]} /></View>
          <View style={styles.rowBetween}>
            <Text style={[styles.goalCopy, { color: palette.muted }]}>{formatNumber(Math.max(10000 - todaySteps, 0))} steps to your daily goal</Text>
            <Text style={[styles.goalCopyStrong, { color: palette.text }]}>Goal 10,000</Text>
          </View>
          {sessionSteps > 0 && <Text style={styles.sessionSteps}>+{formatNumber(sessionSteps)} steps in this walking session</Text>}
        </View>
        <MetricCard icon="navigate-outline" label="Distance" value="5.9" suffix="km" palette={palette} />
        <MetricCard icon="flame-outline" label="Calories" value="326" suffix="kcal" palette={palette} />
        <MetricCard icon="time-outline" label="Active time" value="1h 14" suffix="min" palette={palette} />
      </View>

      <View style={[styles.contentRow, narrow && styles.stackRow]}>
        <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.chartHeader, phone && styles.chartHeaderPhone]}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Step activity</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Your movement across this {range.toLowerCase()}</Text>
            </View>
            <View style={[styles.rangeTabs, { backgroundColor: palette.soft }]}>
              {Object.keys(RANGE_DATA).map((item) => (
                <Pressable key={item} onPress={() => setRange(item)} style={[styles.rangeTab, range === item && styles.rangeTabActive]}>
                  <Text style={[styles.rangeText, { color: range === item ? "#ffffff" : palette.muted }]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.chartStats}>
            <ChartStat value={formatNumber(total)} label="Total steps" palette={palette} />
            <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
            <ChartStat value={formatNumber(average)} label="Daily average" palette={palette} />
            <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
            <ChartStat value={goalDays} label="Goal days" palette={palette} />
          </View>
          <View style={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={palette.border} vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: palette.muted, fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: palette.muted, fontSize: 10 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value) => [formatNumber(value), "Steps"]} cursor={{ fill: palette.soft }} contentStyle={{ borderRadius: 8, borderColor: palette.border, backgroundColor: palette.card, color: palette.text }} />
                <Bar dataKey="steps" radius={[7, 7, 0, 0]} maxBarSize={42}>
                  {data.map((item) => <Cell key={item.day} fill={item.steps >= 10000 ? "#4CAF2F" : "#a8d795"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </View>
        </View>

        <View style={styles.challengeCard}>
          <View style={styles.challengeIcon}><Ionicons name="trophy" size={22} color="#f9c74f" /></View>
          <Text style={styles.challengeKicker}>WEEKLY CHALLENGE</Text>
          <Text style={styles.challengeTitle}>Walk 60,000 steps</Text>
          <Text style={styles.challengeCopy}>{challengeRemaining > 0 ? `You are ${formatNumber(challengeRemaining)} steps away. One short walk could get you there.` : "Challenge complete. Great work staying active this week!"}</Text>
          <View style={styles.challengeNumbers}>
            <Text style={styles.challengeCurrent}>{formatNumber(challengeTotal)}</Text><Text style={styles.challengeGoal}> / 60,000</Text>
          </View>
          <View style={styles.challengeTrack}><View style={[styles.challengeFill, { width: `${Math.min((challengeTotal / 60000) * 100, 100)}%` }]} /></View>
          <View style={styles.challengeFooter}>
            <Ionicons name="calendar-outline" size={15} color="#cde8c2" /><Text style={styles.challengeFooterText}>3 days left</Text>
          </View>
        </View>
      </View>

      <View style={[styles.recentCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent walks</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Your latest recorded movement</Text>
          </View>
          <View style={[styles.filterButton, { borderColor: palette.border }]}>
            <Ionicons name="options-outline" size={16} color={palette.text} /><Text style={[styles.filterText, { color: palette.text }]}>All activity</Text>
          </View>
        </View>
        <View style={styles.activityList}>
          {RECENT_ACTIVITIES.map((activity, index) => (
            <View key={activity.title} style={[styles.activityRow, phone && styles.activityRowPhone, index > 0 && { borderTopColor: palette.border, borderTopWidth: 1 }]}>
              <View style={[styles.activityIcon, { backgroundColor: palette.soft }]}><Ionicons name={activity.icon} size={20} color="#4CAF2F" /></View>
              <View style={styles.activityInfo}>
                <Text style={[styles.activityTitle, { color: palette.text }]}>{activity.title}</Text>
                <Text style={[styles.activityDate, { color: palette.muted }]}>{activity.date}</Text>
              </View>
              <ActivityMetric value={activity.steps} label="steps" palette={palette} />
              <ActivityMetric value={activity.distance} label="distance" palette={palette} />
              <ActivityMetric value={activity.time} label="moving time" palette={palette} />
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </View>
          ))}
        </View>
      </View>
    </DashboardLayout>
  );
}

function MetricCard({ icon, label, value, suffix, palette }) {
  return <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
    <View style={[styles.metricIcon, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={19} color="#4CAF2F" /></View>
    <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
    <View style={styles.metricValueRow}><Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text><Text style={[styles.metricSuffix, { color: palette.muted }]}>{suffix}</Text></View>
  </View>;
}

function ChartStat({ value, label, palette }) {
  return <View><Text style={[styles.chartStatValue, { color: palette.text }]}>{value}</Text><Text style={[styles.chartStatLabel, { color: palette.muted }]}>{label}</Text></View>;
}

function ActivityMetric({ value, label, palette }) {
  return <View style={styles.activityMetric}><Text style={[styles.activityMetricValue, { color: palette.text }]}>{value}</Text><Text style={[styles.activityMetricLabel, { color: palette.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  pageHeaderNarrow: { flexWrap: "wrap", alignItems: "flex-start" },
  stackRow: { flexDirection: "column" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3 }, pageTitle: { marginTop: 2, fontSize: 28, fontWeight: "800" }, pageSubtitle: { marginTop: 4, fontSize: 13 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, syncPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4CAF2F" }, syncText: { color: "#4f7150", fontSize: 10, fontWeight: "700" },
  startButton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#4CAF2F" }, pauseButton: { backgroundColor: "#ef7d22" }, startButtonText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, rowGap: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, heroCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18 },
  stepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#4CAF2F" }, cardKicker: { fontSize: 9, fontWeight: "800", letterSpacing: 1 }, heroValue: { fontSize: 30, lineHeight: 34, fontWeight: "800" }, goalPercent: { color: "#4CAF2F", fontSize: 20, fontWeight: "800" },
  goalTrack: { height: 9, borderRadius: 5, overflow: "hidden", marginTop: 17 }, goalFill: { height: 9, borderRadius: 5, backgroundColor: "#4CAF2F" }, goalCopy: { fontSize: 10, marginTop: 9 }, goalCopyStrong: { fontSize: 10, fontWeight: "700", marginTop: 9 }, sessionSteps: { marginTop: 8, color: "#4CAF2F", fontSize: 10, fontWeight: "800" },
  metricCard: { minWidth: 145, flex: 1, borderWidth: 1, borderRadius: radii.md, padding: 16 }, metricIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, metricLabel: { marginTop: 12, fontSize: 10, fontWeight: "700" }, metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 3 }, metricValue: { fontSize: 22, fontWeight: "800" }, metricSuffix: { fontSize: 10, fontWeight: "600" },
  contentRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }, chartCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18 }, chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, chartHeaderPhone: { flexDirection: "column", alignItems: "flex-start" }, sectionTitle: { fontSize: 17, fontWeight: "800" }, sectionSubtitle: { marginTop: 3, fontSize: 10 },
  rangeTabs: { flexDirection: "row", padding: 3, borderRadius: 8 }, rangeTab: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }, rangeTabActive: { backgroundColor: "#4CAF2F" }, rangeText: { fontSize: 10, fontWeight: "700" },
  chartStats: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 18 }, chartStatValue: { fontSize: 17, fontWeight: "800" }, chartStatLabel: { marginTop: 2, fontSize: 9 }, statDivider: { width: 1, height: 30 }, chartWrap: { height: 220, marginTop: 14 },
  challengeCard: { minWidth: 250, flex: 1, borderRadius: radii.md, padding: 20, backgroundColor: "#244c1b" }, challengeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }, challengeKicker: { marginTop: 28, color: "#aeda9d", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 }, challengeTitle: { marginTop: 5, color: "#ffffff", fontSize: 21, fontWeight: "800" }, challengeCopy: { marginTop: 8, color: "#cde8c2", fontSize: 11, lineHeight: 17 },
  challengeNumbers: { flexDirection: "row", alignItems: "baseline", marginTop: 22 }, challengeCurrent: { color: "#ffffff", fontSize: 19, fontWeight: "800" }, challengeGoal: { color: "#aeda9d", fontSize: 10, fontWeight: "600" }, challengeTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 4, overflow: "hidden", marginTop: 8 }, challengeFill: { height: 8, borderRadius: 4, backgroundColor: "#9ed67e" }, challengeFooter: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 13 }, challengeFooterText: { color: "#cde8c2", fontSize: 10, fontWeight: "600" },
  recentCard: { marginTop: 12, borderWidth: 1, borderRadius: radii.md, padding: 18 }, filterButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 }, filterText: { fontSize: 10, fontWeight: "700" }, activityList: { marginTop: 13 }, activityRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }, activityRowPhone: { flexWrap: "wrap" }, activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, activityInfo: { flex: 1, minWidth: 180 }, activityTitle: { fontSize: 12, fontWeight: "700" }, activityDate: { marginTop: 3, fontSize: 9 }, activityMetric: { width: 100 }, activityMetricValue: { fontSize: 12, fontWeight: "800" }, activityMetricLabel: { marginTop: 2, fontSize: 8 },
});
