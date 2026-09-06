import AreaChartMini from "@components/nutrifit/AreaChartMini";
import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

const WEIGHT_DATA = [
  { label: "Week 1", value: 72.5 },
  { label: "Week 2", value: 72 },
  { label: "Week 3", value: 71.5 },
  { label: "Week 4", value: 71 },
  { label: "Week 5", value: 70.5 },
  { label: "Week 6", value: 70 },
];

const SUMMARY_CARDS = [
  { icon: "trending-down", iconColor: "#00a63e", title: "Weight", value: "70 kg", delta: "▼ 2.5 kg", deltaColor: "#00a63e", note: "Since last month" },
  { icon: "barbell", iconColor: "#4CAF2F", title: "Workouts", value: "18", suffix: "sessions", delta: "+4 this month", deltaColor: "#00a63e", note: "Keep moving!" },
  { icon: "flame", iconColor: "#fb923c", title: "Calories Burned", value: "12,480", delta: "+8.4%", deltaColor: "#00a63e", note: "Compared to last month" },
  { icon: "footsteps", iconColor: "#00a63e", title: "Average Steps", value: "8,421", delta: "84% of goal", deltaColor: "#00a63e", note: "Daily average" },
];

const WORKOUT_BARS = [
  { label: "Strength Training", value: "75%", width: "75%" },
  { label: "Cardio", value: "60%", width: "60%" },
  { label: "Flexibility", value: "45%", width: "45%" },
  { label: "Endurance", value: "70%", width: "70%" },
];

const ACHIEVEMENTS = [
  { title: "7 Day Streak", description: "Stayed active for 7 days", icon: "🔥" },
  { title: "10K Steps", description: "Reached 10,000 steps", icon: "👟" },
  { title: "First Workout", description: "Completed your first workout", icon: "💪" },
  { title: "Goal Crusher", description: "Reached your weekly goal", icon: "🏆" },
];

export default function ProgressScreen() {
  const { darkMode } = useTheme();

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb", // border-gray-200 dark:border-gray-700
  };
  const trackBg = { backgroundColor: darkMode ? "#364153" : "#e5e7eb" };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, textColor]}>Progress</Text>
        <Text style={styles.pageSubtitle}>Track your fitness journey and see how far you've come.</Text>
      </View>

      {/* Summary*/}
      <View style={styles.summaryRow}>
        {SUMMARY_CARDS.map((item) => (
          <View key={item.title} style={[styles.card, card, styles.flex1]}>
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
      <View style={styles.mainRow}>
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
              stroke="#4CAF2F"
              fill="#dcffcc"
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

            <Ionicons name="barbell" size={22} color="#4CAF2F" />
          </View>

          <View style={styles.barsList}>
            {WORKOUT_BARS.map((bar) => (
              <ProgressBar key={bar.label} {...bar} textColor={textColor} trackBg={trackBg} />
            ))}
          </View>

          {/* Weekly total */}
          <View style={[styles.weeklyGoal, { backgroundColor: darkMode ? "#2c3a28" : "#f0faeb" }]}>
            <View style={styles.weeklyGoalHeader}>
              <View style={[styles.weeklyGoalIcon, { backgroundColor: darkMode ? "#394d32" : "#dcffcc" }]}>
                <Ionicons name="locate" size={20} color="#4CAF2F" />
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

      {/* Achievements */}
      <View style={[styles.card, card, styles.achievementsSection]}>
        <View style={styles.achievementsHeader}>
          <Ionicons name="trophy" size={21} color="#fb923c" />

          <View>
            <Text style={[styles.sectionTitle, textColor]}>Achievements</Text>
            <Text style={styles.sectionSubtitle}>Milestones you've reached</Text>
          </View>
        </View>

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((item) => (
            <Achievement key={item.title} {...item} borderColor={card.borderColor} textColor={textColor} darkMode={darkMode} />
          ))}
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

function Achievement({ title, description, icon, borderColor, textColor, darkMode }) {
  return (
    <View style={[styles.achievementCard, { borderColor }]}>
      <View style={styles.achievementRow}>
        <View style={[styles.achievementIcon, { backgroundColor: darkMode ? "#2c3a28" : "#f0faeb" }]}>
          <Text style={styles.achievementEmoji}>{icon}</Text>
        </View>

        <View style={styles.flex1}>
          <Text style={[styles.achievementTitle, textColor]}>{title}</Text>
          <Text style={styles.achievementDesc}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-4
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alignRight: { alignItems: "flex-end" },
  mt2: { marginTop: 8 },

  // Header
  pageHeader: { marginBottom: 20 }, // mb-5
  pageTitle: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  pageSubtitle: { marginTop: 4, fontSize: 13, color: "#6a7282" }, // mt-1 text-sm

  // Summary
  summaryRow: { flexDirection: "row", gap: 12 }, // gap-3
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryTitle: { fontSize: 12, fontWeight: "600" }, // text-xs font-semibold
  summaryValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 16 }, // mt-4
  summaryValue: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  summarySuffix: { fontSize: 12, color: "#6a7282" },
  summaryDelta: { marginTop: 4, fontSize: 12, fontWeight: "600" }, // mt-1 text-xs font-semibold
  summaryNote: { marginTop: 4, fontSize: 10, color: "#6a7282" }, // mt-1 text-[10px]

  // Progress
  mainRow: { flexDirection: "row", gap: 12, marginTop: 12 }, // mt-3 gap-3
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 10, color: "#6a7282" }, // mt-1 text-[10px]

  bigNum: { fontSize: 20, fontWeight: "700" }, // text-xl font-bold
  weightDelta: { fontSize: 10, fontWeight: "600", color: "#00a63e" },

  chartWrap: { marginTop: 16 }, // mt-4

  // Workout
  barsList: { marginTop: 20, gap: 16 }, // mt-5 space-y-4
  barLabel: { fontSize: 12, fontWeight: "600" }, // text-xs font-semibold
  barValue: { fontSize: 10, fontWeight: "600", color: "#4CAF2F" }, // text-[10px] font-semibold

  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "#4CAF2F" },

  // Weekly goal
  weeklyGoal: { marginTop: 24, borderRadius: radii.sm, padding: 16 }, // mt-6 p-4
  weeklyGoalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  weeklyGoalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  weeklyGoalTitle: { fontSize: 14, fontWeight: "700" }, // text-sm font-bold
  weeklyGoalNote: { fontSize: 10, color: "#6a7282" },
  weeklyGoalTrack: { marginTop: 12 },

  // Achievements
  achievementsSection: { marginTop: 12 }, // mt-3
  achievementsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }, // mt-4 gap-3

  achievementCard: {
    width: "23.5%", // 4-across/gaps
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 12, // p-3
  },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  achievementEmoji: { fontSize: 18 },
  achievementTitle: { fontSize: 12, fontWeight: "700" }, // text-xs font-bold
  achievementDesc: { marginTop: 4, fontSize: 9, color: "#6a7282" }, // mt-1 text-[9px]
});