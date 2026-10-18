import { DASH, MACRO_COLORS, MacroRow, pct, PlannedWorkouts } from "@/features/dashboard/components/DashboardWidgets";
import OnboardingPrompt from "@/features/onboarding/components/OnboardingPrompt";
import { useDashboard } from "@/features/progress/hooks/useProgress";
import { formatMl } from "@/features/water/components/WaterCards";
import { useWater } from "@/features/water/hooks/useWater";
import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import Skeleton from "@/shared/components/Skeleton";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DonutChart from "@/shared/components/charts/DonutChart";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ActionButton from "@/shared/components/ui/ActionButton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getChipTint, getScreenPalette, getScreenTones, radii, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { dashboardStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Today at a glance, all real data: /progress/today (useDashboard) for food,
// steps, the week, weight and streak; useWater and useWorkoutSessions for
// water and the weekly workout count. There is no calorie goal in the app,
// so calories show the amount eaten and the macro split, not a % of target


const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const MEAL_ICONS = { breakfast: "sunny-outline", lunch: "restaurant-outline", dinner: "moon-outline", snack: "cafe-outline" };

// A y-axis top a little above the highest point, in steps of `step`
const ceilTo = (n, step) => Math.max(step, Math.ceil(n / step) * step);

export default function DashboardScreen() {
  const dash = useDashboard();
  const v = dash.view;
  const { summary: workoutSummary } = useWorkoutSessions();
  // Real water log; the + button logs one 250 ml glass
  const water = useWater();
  const router = useRouter();

  const { width } = useWindowDimensions();
  const narrow = width < 980;
  const phone = width < 620;
  const { darkMode, shell: c } = useTheme();

  const { card, textColor } = getScreenPalette(darkMode);
  // Darker muted text than the shared tone, for readability on this screen in light mode
  const mutedText = { color: darkMode ? screenTones.dark.muted : "#4b5563" };
  const trackBg = { backgroundColor: card.borderColor }; // progress bar
  // Readable green text on white; the brand green is too light for it in light mode
  const accent = { color: c.activeNavText };
  // Stacked rows: items size to their content instead of collapsing under flex: 1
  const stack = (narrow && styles.stackItem);
  const stackPhone = (phone && styles.stackItem);
  const statCard = [styles.card, styles.statCard, narrow && styles.statCardNarrow, phone && styles.fullWidth, card];

  const stepGoal = v?.goals.dailySteps ?? 0;
  const calTop = ceilTo(Math.max(0, ...(v?.caloriesWeek.map((d) => d.value) || [0])), 500);
  const weights = v?.weightPoints.map((p) => p.value) || [];

  return (
    <DashboardLayout>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: c.sidebarText }]}>Dashboard</Text>
        <Text style={[styles.pageSubtitle, mutedText]}>Here&apos;s your overview for today.</Text>
      </View>
      <ScreenError message={dash.error} />
      {/* Onboarding: first visit goes there, then a banner until it's filled in */}
      <OnboardingPrompt darkMode={darkMode} />

      {/* Stats */}
      <View style={[styles.statsRow, narrow && styles.wrapRow]}>
        {/* Calories eaten today and the macros behind them */}
        <Pressable onPress={() => router.push("/food-scanner")} style={statCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, textColor]}>Today&apos;s Calories</Text>
            <Text style={[styles.pctGreen, accent]}>{v ? `${v.mealsLogged}/4 meals` : DASH}</Text>
          </View>
          <View style={styles.mt2}>
            <Text style={[styles.bigNum, textColor]}>
              {v ? v.nutrition.caloriesKcal.toLocaleString() : DASH}
              <Text style={[styles.kcalSuffix, mutedText]}>{v?.goalKcal ? ` / ${v.goalKcal.toLocaleString()} kcal` : " kcal"}</Text>
            </Text>
          </View>
          <MacroRow macros={v?.macros} darkMode={darkMode} small />
        </Pressable>

        {/* Hydration: tap the card for the Water page, "1 glass" logs one */}
        <Pressable onPress={() => router.push("/water")} style={statCard}>
          <View style={styles.rowGap}>
            <Ionicons name="water" size={20} color={chipTints.blue.icon} />
            <Text style={[styles.cardLabel, textColor]}>Hydration</Text>
          </View>
          {/* Placeholders until the water log arrives, like the phone's card */}
          <View style={styles.mt4}>
            {water.loading ? <Skeleton width={130} height={28} /> : (
              <Text style={[styles.midNum, textColor]}>
                {formatMl(water.totalMl)}
                <Text style={[styles.lSuffix, mutedText]}> / {formatMl(water.goalMl)}</Text>
              </Text>
            )}
          </View>
          {water.loading ? <Skeleton width={190} height={12} style={styles.waterLineSkeleton} /> : (
            <Text style={[styles.smallMuted, mutedText]}>
              {Math.round(water.progress * 100)}% of daily goal · {Number(water.glasses.toFixed(1))} of {water.goalGlasses} glasses
            </Text>
          )}
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${water.progress * 100}%`, backgroundColor: "#155dfc" }]} />
          </View>
          {/* Labelled, same as the phone's card */}
          <View style={styles.waterAction}>
            <ActionButton
              compact
              label="1 glass"
              loading={water.saving}
              disabled={water.loading || !water.canAdd()}
              onPress={() => water.addWater()}
              darkMode={darkMode}
            />
          </View>
        </Pressable>

        {/* Steps against the daily goal */}
        <Pressable onPress={() => router.push("/steps")} style={statCard}>
          <View style={styles.rowGap}>
            <Ionicons name="footsteps" size={21} color={colors.green600} />
            <Text style={[styles.cardLabel, textColor]}>Steps</Text>
          </View>
          <View style={styles.mt5}>
            <Text style={[styles.midNum, textColor]}>
              {v ? v.steps.toLocaleString() : DASH}
              <Text style={[styles.lSuffix, mutedText]}> / {stepGoal.toLocaleString()}</Text>
            </Text>
          </View>
          <Text style={[styles.smallMuted, mutedText]}>{v ? `${pct(v.steps, stepGoal)}% of daily goal` : DASH}</Text>
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${v ? pct(v.steps, stepGoal) : 0}%`, backgroundColor: shellColors.primary }]} />
          </View>
        </Pressable>

        {/* Streak: the same count as the Progress tile and the streak notifications */}
        <Pressable onPress={() => router.push("/progress")} style={statCard}>
          <View style={styles.rowGap}>
            <Ionicons name="trophy" size={20} color={chipTints.orange.icon} />
            <Text style={[styles.cardLabel, textColor]}>Streak</Text>
          </View>
          <View style={styles.mt5}>
            <Text style={[styles.midNum, textColor]}>
              {v ? v.streak.days : DASH}
              <Text style={[styles.lSuffix, mutedText]}> {v?.streak.days === 1 ? "day" : "days"}</Text>
            </Text>
          </View>
          <Text style={[styles.smallMuted, mutedText]}>
            {!v ? DASH : v.streak.loggedToday ? "Logged today" : v.streak.days ? "Log today to keep it" : "Log anything to start one"}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.lowerRow, narrow && styles.stackRow]}>
        {/* Today's Plan: what's been eaten, and the next workout */}
        <View style={[styles.card, card, styles.flexHalf, stack]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, textColor]}>Today&apos;s Plan</Text>
            <Pressable onPress={() => router.push("/workouts")}>
              <Text style={[styles.viewAll, accent]}>View All</Text>
            </Pressable>
          </View>

          <Text style={[styles.subheading, textColor, narrow && styles.planHeading]}>Meals</Text>
          <View style={[styles.mealsRow, phone && styles.wrapRow, narrow && styles.mealsRowNarrow]}>
            {(v?.meals || Object.keys(MEAL_LABELS).map((t) => ({ mealType: t, count: 0 }))).map((m) => (
              <Pressable
                key={m.mealType}
                onPress={() => router.push("/food-scanner")}
                style={[styles.mealCard, phone && styles.mealCardPhone, { borderColor: card.borderColor }]}
              >
                <View style={[styles.mealIconBox, trackBg]}>
                  <Ionicons name={MEAL_ICONS[m.mealType]} size={22} color={m.count ? shellColors.primary : colors.textMuted} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={[styles.mealTitle, textColor]}>{MEAL_LABELS[m.mealType]}</Text>
                  {/* Placeholder until today's meals arrive, not a premature "Not logged" */}
                  {v ? (
                    <Text style={[styles.mealCalories, mutedText]}>{m.count ? `${m.caloriesKcal} kcal` : "Not logged"}</Text>
                  ) : (
                    <Skeleton width="60%" height={9} style={styles.mealSkeleton} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.subheading, textColor, { marginTop: narrow ? 20 : 12 }]}>Workout</Text>
          {/* The next few planned sessions, missed first, then the week's count */}
          <View style={styles.mt2}>
            <PlannedWorkouts view={v} summary={workoutSummary} darkMode={darkMode} onOpen={() => router.push("/workouts?tab=upcoming")} />
          </View>
        </View>

        {/* Insights */}
        <View style={[styles.flexHalf, stack]}>
          <View style={[styles.card, card]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, textColor]}>Insights</Text>
              <Text style={[styles.thisWeek, mutedText]}>Last 7 days</Text>
            </View>

            <View style={[styles.chartBox, { borderColor: card.borderColor }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.chartLabel, textColor]}>Calories Trend</Text>
                <Text style={[styles.chartAvg, mutedText]}>{v?.caloriesAverage ? `Average: ${v.caloriesAverage} kcal` : "No meals logged"}</Text>
              </View>
              <View style={{ marginTop: 4 }}>
                <AreaChartMini
                  data={v?.caloriesWeek || []}
                  height={145}
                  stroke={chipTints.orange.icon}
                  fill={getChipTint("orange", darkMode).backgroundColor}
                  yMin={0}
                  yMax={calTop}
                  yTicks={[0, calTop / 3, (calTop * 2) / 3, calTop].map(Math.round)}
                  yTickFormat={(t) => (t >= 1000 ? `${Math.round(t / 100) / 10}k` : String(t))}
                  name="Calories"
                  unit="kcal"
                />
              </View>
            </View>
          </View>

          <View style={[styles.insightCardsRow, phone && styles.stackRow]}>
            {/* Today's macro split, by calories */}
            <View style={[styles.card, card, styles.flexHalf, styles.insightCard, stackPhone]}>
              <Text style={[styles.chartLabel, textColor]}>Macronutrient Distribution</Text>
              <View style={styles.donutWrap}>
                <DonutChart
                  size={96}
                  strokeWidth={15}
                  centerBg={getScreenTones(darkMode).card}
                  segments={(v?.macros || []).map((m) => ({ value: m.percent, color: MACRO_COLORS[m.key] }))}
                >
                  <Text style={[styles.donutCenterTitle, textColor]}>Today</Text>
                  <Text style={[styles.donutCenterSub, mutedText]}>{v ? `${v.nutrition.caloriesKcal} kcal` : DASH}</Text>
                </DonutChart>
              </View>
              <View style={styles.legend}>
                {(v?.macros || []).map((m) => (
                  <LegendRow key={m.key} color={MACRO_COLORS[m.key]} label={m.label} value={v.hasMacros ? `${m.percent}%` : DASH} textColor={textColor} />
                ))}
              </View>
            </View>

            {/* Weight over the last 30 days */}
            <Pressable onPress={() => router.push("/progress")} style={[styles.card, card, styles.flexHalf, styles.insightCard, stackPhone]}>
              <Text style={[styles.chartLabel, textColor]}>Weight Progress</Text>
              <View style={styles.mt3}>
                <Text style={[styles.weightNum, textColor]}>
                  {v?.weight.currentKg != null ? `${v.weight.currentKg} kg` : "No weight logged"}
                </Text>
                {v?.weight.changeKg != null && (
                  <Text style={[styles.weightDelta, v.weight.changeKg > 0 && { color: chipTints.orange.icon }]}>
                    {" "}{v.weight.changeKg > 0 ? "\u25B2" : v.weight.changeKg < 0 ? "\u25BC" : ""} {Math.abs(v.weight.changeKg)} kg
                  </Text>
                )}
              </View>
              <Text style={[styles.weightSince, mutedText]}>Last 30 days</Text>
              {weights.length > 1 && (
                <View style={{ marginTop: 16 }}>
                  <AreaChartMini
                    data={v.weightPoints}
                    height={64}
                    stroke={shellColors.primary}
                    fill={shellColors.light.activeNavBg}
                    yMin={Math.floor(Math.min(...weights) - 1)}
                    yMax={Math.ceil(Math.max(...weights) + 1)}
                    showXLabels
                    dotRadius={2}
                    name="Weight"
                    unit="kg"
                  />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </DashboardLayout>
  );
}

function LegendRow({ color, label, value, textColor }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLeft}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={[styles.legendLabel, textColor]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.legendValue, textColor]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 13 },
  errorText: { fontSize: 12, fontWeight: "600", color: "#dc2626", marginBottom: 12 },
  ...dashboardStyles,

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 12 },
  statCard: { flex: 1},
  statCardNarrow: { minWidth: 220 },
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  fullWidth: { width: "100%", minWidth: 0, flexBasis: "auto", boxSizing: "border-box" },
  wrapRow: { flexWrap: "wrap" },
  flex1: { flex: 1 },
  flexHalf: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  mt2: { marginTop: 8 },
  mt3: { marginTop: 12 },
  mt4: { marginTop: 16 },
  mt5: { marginTop: 20 },

  cardLabel: { fontSize: 12, fontWeight: "600" },
  pctGreen: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  bigNum: { fontSize: 20, fontWeight: "700" },
  midNum: { fontSize: 24, fontWeight: "700" },
  kcalSuffix: { fontSize: 13, fontWeight: "500" },
  lSuffix: { fontSize: 13, fontWeight: "500" },
  smallMuted: { fontSize: 12, fontWeight: "600", marginTop: 4 },

  progressTrack: { marginTop: 8, height: 8, borderRadius: 4, overflow: "hidden" },

  statsRow: { flexDirection: "row", gap: 12 },

  waterAction: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  waterLineSkeleton: { marginTop: 6 },

  // marginBottom keeps the last card clear of the page edge when stacked
  lowerRow: { flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  subheading: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  thisWeek: { fontSize: 10, fontWeight: "600", color: colors.textMuted },

  mealsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  // Small screens: more air between the heading, the meal cards and the workout list
  mealsRowNarrow: { gap: 10, marginTop: 10 },
  planHeading: { marginTop: 12 },
  mealCard: { flex: 1, borderRadius: 6, borderWidth: 1, overflow: "hidden" },
  mealCardPhone: { minWidth: "47%" },
  mealIconBox: { height: 64, alignItems: "center", justifyContent: "center" },
  mealInfo: { padding: 6, gap: 2 },
  mealTitle: { fontSize: 10, fontWeight: "700" },
  mealCalories: { fontSize: 8, color: colors.textMuted },
  mealSkeleton: { marginTop: 2 },



  chartBox: { marginTop: 12, borderRadius: 6, borderWidth: 1, padding: 8 },
  chartLabel: { fontSize: 10, fontWeight: "600" },
  chartAvg: { fontSize: 9, fontWeight: "600", color: colors.textMuted },

  insightCardsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  // minWidth 0 + overflow: the donut and legend can't spill past the card edge
  insightCard: { minWidth: 0, overflow: "hidden" },
  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 12 },
  donutCenterTitle: { fontSize: 9, fontWeight: "700" },
  donutCenterSub: { fontSize: 8, color: colors.textMuted },

  legend: { marginTop: 12, gap: 4 },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 8 },
  legendValue: { fontSize: 8, fontWeight: "600" },

  weightNum: { fontSize: 13, fontWeight: "700" },
  weightDelta: { fontSize: 9, fontWeight: "600", color: colors.green600 },
  weightSince: { fontSize: 8, color: colors.textMuted, marginTop: 4 },
});