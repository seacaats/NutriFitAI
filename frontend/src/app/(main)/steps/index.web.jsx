import { useDailySteps } from "@/features/steps/hooks/useDailySteps";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { formatNumber, friendlyDate } from "@/shared/services/steps/stepDates";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { stepsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Web is a READER of step data, never a source: there is no browser API for
 * step counts, so everything here comes from whatever the phone has already
 * synced to /api/steps. The connect affordance therefore points at the mobile
 * app rather than asking for a permission the browser cannot grant.
 *
 * All aggregation lives in useDailySteps, shared with app/(main)/steps/index.jsx,
 * so the two screens cannot disagree on what "daily average" means.
 */

export default function StepsScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const phone = width < 620;
  const { darkMode } = useTheme();

  const steps = useDailySteps();

  // recharts needs a value per bar, so days with no data are mapped to 0 for
  // layout purposes but tagged `hasData: false` -- the Cell fill and the
  // tooltip both read that flag so a gap never renders as a real zero.
  const data = steps.series.map((bucket) => ({
    day: bucket.label,
    steps: bucket.steps ?? 0,
    hasData: bucket.steps !== null,
  }));

  const connected = Boolean(steps.tracking.connectedAt);

  // The weekly challenge is a real target measured against real steps rather
  // than the hardcoded 58,947 it used to show.
  const CHALLENGE_TARGET = steps.dailyGoal * 7;
  const challengeTotal = steps.range === "Week" ? steps.total : 0;
  const challengeRemaining = Math.max(CHALLENGE_TARGET - challengeTotal, 0);

  // Same card/border/muted/soft/track tones every dashboard screen shares
  // (see shared/theme/nutrifit.js); `text` keeps its own light-mode value
  // (#172015) rather than the usual #111111.
  const palette = { ...getScreenTones(darkMode), text: darkMode ? colors.white : colors.deepGreenText };

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
            <Text style={styles.syncText}>
              {connected ? `Syncing from ${steps.tracking.source === "healthkit" ? "Apple Health" : "Health Connect"}` : "No phone connected"}
            </Text>
          </View>
          <Pressable onPress={steps.refresh} style={styles.startButton}>
            <Ionicons name="refresh" size={17} color={colors.white} />
            <Text style={styles.startButtonText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.heroRow}>
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGap}>
              <View style={styles.stepIcon}><Ionicons name="footsteps" size={24} color={colors.white} /></View>
              <View>
                <Text style={[styles.cardKicker, { color: palette.muted }]}>TODAY'S STEPS</Text>
                <Text style={[styles.heroValue, { color: palette.text }]}>
                  {steps.todaySteps === null ? "--" : formatNumber(steps.todaySteps)}
                </Text>
              </View>
            </View>
            <Text style={styles.goalPercent}>{steps.goalPercent}%</Text>
          </View>
          <View style={[styles.goalTrack, { backgroundColor: palette.track }]}><View style={[styles.goalFill, { width: `${steps.goalPercent}%` }]} /></View>
          <View style={styles.rowBetween}>
            <Text style={[styles.goalCopy, { color: palette.muted }]}>
              {steps.todaySteps === null
                ? "Nothing recorded yet today"
                : `${formatNumber(Math.max(steps.dailyGoal - steps.todaySteps, 0))} steps to your daily goal`}
            </Text>
            <Text style={[styles.goalCopyStrong, { color: palette.text }]}>Goal {formatNumber(steps.dailyGoal)}</Text>
          </View>
        </View>
        {/* Only metrics the database actually holds. Calories and active time
            were invented constants before; showing a real "best day" beats
            showing a plausible fiction. */}
        <MetricCard icon="navigate-outline" label="Distance" value={(steps.distanceMeters / 1000).toFixed(1)} suffix="km" palette={palette} />
        <MetricCard icon="calendar-outline" label="Days logged" value={String(steps.recordedDays)} suffix={steps.range.toLowerCase()} palette={palette} />
        <MetricCard icon="trophy-outline" label="Best day" value={steps.bestDay ? formatNumber(steps.bestDay.stepCount) : "--"} suffix="steps" palette={palette} />
      </View>

      <View style={[styles.contentRow, narrow && styles.stackRow]}>
        <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.chartHeader, phone && styles.chartHeaderPhone]}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Step activity</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Your movement across this {steps.range.toLowerCase()}</Text>
            </View>
            <View style={[styles.rangeTabs, { backgroundColor: palette.soft }]}>
              {steps.ranges.map((item) => (
                <Pressable key={item} onPress={() => steps.setRange(item)} style={[styles.rangeTab, steps.range === item && styles.rangeTabActive]}>
                  <Text style={[styles.rangeText, { color: steps.range === item ? colors.white : palette.muted }]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.chartStats}>
            <ChartStat value={formatNumber(steps.total)} label="Total steps" palette={palette} />
            <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
            <ChartStat value={formatNumber(steps.average)} label="Daily average" palette={palette} />
            <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
            <ChartStat value={String(steps.goalDays)} label="Goal days" palette={palette} />
          </View>
          <View style={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={palette.border} vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: palette.muted, fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: palette.muted, fontSize: 10 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value, name, entry) => [entry?.payload?.hasData ? formatNumber(value) : "No data", "Steps"]}
                  cursor={{ fill: palette.soft }}
                  contentStyle={{ borderRadius: 8, borderColor: palette.border, backgroundColor: palette.card, color: palette.text }}
                  // `contentStyle.color` only styles the tooltip's outer
                  // wrapper -- recharts renders the label and each item's
                  // text with their own default (black) color unless told
                  // otherwise, which is why the tooltip read as solid black
                  // text on hover regardless of theme.
                  itemStyle={{ color: palette.text }}
                  labelStyle={{ color: palette.text }}
                />
                <Bar dataKey="steps" radius={[7, 7, 0, 0]} maxBarSize={42}>
                  {data.map((item) => (
                    <Cell
                      key={item.day}
                      fill={!item.hasData ? palette.track : item.steps >= steps.dailyGoal ? shellColors.primary : colors.stepsInactiveFill}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </View>
        </View>

        <View style={styles.challengeCard}>
          <View style={styles.challengeIcon}><Ionicons name="trophy" size={22} color="#f9c74f" /></View>
          <Text style={styles.challengeKicker}>WEEKLY CHALLENGE</Text>
          <Text style={styles.challengeTitle}>Walk {formatNumber(CHALLENGE_TARGET)} steps</Text>
          <Text style={styles.challengeCopy}>
            {challengeRemaining > 0
              ? `You are ${formatNumber(challengeRemaining)} steps away. One short walk could get you there.`
              : "Challenge complete. Great work staying active this week!"}
          </Text>
          <View style={styles.challengeNumbers}>
            <Text style={styles.challengeCurrent}>{formatNumber(challengeTotal)}</Text><Text style={styles.challengeGoal}> / {formatNumber(CHALLENGE_TARGET)}</Text>
          </View>
          <View style={styles.challengeTrack}><View style={[styles.challengeFill, { width: `${Math.min((challengeTotal / CHALLENGE_TARGET) * 100, 100)}%` }]} /></View>
          <View style={styles.challengeFooter}>
            <Ionicons name="calendar-outline" size={15} color="#cde8c2" /><Text style={styles.challengeFooterText}>This week</Text>
          </View>
        </View>
      </View>

      <View style={[styles.recentCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent days</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Your latest synced activity</Text>
          </View>
          <View style={[styles.filterButton, { borderColor: palette.border }]}>
            <Ionicons name="options-outline" size={16} color={palette.text} /><Text style={[styles.filterText, { color: palette.text }]}>All activity</Text>
          </View>
        </View>
        {steps.recentDays.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={connected ? "footsteps-outline" : "phone-portrait-outline"} size={28} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {connected ? "No steps recorded in this period" : "Connect your phone to track steps"}
            </Text>
            <Text style={[styles.emptyCopy, { color: palette.muted }]}>
              {/* The distinction the tracking.connectedAt flag exists for: a
                  brand-new account needs different advice from an account that
                  simply had a quiet week. */}
              {connected
                ? "Open NutriFit on your phone to sync your latest activity."
                : "Step counts come from your phone's health data. Open NutriFit on iOS or Android and connect Apple Health or Health Connect."}
            </Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {steps.recentDays.map((day, index) => (
              <View
                key={day.activityDate}
                style={[styles.activityRow, phone && styles.activityRowPhone, index > 0 && { borderTopColor: palette.border, borderTopWidth: 1 }]}
              >
                <View style={[styles.activityIcon, { backgroundColor: palette.soft }]}>
                  <Ionicons name="walk-outline" size={20} color={shellColors.primary} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityTitle, { color: palette.text }]}>{friendlyDate(day.activityDate)}</Text>
                  <Text style={[styles.activityDate, { color: palette.muted }]}>
                    {day.source === "manual" ? "Entered manually" : "From your phone"}
                  </Text>
                </View>
                <ActivityMetric value={formatNumber(day.stepCount)} label="steps" palette={palette} />
                <ActivityMetric
                  value={day.distanceMeters ? `${(day.distanceMeters / 1000).toFixed(1)} km` : "--"}
                  label="distance"
                  palette={palette}
                />
                <ActivityMetric
                  value={day.stepCount >= steps.dailyGoal ? "Goal hit" : `${Math.round((day.stepCount / steps.dailyGoal) * 100)}%`}
                  label="of goal"
                  palette={palette}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </DashboardLayout>
  );
}

function MetricCard({ icon, label, value, suffix, palette }) {
  return <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
    <View style={[styles.metricIcon, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={19} color={shellColors.primary} /></View>
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
  ...stepsStyles,

  pageHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  pageHeaderNarrow: { flexWrap: "wrap", alignItems: "flex-start" },
  stackRow: { flexDirection: "column" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3 }, pageTitle: { marginTop: 2, fontSize: 28, fontWeight: "800" }, pageSubtitle: { marginTop: 4, fontSize: 13 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, syncPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }, syncText: { color: "#4f7150", fontSize: 10, fontWeight: "700" },
  startButton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: shellColors.primary }, pauseButton: { backgroundColor: "#ef7d22" }, startButtonText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, heroCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18 },
  stepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: shellColors.primary }, cardKicker: { fontSize: 9, fontWeight: "800", letterSpacing: 1 }, heroValue: { fontSize: 30, lineHeight: 34, fontWeight: "800" }, goalPercent: { color: shellColors.primary, fontSize: 20, fontWeight: "800" },
  goalTrack: { height: 9, borderRadius: 5, overflow: "hidden", marginTop: 17 }, goalFill: { height: 9, borderRadius: 5, backgroundColor: shellColors.primary }, goalCopy: { fontSize: 10, marginTop: 9 }, goalCopyStrong: { fontSize: 10, fontWeight: "700", marginTop: 9 },
  metricCard: { minWidth: 145, flex: 1, borderWidth: 1, borderRadius: radii.md, padding: 16 }, metricIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, metricLabel: { marginTop: 12, fontSize: 10, fontWeight: "700" }, metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 3 }, metricValue: { fontSize: 22, fontWeight: "800" }, metricSuffix: { fontSize: 10, fontWeight: "600" },
  contentRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }, chartCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18 }, chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, chartHeaderPhone: { flexDirection: "column", alignItems: "flex-start" }, sectionTitle: { fontSize: 17, fontWeight: "800" }, sectionSubtitle: { marginTop: 3, fontSize: 10 },
  rangeTabs: { flexDirection: "row", padding: 3, borderRadius: 8 }, rangeTab: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }, rangeText: { fontSize: 10, fontWeight: "700" },
  chartStats: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 18 }, chartStatValue: { fontSize: 17, fontWeight: "800" }, chartStatLabel: { marginTop: 2, fontSize: 9 }, statDivider: { width: 1, height: 30 }, chartWrap: { height: 220, marginTop: 14 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 34, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptyCopy: { fontSize: 11, lineHeight: 17, textAlign: "center", maxWidth: 420 },
  challengeCard: { minWidth: 250, flex: 1, borderRadius: radii.md, padding: 20, backgroundColor: "#244c1b" }, challengeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }, challengeKicker: { marginTop: 28, color: "#aeda9d", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 }, challengeTitle: { marginTop: 5, color: colors.white, fontSize: 21, fontWeight: "800" }, challengeCopy: { marginTop: 8, color: "#cde8c2", fontSize: 11, lineHeight: 17 },
  challengeNumbers: { flexDirection: "row", alignItems: "baseline", marginTop: 22 }, challengeCurrent: { color: colors.white, fontSize: 19, fontWeight: "800" }, challengeGoal: { color: "#aeda9d", fontSize: 10, fontWeight: "600" }, challengeTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 4, overflow: "hidden", marginTop: 8 }, challengeFill: { height: 8, borderRadius: 4, backgroundColor: "#9ed67e" }, challengeFooter: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 13 }, challengeFooterText: { color: "#cde8c2", fontSize: 10, fontWeight: "600" },
  recentCard: { marginTop: 12, borderWidth: 1, borderRadius: radii.md, padding: 18 }, filterButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 }, filterText: { fontSize: 10, fontWeight: "700" }, activityList: { marginTop: 13 }, activityRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }, activityRowPhone: { flexWrap: "wrap" }, activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, activityInfo: { flex: 1, minWidth: 180 }, activityTitle: { fontSize: 12, fontWeight: "700" }, activityDate: { marginTop: 3, fontSize: 9 }, activityMetric: { width: 100 }, activityMetricValue: { fontSize: 12, fontWeight: "800" }, activityMetricLabel: { marginTop: 2, fontSize: 8 },
});