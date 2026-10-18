import { TargetWeightModal } from "@/features/progress/components/TargetWeightFields";
import { PERIODS, periodTitle } from "@/features/progress/hooks/useProgress";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DonutChart from "@/shared/components/charts/DonutChart";
import Skeleton from "@/shared/components/Skeleton";
import { paceLabel } from "@/shared/constants/goalOptions";
import { goalValueToLabel } from "@/shared/constants/profileOptions";
import { chipTints, colors, getChipTint, getScreenPalette, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { formatNumber } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The Progress page's cards, shared by the native and web screens. Each one
 * takes the useProgress() result as `progress`. While nothing has loaded yet
 * (`progress.loaded` false) they render at their real size with placeholders
 * where the values go; after that a period switch keeps the old numbers up
 * and the period bar shows a small spinner instead
 */

const MACRO_COLORS = { protein: shellColors.primary, carbs: chipTints.blue.icon, fat: chipTints.orange.icon };

// Round a chart's top up to a tidy number, so the four gridlines land on
// readable values (2,400 rather than 2,317)
function niceMax(value) {
  if (value <= 0) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  const tidy = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * step >= value);
  return tidy * step;
}
const compactNumber = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));
// Labels a chart should print, blanks for the rest
const chartData = (rows) => rows.map((r) => ({ label: r.tick ? r.label : "", value: r.value }));

function CardTitle({ title, right, textColor }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.cardTitle, textColor]}>{title}</Text>
      {right}
    </View>
  );
}

/* ----------------------------- Period bar ----------------------------- */

export function PeriodBar({ progress, darkMode, style }) {
  const { textColor } = getScreenPalette(darkMode);
  const tone = getScreenTones(darkMode);
  const { period, setPeriod, offset, older, newer, canGoNewer, view, loaded, loading } = progress;

  return (
    <View style={style}>
      <View style={[styles.tabTrack, { backgroundColor: tone.surfaceMuted }]}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[styles.tabBtn, active && styles.tabBtnActive]}>
              <Text style={[styles.tabText, active ? styles.tabTextActive : { color: tone.muted }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.rowBetween, styles.rangeRow]}>
        <View style={styles.flex1}>
          <View style={styles.titleRow}>
            {/* The title only needs the period, so it never waits on the request */}
            <Text style={[styles.rangeTitle, textColor]}>{periodTitle(period, offset)}</Text>
            {loaded && loading && <ActivityIndicator size="small" color={shellColors.primary} />}
          </View>
          {loaded ? (
            <Text style={styles.rangeText}>{view.range}</Text>
          ) : (
            <Skeleton width={150} height={12} style={styles.rangeSkeleton} />
          )}
        </View>

        <View style={styles.arrows}>
          <Pressable onPress={older} style={[styles.arrowBtn, { backgroundColor: tone.surfaceMuted }]} accessibilityLabel="Previous period" hitSlop={6}>
            <Ionicons name="chevron-back" size={16} color={textColor.color} />
          </Pressable>
          <Pressable
            onPress={newer}
            disabled={!canGoNewer}
            style={[styles.arrowBtn, { backgroundColor: tone.surfaceMuted }, !canGoNewer && styles.disabled]}
            accessibilityLabel="Next period"
            hitSlop={6}
          >
            <Ionicons name="chevron-forward" size={16} color={textColor.color} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ---------------------------- Summary cards ---------------------------- */

function summaryCards(view) {
  if (!view) return [
    { key: "calories", title: "Calories", icon: "flame", tint: "orange" },
    { key: "workouts", title: "Workouts", icon: "barbell", tint: "blue" },
    { key: "steps", title: "Steps", icon: "footsteps", tint: "purple" },
    { key: "streak", title: "Streak", icon: "trophy", tint: "green" },
  ];
  const { totals, targets, streak } = view;
  return [
    {
      key: "calories", title: "Calories", icon: "flame", tint: "orange",
      value: formatNumber(totals.caloriesKcal), unit: "kcal",
      note: `Avg ${formatNumber(view.caloriesAverage)} per logged day`,
    },
    {
      key: "workouts", title: "Workouts", icon: "barbell", tint: "blue",
      value: String(totals.workouts), unit: "done",
      note: "Completed workouts",
    },
    {
      key: "steps", title: "Steps", icon: "footsteps", tint: "purple",
      value: formatNumber(totals.steps), unit: "steps",
      note: `Goal: ${formatNumber(targets.steps)}`,
    },
    {
      // Counts back from today whatever period is open
      key: "streak", title: "Streak", icon: "trophy", tint: "green",
      value: String(streak.days), unit: streak.days === 1 ? "day" : "days",
      note: streak.loggedToday ? "Logged today" : streak.days ? "Log today to keep it" : "Log anything to start one",
    },
  ];
}

export function SummaryCards({ progress, darkMode, wide = false, style }) {
  const { textColor } = getScreenPalette(darkMode);
  const loading = !progress.loaded;

  return (
    <View style={[styles.summaryGrid, style]}>
      {summaryCards(progress.view).map((item) => {
        const tint = getChipTint(item.tint, darkMode);
        return (
          <View key={item.key} style={[styles.summaryCard, wide ? styles.summaryCardWide : styles.summaryCardHalf, { backgroundColor: tint.backgroundColor }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.summaryTitle, { color: tint.icon }]}>{item.title}</Text>
              <Ionicons name={item.icon} size={16} color={tint.icon} />
            </View>
            {loading ? (
              <>
                <Skeleton width="60%" height={22} style={styles.summaryValueSkeleton} />
                <Skeleton width="45%" height={10} style={styles.summaryNoteSkeleton} />
              </>
            ) : (
              <>
                <Text style={[styles.summaryValue, textColor]} numberOfLines={1}>
                  {item.value}
                  <Text style={styles.summaryUnit}> {item.unit}</Text>
                </Text>
                <Text style={styles.summaryNote} numberOfLines={1}>{item.note}</Text>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ----------------------------- Calories ----------------------------- */

export function CaloriesCard({ progress, darkMode, chartHeight = 180, style }) {
  const { card, textColor } = getScreenPalette(darkMode);
  const { view, loaded } = progress;
  const tint = getChipTint("orange", darkMode);

  let body;
  if (!loaded) {
    body = <Skeleton width="100%" height={chartHeight} />;
  } else if (!view.calories.some((p) => p.value > 0)) {
    body = <EmptyNote height={chartHeight} icon="restaurant-outline" text="No meals logged in this period yet." />;
  } else {
    const peak = Math.max(...view.calories.map((p) => p.value));
    const top = niceMax(peak);
    body = (
      <AreaChartMini
        data={chartData(view.calories)}
        height={chartHeight}
        stroke={tint.icon}
        fill={tint.backgroundColor}
        yMin={0}
        yMax={top}
        yTicks={[0, top / 4, top / 2, (top * 3) / 4, top]}
        yTickFormat={compactNumber}
        dotRadius={view.calories.length > 14 ? 0 : 3}
        name="Calories"
        unit="kcal"
      />
    );
  }

  return (
    <View style={[styles.card, card, style]}>
      <CardTitle
        title="Calories"
        textColor={textColor}
        right={loaded ? (
          <Text style={styles.mutedSmall}>Avg {formatNumber(view.caloriesAverage)} kcal/day</Text>
        ) : <Skeleton width={110} height={11} />}
      />
      {loaded ? (
        <Text style={styles.cardSubtitle}>{view.perDay ? "Average per logged day" : "Eaten per day"}</Text>
      ) : (
        <Skeleton width={140} height={10} style={styles.subtitleSkeleton} />
      )}
      <View style={styles.chartWrap}>{body}</View>
    </View>
  );
}

/* ------------------------------ Macros ------------------------------ */

export function MacrosCard({ progress, darkMode, style }) {
  const { card, textColor } = getScreenPalette(darkMode);
  const { view, loaded } = progress;
  const rows = view?.macros || [{ key: "protein", label: "Protein" }, { key: "carbs", label: "Carbs" }, { key: "fat", label: "Fat" }];

  return (
    <View style={[styles.card, card, style]}>
      <CardTitle title="Macros" textColor={textColor} />
      <Text style={styles.cardSubtitle}>Share of calories</Text>

      <View style={styles.donutWrap}>
        {!loaded ? (
          <Skeleton width={96} height={96} borderRadius={48} />
        ) : (
          <DonutChart
            size={96}
            strokeWidth={15}
            centerBg={card.backgroundColor}
            // Empty period: a plain gray ring rather than nothing
            segments={view.hasMacros
              ? view.macros.map((m) => ({ value: m.percent, color: MACRO_COLORS[m.key] }))
              : [{ value: 1, color: card.borderColor }]}
          />
        )}
      </View>

      <View style={styles.legend}>
        {rows.map((m) => (
          <View key={m.key} style={styles.rowBetween}>
            <View style={styles.legendLeft}>
              <View style={[styles.legendDot, { backgroundColor: MACRO_COLORS[m.key] }]} />
              <Text style={[styles.legendLabel, textColor]}>{m.label}</Text>
            </View>
            {loaded ? (
              <View style={styles.alignRight}>
                <Text style={[styles.legendValue, textColor]}>{m.percent}%</Text>
                <Text style={styles.legendGrams}>{formatNumber(Math.round(m.grams))} g</Text>
              </View>
            ) : (
              <Skeleton width={36} height={22} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------ Weight ------------------------------ */

const TREND_STATUS = { ahead: "Ahead of pace", on_track: "On track", behind: "Behind pace" };

// The smoothed weight with its weekly rate, then where that leaves the target.
// A very fast change gets a neutral note, never a status
function trendLines(trend, hasTarget) {
  const rate = trend.weeklyRateKg;
  const lines = [`Trend ${trend.trendKg} kg · ${Math.abs(rate) < 0.05 ? "steady" : `${rate < 0 ? "▼" : "▲"} ${Math.abs(rate)} kg / week`}`];
  if (trend.fast) lines.push("Your weight is changing quickly. It may be worth checking in with a doctor or dietitian.");
  // Reached shows even next to the quick-change note, the note stays first
  if (trend.reached) lines.push("You're at your target weight.");
  else if (!trend.fast) {
    if (trend.status) lines.push(`${TREND_STATUS[trend.status]}${trend.projectedLabel ? ` · target around ${trend.projectedLabel}` : ""}`);
    else if (hasTarget && !trend.projectedLabel) lines.push("Not trending towards your target yet.");
    else if (trend.projectedLabel) lines.push(`Target around ${trend.projectedLabel}`);
  }
  return lines;
}

export function WeightCard({ progress, darkMode, chartHeight = 120, style }) {
  const { card, textColor } = getScreenPalette(darkMode);
  const { view, loaded } = progress;
  const weight = view?.weight;
  const [editingTarget, setEditingTarget] = useState(false);
  // "Target 70 kg · 0.5 kg / week", or "" when neither is set
  const targetText = [
    view?.goals.targetWeightKg != null && `Target ${view.goals.targetWeightKg} kg`,
    paceLabel(view?.goals.weeklyPaceKg),
  ].filter(Boolean).join(" · ");

  let body;
  if (!loaded) {
    body = <Skeleton width="100%" height={chartHeight} />;
  } else if (view.weightPoints.length >= 2) {
    const values = view.weightPoints.map((p) => p.value);
    const low = Math.floor(Math.min(...values) - 1);
    const high = Math.ceil(Math.max(...values) + 1);
    body = (
      <AreaChartMini
        data={view.weightPoints}
        height={chartHeight}
        stroke={shellColors.primary}
        fill={getChipTint("green", darkMode).backgroundColor}
        yMin={low}
        yMax={high}
        yTicks={[low, Math.round((low + high) / 2), high]}
        showXLabels={view.weightPoints.length <= 8}
        dotRadius={3}
        name="Weight"
        unit="kg"
      />
    );
  } else {
    // Weight is logged by updating it in Profile, so that's where to send them
    const text = weight.currentKg === null
      ? "Add your weight in Profile to track it here."
      : view.weightPoints.length === 1
        ? "One weigh-in this period. Update it in Profile again to see a trend."
        : "No weigh-ins this period. Update your weight in Profile to log one.";
    body = <EmptyNote height={chartHeight} icon="scale-outline" text={text} />;
  }

  // Lost or gained, without calling either good: that depends on the goal
  const change = weight?.changeKg;
  const changeText = change === null || change === undefined
    ? "No change logged this period"
    : change === 0 ? "No change this period" : `${change < 0 ? "▼" : "▲"} ${Math.abs(change)} kg this period`;

  return (
    <View style={[styles.card, card, style]}>
      <CardTitle title="Weight" textColor={textColor} />
      {/* Stacked rather than side by side, so a half-width phone card has room */}
      <View style={styles.weightRow}>
        {loaded ? (
          <Text style={[styles.bigNum, textColor]}>{weight.currentKg === null ? "—" : `${weight.currentKg} kg`}</Text>
        ) : <Skeleton width={70} height={22} />}
        {loaded ? (
          <Text style={[styles.weightChange, textColor]} numberOfLines={1}>{changeText}</Text>
        ) : <Skeleton width={110} height={12} style={styles.weightChangeSkeleton} />}
      </View>

      {/* Target weight and pace, changed right here */}
      {loaded && (
        <Pressable
          onPress={() => setEditingTarget(true)}
          accessibilityRole="button"
          accessibilityLabel={targetText ? `Weight target: ${targetText}. Edit` : "Set a weight target"}
          style={[styles.targetRow, { backgroundColor: getChipTint("green", darkMode).backgroundColor }]}
        >
          <Ionicons name="flag-outline" size={14} color={shellColors.primary} />
          <Text style={[styles.targetText, textColor]} numberOfLines={1}>{targetText || "No target set"}</Text>
          <Text style={styles.targetAction}>{targetText ? "Edit" : "Set target"}</Text>
        </Pressable>
      )}

      {/* Smoothed trend and projection, once there are enough weigh-ins */}
      {loaded && view.weightTrend && trendLines(view.weightTrend, view.goals.targetWeightKg != null).map((line, i) => (
        <Text key={i} style={[styles.trendText, textColor]}>{line}</Text>
      ))}

      <View style={styles.chartWrap}>{body}</View>

      <TargetWeightModal
        visible={editingTarget}
        goals={view?.goals}
        currentKg={weight?.currentKg}
        onClose={() => setEditingTarget(false)}
        onSaved={progress.reload}
        darkMode={darkMode}
      />
    </View>
  );
}

/* ----------------------------- Workouts ----------------------------- */

export function WorkoutsCard({ progress, darkMode, chartHeight = 120, style }) {
  const { card, textColor } = getScreenPalette(darkMode);
  const tone = getScreenTones(darkMode);
  const { view, loaded } = progress;
  const bars = view?.workouts || [];
  const peak = Math.max(1, ...bars.map((b) => b.value));


  return (
    <View style={[styles.card, card, style]}>
      <CardTitle title="Workouts" textColor={textColor} right={<Ionicons name="barbell" size={18} color={shellColors.primary} />} />
      <Text style={styles.cardSubtitle}>Completed workouts</Text>

      {/* At least chartHeight; grows when the row stretches the card */}
      <View style={[styles.chartWrap, styles.grow, { minHeight: chartHeight }]}>
        {!loaded ? (
          <Skeleton width="100%" height={chartHeight} />
        ) : !bars.some((b) => b.value > 0) ? (
          <EmptyNote height={chartHeight} icon="barbell-outline" text="No workouts completed in this period yet." />
        ) : (
          <View style={styles.bars}>
            {bars.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>{b.value > 0 ? b.value : ""}</Text>
                <View style={[styles.barTrack, { backgroundColor: tone.surfaceMuted }]}>
                  <View style={[styles.barFill, { height: `${(b.value / peak) * 100}%` }]} />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>{b.tick ? b.label : ""}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

    </View>
  );
}

/* -------------------------------- Goal -------------------------------- */

// The fitness goal from registration or Profile. Stored as a slug
// ("gain-weight"), shown with the same label Profile uses ("Gain Weight");
// a custom goal is shown as typed
export function GoalCard({ progress, darkMode, style }) {
  const { card, textColor } = getScreenPalette(darkMode);
  const { view, loaded } = progress;
  const goal = goalValueToLabel(view?.goals.fitnessGoal);

  return (
    <View style={[styles.card, card, styles.goalRow, style]}>
      <View style={[styles.goalIcon, { backgroundColor: getChipTint("green", darkMode).backgroundColor }]}>
        <Ionicons name="locate" size={20} color={shellColors.primary} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.mutedSmall}>Your goal</Text>
        {loaded ? (
          <Text style={[styles.goalTitle, textColor]} numberOfLines={2}>{goal || "Not set yet, add one in Profile"}</Text>
        ) : <Skeleton width={120} height={16} style={styles.goalSkeleton} />}
      </View>
    </View>
  );
}

function EmptyNote({ height, icon, text }) {
  return (
    <View style={[styles.empty, { height }]}>
      <Ionicons name={icon} size={22} color={colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alignRight: { alignItems: "flex-end" },
  disabled: { opacity: 0.4 },

  // Period bar
  tabTrack: { flexDirection: "row", borderRadius: radii.pill, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  tabBtnActive: { backgroundColor: shellColors.primary },
  tabText: { fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.white },
  rangeRow: { marginTop: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rangeTitle: { fontSize: 17, fontWeight: "700" },
  rangeText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rangeSkeleton: { marginTop: 4 },
  arrows: { flexDirection: "row", gap: 8 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Summary
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { borderRadius: radii.sm, padding: 12 },
  summaryCardHalf: { width: "48%", flexGrow: 1 },
  summaryCardWide: { flexGrow: 1, flexBasis: 180, minWidth: 160 },
  summaryTitle: { fontSize: 13, fontWeight: "700" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginTop: 10 },
  summaryUnit: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  summaryNote: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  summaryValueSkeleton: { marginTop: 10 },
  summaryNoteSkeleton: { marginTop: 6 },

  // Cards
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  subtitleSkeleton: { marginTop: 4 },
  mutedSmall: { fontSize: 11, color: colors.textMuted },
  chartWrap: { marginTop: 12 },
  grow: { flexGrow: 1 },

  // Macros
  // Takes the card's spare height, so a stretched card centres the ring
  donutWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", marginTop: 12 },
  legend: { marginTop: 12, gap: 8 },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: "600" },
  legendValue: { fontSize: 12, fontWeight: "700" },
  legendGrams: { fontSize: 10, color: colors.textMuted },

  // Weight
  weightRow: { marginTop: 10 },
  bigNum: { fontSize: 20, fontWeight: "800" },
  weightChange: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  weightChangeSkeleton: { marginTop: 4 },
  trendText: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8 },
  targetText: { flex: 1, fontSize: 12, fontWeight: "600" },
  targetAction: { fontSize: 12, fontWeight: "800", color: shellColors.primary },

  // Workouts
  bars: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barCol: { flex: 1, height: "100%", alignItems: "center" },
  barValue: { fontSize: 9, fontWeight: "700", color: shellColors.primary, height: 12 },
  barTrack: { flex: 1, width: "70%", maxWidth: 22, borderRadius: 4, justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4, backgroundColor: shellColors.primary },
  barLabel: { fontSize: 9, color: colors.textMuted, marginTop: 4, height: 12 },
  goalTitle: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  goalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  goalSkeleton: { marginTop: 3 },

  empty: { alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16 },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
});