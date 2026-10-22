import { RangeTabs, RecentDaysCard, StepGoalCard, StepStats, TodayStepsCard } from "@/features/steps/components/StepCards";
import { StepDayEditModal } from "@/features/steps/components/StepHistory";
import { useDailySteps } from "@/features/steps/hooks/useDailySteps";
import ChartBox from "@/shared/components/charts/ChartBox.web";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { useTheme } from "@/shared/context/ThemeContext";
import { CHART_FONT, chipTints, colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { stepsStyles } from "@/shared/theme/screenStyles";
import { formatNumber, todayISO } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

const CHART_HEIGHT = 260;

// Weekly challenge card tones: deep green in dark mode, soft green tint in light mode
const CHALLENGE_TONES = {
  dark: {
    card: { backgroundColor: "#244c1b" }, icon: "rgba(255,255,255,0.12)", title: colors.white, accent: "#aeda9d",
    copy: "#cde8c2", track: "rgba(255,255,255,0.18)", fill: "#9ed67e",
  },
  light: {
    card: { backgroundColor: chipTints.green.light, borderWidth: 1, borderColor: "#cdebbd" }, icon: "rgba(76,175,31,0.14)",
    title: colors.deepGreenText, accent: colors.green700, copy: "#3f6b33", track: "rgba(20,83,45,0.12)", fill: shellColors.primary,
  },
};

/**
 * Web steps screen: reads step data synced from the mobile app via /api/steps
 * or entered manually. Shares aggregation logic in useDailySteps with mobile.
 */

export default function StepsScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { darkMode } = useTheme();

  const steps = useDailySteps();
  const router = useRouter();
  // { date, current } while the edit dialog is open
  const [editing, setEditing] = useState(null);

  // Map unrecorded buckets to 0 with hasData: false so recharts lays out every slot
  // without rendering missing days as actual zero-step bars.
  // Month and Year buckets use daily averages (`avg`) to compare against the daily goal.
  const data = steps.series.map((bucket) => ({
    key: bucket.key,
    day: bucket.label,
    steps: bucket.avg ?? 0,
    hasData: bucket.avg !== null,
  }));
  const perDay = steps.range !== "Week";

  const connected = Boolean(steps.tracking.connectedAt);
  // Show skeletons only on initial load; range switches keep existing bars until new data arrives
  const first = !steps.loaded;
  // Quarter-goal ticks prevent recharts from rounding the Y-axis ceiling to an arbitrary number
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(steps.dailyGoal * f));

  const CHALLENGE_TARGET = steps.dailyGoal * 7;
  const challengeTotal = steps.range === "Week" ? steps.total : 0;
  const challengeRemaining = Math.max(CHALLENGE_TARGET - challengeTotal, 0);

  const palette = getScreenTones(darkMode);
  const ch = CHALLENGE_TONES[darkMode ? "dark" : "light"];

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.headerCopy}>
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
          <Pressable onPress={steps.refresh} disabled={steps.loading} style={[styles.startButton, steps.loading && { opacity: 0.6 }]}>
            <Ionicons name="refresh" size={17} color={colors.white} />
            <Text style={styles.startButtonText}>{steps.loading ? "Loading" : "Refresh"}</Text>
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
                {first ? <Skeleton width={130} height={34} /> : (
                  <Text style={[styles.heroValue, { color: palette.text }]}>
                    {steps.todaySteps === null ? "--" : formatNumber(steps.todaySteps)}
                  </Text>
                )}
              </View>
            </View>
            {first ? <Skeleton width={48} height={24} /> : <Text style={styles.goalPercent}>{steps.goalPercent}%</Text>}
          </View>
          <View style={[styles.goalTrack, { backgroundColor: palette.track }]}><View style={[styles.goalFill, { width: `${steps.goalPercent}%` }]} /></View>
          <View style={styles.rowBetween}>
            {first ? (
              <>
                <Skeleton width={170} height={13} style={styles.goalCopySkeleton} />
                <Skeleton width={70} height={13} style={styles.goalCopySkeleton} />
              </>
            ) : (
              <>
                <Text style={[styles.goalCopy, { color: palette.muted }]}>
                  {steps.todaySteps === null
                    ? "Nothing recorded yet today"
                    : `${formatNumber(Math.max(steps.dailyGoal - steps.todaySteps, 0))} steps to your daily goal`}
                </Text>
                <Text style={[styles.goalCopyStrong, { color: palette.text }]}>Goal {formatNumber(steps.dailyGoal)}</Text>
              </>
            )}
          </View>
        </View>
        <MetricCard icon="navigate-outline" label="Distance" value={(steps.distanceMeters / 1000).toFixed(1)} suffix="km" palette={palette} loading={first} />
        <MetricCard icon="calendar-outline" label="Days logged" value={String(steps.recordedDays)} suffix={steps.range.toLowerCase()} palette={palette} loading={first} />
        <MetricCard icon="trophy-outline" label="Best day" value={steps.bestDay ? formatNumber(steps.bestDay.stepCount) : "--"} suffix="steps" palette={palette} loading={first} />
      </View>

      <View style={[styles.contentRow, narrow && styles.stackRow]}>
        <View style={[styles.chartCard, narrow && styles.stackItem, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Step activity</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>Your movement across this {steps.range.toLowerCase()}</Text>
            </View>
            <RangeTabs steps={steps} palette={palette} wide />
          </View>
          <StepStats steps={steps} palette={palette} loading={first} wide />
          <View style={styles.chartWrap}>
            {first ? (
              // Seven placeholder bars matching the default Week view
              <View style={styles.chartSkeleton}>
                {[0.55, 0.3, 0.75, 0.45, 0.9, 0.35, 0.6].map((h, i) => (
                  <Skeleton key={i} width="9%" height={`${h * 100}%`} borderRadius={7} />
                ))}
              </View>
            ) : (
            <ChartBox height={CHART_HEIGHT}>
              {(width) => (
              <BarChart width={width} height={CHART_HEIGHT} data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={palette.border} vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: palette.muted, fontSize: 13, fontFamily: CHART_FONT }} />
                {/* Daily goal is the Y-axis ceiling; bars exceeding it cap at the top */}
                <YAxis
                  domain={[0, steps.dailyGoal]}
                  ticks={ticks}
                  allowDataOverflow
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: palette.muted, fontSize: 12, fontFamily: CHART_FONT }}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  formatter={(value, name, entry) => [entry?.payload?.hasData ? formatNumber(value) : "No data", perDay ? "Steps per day" : "Steps"]}
                  cursor={{ fill: palette.soft }}
                  contentStyle={{ fontFamily: CHART_FONT, borderRadius: 8, borderColor: palette.border, backgroundColor: palette.card, color: palette.text }}
                  // Explicitly style item and label text since recharts defaults them to black
                  itemStyle={{ color: palette.text }}
                  labelStyle={{ color: palette.text }}
                />
                <Bar dataKey="steps" radius={[7, 7, 0, 0]} maxBarSize={42}>
                  {data.map((item) => (
                    <Cell
                      key={item.key}
                      fill={!item.hasData ? palette.track : item.steps >= steps.dailyGoal ? shellColors.primary : colors.stepsInactiveFill}
                    />
                  ))}
                </Bar>
              </BarChart>
              )}
            </ChartBox>
            )}
          </View>
        </View>

        {/* Weekly challenge card beside the chart */}
        <View style={[styles.challengeCard, ch.card, narrow && styles.stackItem]}>
          <View style={[styles.challengeIcon, { backgroundColor: ch.icon }]}><Ionicons name="trophy" size={22} color="#f9c74f" /></View>
          <Text style={[styles.challengeKicker, { color: ch.accent }]}>WEEKLY CHALLENGE</Text>
          <Text style={[styles.challengeTitle, { color: ch.title }]}>Walk {formatNumber(CHALLENGE_TARGET)} steps</Text>
          <Text style={[styles.challengeCopy, { color: ch.copy }]}>
            {challengeRemaining > 0
              ? `You are ${formatNumber(challengeRemaining)} steps away. One short walk could get you there.`
              : "Challenge complete. Great work staying active this week!"}
          </Text>
          <View style={styles.challengeNumbers}>
            <Text style={[styles.challengeCurrent, { color: ch.title }]}>{formatNumber(challengeTotal)}</Text><Text style={[styles.challengeGoal, { color: ch.accent }]}> / {formatNumber(CHALLENGE_TARGET)}</Text>
          </View>
          <View style={[styles.challengeTrack, { backgroundColor: ch.track }]}><View style={[styles.challengeFill, { backgroundColor: ch.fill, width: `${Math.min((challengeTotal / CHALLENGE_TARGET) * 100, 100)}%` }]} /></View>
          <View style={styles.challengeFooter}>
            <Ionicons name="calendar-outline" size={15} color={ch.copy} /><Text style={[styles.challengeFooterText, { color: ch.copy }]}>This week</Text>
          </View>
        </View>
      </View>

      {/* Manual entry and daily goal cards side by side below the chart */}
      <View style={[styles.editRow, narrow && styles.stackRow]}>
        <TodayStepsCard
          todaySteps={steps.todaySteps}
          loading={first}
          onSaved={steps.refresh}
          onEdit={() => setEditing({ date: todayISO(), current: steps.todaySteps ?? 0 })}
          style={narrow ? styles.stackItem : styles.editItem}
        />
        <StepGoalCard goal={steps.dailyGoal} onSaved={steps.refresh} style={narrow ? styles.stackItem : styles.editItem} />
      </View>

      <RecentDaysCard
        steps={steps}
        palette={palette}
        loading={first}
        wide
        sourceLabel="From your phone"
        connected={connected}
        onEdit={(day) => setEditing({ date: day.activityDate, current: day.stepCount })}
        onHistory={() => router.push("/steps/history")}
        style={styles.recentSpacing}
      />

      <StepDayEditModal
        visible={Boolean(editing)}
        date={editing?.date}
        current={editing?.current}
        onClose={() => setEditing(null)}
        onSaved={steps.refresh}
      />
    </DashboardLayout>
  );
}

// `loading` swaps the value for a placeholder of the same height
function MetricCard({ icon, label, value, suffix, palette, loading = false }) {
  return <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
    <View style={[styles.metricIcon, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={19} color={shellColors.primary} /></View>
    <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
    <View style={styles.metricValueRow}>
      {loading ? <Skeleton width={80} height={27} /> : (
        <><Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text><Text style={[styles.metricSuffix, { color: palette.muted }]}>{suffix}</Text></>
      )}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  ...stepsStyles,

  pageHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  pageHeaderNarrow: { flexWrap: "wrap", alignItems: "flex-start" },
  // Shrinks to the row so the description wraps instead of running off
  headerCopy: { flexShrink: 1, minWidth: 0 },
  stackRow: { flexDirection: "column" },
  // Stacked (narrow) children size to their content instead of collapsing on flex: n
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.3 }, pageTitle: { marginTop: 2, fontSize: 24, fontWeight: "800" }, pageSubtitle: { marginTop: 4, fontSize: 14 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }, syncPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }, syncText: { color: "#4f7150", fontSize: 12, fontWeight: "700" },
  startButton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: shellColors.primary }, startButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, heroCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18 },
  stepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: shellColors.primary }, cardKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1 }, heroValue: { fontSize: 30, lineHeight: 34, fontWeight: "800" }, goalPercent: { color: shellColors.primary, fontSize: 20, fontWeight: "800" },
  goalTrack: { height: 9, borderRadius: 5, overflow: "hidden", marginTop: 17 }, goalFill: { height: 9, borderRadius: 5, backgroundColor: shellColors.primary }, goalCopy: { fontSize: 12, marginTop: 9 }, goalCopyStrong: { fontSize: 12, fontWeight: "700", marginTop: 9 },
  metricCard: { minWidth: 145, flex: 1, borderWidth: 1, borderRadius: radii.md, padding: 16 }, metricIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, metricLabel: { marginTop: 12, fontSize: 12, fontWeight: "700" }, metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 3 }, metricValue: { fontSize: 22, fontWeight: "800" }, metricSuffix: { fontSize: 12, fontWeight: "600" },
  contentRow: { flexDirection: "row", alignItems: "stretch", gap: 12, marginTop: 12 },
  editRow: { flexDirection: "row", alignItems: "stretch", gap: 12, marginTop: 12 },
  editItem: { flex: 1, minWidth: 0 }, chartCard: { minWidth: 280, flex: 2.2, borderWidth: 1, borderRadius: radii.md, padding: 18, flexDirection: "column" }, // Wraps the tabs under the title once the card is too narrow for both
  chartHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }, sectionTitle: { fontSize: 17, fontWeight: "800" }, sectionSubtitle: { marginTop: 3, fontSize: 12 },
  chartWrap: { height: CHART_HEIGHT, marginTop: 14 },
  chartSkeleton: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingLeft: 30 },
  goalCopySkeleton: { marginTop: 9 },
  challengeCard: { flex: 1, minWidth: 250, borderRadius: radii.md, padding: 20 }, challengeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }, challengeKicker: { marginTop: 28, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, challengeTitle: { marginTop: 5, fontSize: 21, fontWeight: "800" }, challengeCopy: { marginTop: 8, fontSize: 13, lineHeight: 17 },
  challengeNumbers: { flexDirection: "row", alignItems: "baseline", marginTop: 22 }, challengeCurrent: { fontSize: 19, fontWeight: "800" }, challengeGoal: { fontSize: 12, fontWeight: "600" }, challengeTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 8 }, challengeFill: { height: 8, borderRadius: 4 }, challengeFooter: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 13 }, challengeFooterText: { fontSize: 12, fontWeight: "600" },
  recentSpacing: { marginTop: 12 },
});
