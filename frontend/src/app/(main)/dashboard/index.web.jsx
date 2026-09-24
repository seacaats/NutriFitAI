import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DonutChart from "@/shared/components/charts/DonutChart";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getScreenPalette, getScreenTones, radii, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { dashboardStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";


const CALORIE_DATA = [
  { label: "Mon", value: 1550 },
  { label: "Tue", value: 1720 },
  { label: "Wed", value: 1600 },
  { label: "Thu", value: 1710 },
  { label: "Fri", value: 1450 },
  { label: "Sat", value: 1900 },
  { label: "Sun", value: 1550 },
];

const WEIGHT_DATA = [
  { label: "W1", value: 72.5 },
  { label: "W2", value: 72 },
  { label: "W3", value: 71.2 },
  { label: "W4", value: 70.8 },
  { label: "W5", value: 70 },
];

const TARGETS = { calories: 2200, waterL: 2.5, steps: 10000 };
const TOTALS = { calories: 1850, steps: 7842 };
const pct = (value, target) => Math.round((value / target) * 100);

const MEALS = [
  { title: "Breakfast", calories: "420 kcal" },
  { title: "Lunch", calories: "620 kcal" },
  { title: "Dinner", calories: "560 kcal" },
  { title: "Snack", calories: "250 kcal" },
];

export default function DashboardScreen() {
  const { summary: workoutSummary } = useWorkoutSessions();

  const { width } = useWindowDimensions();
  const narrow = width < 980;
  const phone = width < 620;
  const { darkMode } = useTheme();
  const [water, setWater] = useState(1.8);
  const [workoutStarted, setWorkoutStarted] = useState(false);

  const { card, textColor, mutedText } = getScreenPalette(darkMode);
  const trackBg = { backgroundColor: card.borderColor }; // progress bar

  const addWater = () => setWater((cur) => Math.min(Number((cur + 0.25).toFixed(2)), 2.5));

  const startWorkout = () => {
    setWorkoutStarted(true);
    setTimeout(() => setWorkoutStarted(false), 2500);
  };

  return (
    <DashboardLayout>
      {/* Stats */}
      <View style={[styles.statsRow, narrow && styles.wrapRow]}>
        {/* Daily Calories */}
        <View style={[styles.card, styles.statCard, narrow && styles.statCardNarrow, phone && styles.fullWidth, card]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, textColor]}>Daily Calories</Text>
            <Text style={styles.pctGreen}>{pct(TOTALS.calories, TARGETS.calories)}%</Text>
          </View>
          <View style={styles.mt2}>
            <Text style={[styles.bigNum, textColor]}>
              {TOTALS.calories}
              <Text style={[styles.kcalSuffix, mutedText]}> /{TARGETS.calories} kcal</Text>
            </Text>
          </View>
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${pct(TOTALS.calories, TARGETS.calories)}%`, backgroundColor: colors.calorieProgressFill }]} />
          </View>
          <View style={styles.macroRow}>
            <Macro name="Protein" value="79/120g" dark={darkMode} />
            <Macro name="Carbs" value="165/250g" dark={darkMode} />
            <Macro name="Fat" value="45/70g" dark={darkMode} />
          </View>
        </View>

        {/* Hydration */}
        <View style={[styles.card, styles.statCard, narrow && styles.statCardNarrow, phone && styles.fullWidth, card]}>
          <View style={styles.rowGap}>
            <Ionicons name="water" size={20} color={chipTints.blue.icon} />
            <Text style={[styles.cardLabel, textColor]}>Hydration</Text>
          </View>
          <View style={styles.mt4}>
            <Text style={[styles.midNum, textColor]}>
              {water}
              <Text style={[styles.lSuffix, mutedText]}> / 2.5 L</Text>
            </Text>
          </View>
          <Text style={[styles.smallMuted, mutedText]}>{Math.round((water / 2.5) * 100)}% of daily goal</Text>
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${(water / 2.5) * 100}%`, backgroundColor: "#155dfc" }]} />
          </View>
          <Pressable onPress={addWater} disabled={water >= 2.5} style={[styles.addWaterBtn, { borderColor: card.borderColor, opacity: water >= 2.5 ? 0.4 : 1 }]}>
            <Ionicons name="add" size={15} color={darkMode ? colors.white : screenTones.light.text} />
          </Pressable>
        </View>

        {/* Steps */}
        <View style={[styles.card, styles.statCard, narrow && styles.statCardNarrow, phone && styles.fullWidth, card]}>
          <View style={styles.rowGap}>
            <Ionicons name="footsteps" size={21} color={colors.green600} />
            <Text style={[styles.cardLabel, textColor]}>Steps</Text>
          </View>
          <View style={styles.mt5}>
            <Text style={[styles.midNum, textColor]}>
              {TOTALS.steps.toLocaleString()}
              <Text style={[styles.lSuffix, mutedText]}> / {TARGETS.steps.toLocaleString()}</Text>
              </Text>
          </View>
          <Text style={[styles.smallMuted, mutedText]}>{pct(TOTALS.steps, TARGETS.steps)}% of daily goal</Text>
          <View style={[styles.progressTrack, trackBg]}>
            <View style={[styles.progressFill, { width: `${pct(TOTALS.steps, TARGETS.steps)}%`, backgroundColor: shellColors.primary }]} />
          </View>
        </View>
      </View>

      {/* Today's Plan */}
      <View style={[styles.lowerRow, narrow && styles.stackRow]}>
        <View style={[styles.card, card, styles.flexHalf]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, textColor]}>Todays Plan</Text>
            <Pressable>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>

          <Text style={[styles.subheading, textColor]}>Meals</Text>
          <View style={[styles.mealsRow, phone && styles.wrapRow]}>
            {MEALS.map((m) => (
              <View key={m.title} style={[styles.mealCard, phone && styles.mealCardPhone, { borderColor: card.borderColor }]}>
                <View style={[styles.mealImgPlaceholder, trackBg]} />
                <View style={styles.mealInfo}>
                  <Text style={[styles.mealTitle, textColor]}>{m.title}</Text>
                  <Text style={styles.mealCalories}>{m.calories}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.subheading, textColor, { marginTop: 12 }]}>Workout</Text>
          <View style={[styles.workoutRow, phone && styles.workoutRowPhone, { borderColor: card.borderColor }]}>
            <View style={[styles.workoutIconBox, trackBg]}>
              <Ionicons name="barbell" size={22} color={colors.textMuted} />
            </View>
            <View style={styles.flex1}>
              {/* Was "Upper Body Strength" / "35 min • Intermediate", hardcoded. */}
              <Text style={[styles.workoutTitle, textColor]}>
                {workoutSummary
                  ? workoutSummary.target
                    ? `${workoutSummary.completed}/${workoutSummary.target} workouts this week`
                    : `${workoutSummary.completed} workouts this week`
                  : "This week"}
              </Text>
              <Text style={styles.workoutMeta}>
                {workoutSummary ? `${workoutSummary.totalMinutes} min logged` : "\u2014"}
              </Text>
              <Text style={styles.workoutDesc}>Build strength and tone your upper body with this workout</Text>
            </View>
            <Pressable onPress={startWorkout} style={styles.playBtn}>
              <Ionicons name="play" size={14} color={colors.white} />
            </Pressable>
          </View>

          {workoutStarted && (
            <View style={styles.workoutStartedBanner}>
              <Text style={styles.workoutStartedText}>Workout started! 💪</Text>
            </View>
          )}
        </View>

        {/* Insights */}
        <View style={styles.flexHalf}>
          <View style={[styles.card, card]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, textColor]}>Insights</Text>
              <Text style={styles.thisWeek}>This Week</Text>
            </View>

            <View style={[styles.chartBox, { borderColor: darkMode ? screenTones.dark.border : "#f3f4f6" }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.chartLabel, textColor]}>Calories Trend</Text>
                <Text style={styles.chartAvg}>Average: 1718 kcal</Text>
              </View>
              <View style={{ marginTop: 4 }}>
                <AreaChartMini
                  data={CALORIE_DATA}
                  height={145}
                  stroke={colors.stepsChartStroke}
                  fill={colors.stepsChartFill}
                  yMin={0}
                  yMax={2400}
                  yTicks={[0, 800, 1600, 2400]}
                  yTickFormat={(v) => (v === 2400 ? "2.4k" : v === 1600 ? "1.6k" : v === 800 ? "800" : "0")}
                  name="Calories"
                  unit="kcal"
                />
              </View>
            </View>
          </View>

          <View style={[styles.insightCardsRow, phone && styles.stackRow]}>
            {/* Macronutrient Distribution */}
            <View style={[styles.card, card, styles.flexHalf]}>
              <Text style={[styles.chartLabel, textColor]}>Macronutrient Distribution</Text>
              <View style={styles.donutWrap}>
                <DonutChart
                  size={96}
                  strokeWidth={15}
                  centerBg={getScreenTones(darkMode).card}
                  segments={[
                    { value: 150, color: shellColors.primary },
                    { value: 95, color: colors.blue400 },
                    { value: 115, color: chipTints.orange.icon },
                  ]}
                >
                  <Text style={[styles.donutCenterTitle, textColor]}>Today</Text>
                  <Text style={styles.donutCenterSub}>1850 kcal</Text>
                </DonutChart>
              </View>
              <View style={styles.legend}>
                <LegendRow color={shellColors.primary} label="Protein" value="32%" textColor={textColor} />
                <LegendRow color={colors.blue400} label="Carbs" value="38%" textColor={textColor} />
                <LegendRow color={chipTints.orange.icon} label="Fat" value="30%" textColor={textColor} />
              </View>
            </View>

            {/* Weight Progress */}
            <View style={[styles.card, card, styles.flexHalf]}>
              <Text style={[styles.chartLabel, textColor]}>Weight Progress</Text>
              <View style={styles.mt3}>
                <Text style={[styles.weightNum, textColor]}>70 kg</Text>
                <Text style={styles.weightDelta}> ▼ 2.5 kg</Text>
              </View>
              <Text style={styles.weightSince}>Since last month</Text>
              <View style={{ marginTop: 16 }}>
                <AreaChartMini data={WEIGHT_DATA} height={64} stroke={shellColors.primary} fill={shellColors.light.activeNavBg} yMin={68} yMax={74} showXLabels dotRadius={2} name="Weight" unit="kg" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </DashboardLayout>
  );
}

function Macro({ name, value, dark }) {
  return (
    <View style={[styles.macroBox, { borderColor: getScreenTones(dark).border }]}>
      <Text style={[styles.macroName, { color: dark ? colors.white : screenTones.light.text }]}>{name}</Text>
      <Text style={styles.macroValue}>{value}</Text>
      <View style={[styles.macroTrack, { backgroundColor: getScreenTones(dark).border }]}>
        <View style={styles.macroFill} />
      </View>
    </View>
  );
}

function LegendRow({ color, label, value, textColor }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLeft}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={[styles.legendLabel, textColor]}>{label}</Text>
      </View>
      <Text style={[styles.legendValue, textColor]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ...dashboardStyles,

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 12 },
  statCard: { flex: 1},
  statCardNarrow: { minWidth: 220 },
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
  // Referenced by the Daily Calories / Hydration / Steps cards below but
  // never defined -- styles.kcalSuffix and styles.lSuffix silently resolved
  // to undefined, so those unit suffixes rendered unstyled. Native already
  // has an equivalent kcalSuffix; matched its sizing here.
  kcalSuffix: { fontSize: 13, fontWeight: "500" },
  lSuffix: { fontSize: 13, fontWeight: "500" },
  smallMuted: { fontSize: 12, fontWeight: "600", marginTop: 4 },

  progressTrack: { marginTop: 8, height: 8, borderRadius: 4, overflow: "hidden" },

  statsRow: { flexDirection: "row", gap: 12 },
  macroRow: { flexDirection: "row", gap: 4, marginTop: 16 },
  macroBox: { flex: 1, borderRadius: 6, borderWidth: 1, padding: 6 },
  macroName: { fontSize: 10, fontWeight: "700" },
  macroValue: { fontSize: 8, color: colors.textMuted },
  macroTrack: { marginTop: 4, height: 4, borderRadius: 2, overflow: "hidden" },
  macroFill: { width: "70%", height: 4, borderRadius: 2, backgroundColor: "#00c950" },

  addWaterBtn: { marginLeft: "auto", marginTop: 8, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  lowerRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  subheading: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  thisWeek: { fontSize: 10, fontWeight: "600", color: colors.textMuted },

  mealsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  mealCard: { flex: 1, borderRadius: 6, borderWidth: 1, overflow: "hidden" },
  mealCardPhone: { minWidth: "47%" },
  mealImgPlaceholder: { height: 64 },
  mealInfo: { padding: 4 },
  mealTitle: { fontSize: 10, fontWeight: "700" },
  mealCalories: { fontSize: 8, color: colors.textMuted },

  workoutRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, borderRadius: radii.sm, borderWidth: 1, padding: 8 },
  workoutRowPhone: { flexWrap: "wrap" },
  workoutIconBox: { width: 80, height: 80, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  workoutTitle: { fontSize: 15, fontWeight: "700" },
  workoutMeta: { fontSize: 12, color: colors.textMuted },
  workoutDesc: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green600, alignItems: "center", justifyContent: "center" },

  workoutStartedBanner: { marginTop: 8, borderRadius: 6, backgroundColor: shellColors.light.activeNavBg, padding: 8, alignItems: "center" },
  workoutStartedText: { fontSize: 12, fontWeight: "600", color: shellColors.primary },

  chartBox: { marginTop: 12, borderRadius: 6, borderWidth: 1, padding: 8 },
  chartLabel: { fontSize: 10, fontWeight: "600" },
  chartAvg: { fontSize: 9, fontWeight: "600", color: colors.textMuted },

  insightCardsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 12 },
  donutCenterTitle: { fontSize: 9, fontWeight: "700" },
  donutCenterSub: { fontSize: 8, color: colors.textMuted },

  legend: { marginTop: 12, gap: 4 },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 8 },
  legendValue: { fontSize: 8, fontWeight: "600" },

  weightNum: { fontSize: 13, fontWeight: "700" },
  weightDelta: { fontSize: 9, fontWeight: "600", color: colors.green600 },
  weightSince: { fontSize: 8, color: colors.textMuted, marginTop: 4 },
});