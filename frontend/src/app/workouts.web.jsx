import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const STATS = [
  { icon: "barbell", title: "Workouts", value: "5", subtitle: "This week" },
  { icon: "time", title: "Workout Time", value: "2h 45m", subtitle: "This week" },
  { icon: "flame", title: "Calories Burned", value: "1,240", subtitle: "This week" },
];

const PROGRAMS = [
  { title: "Upper Body Strength", duration: "35 min", level: "Intermediate", description: "Build strength and tone your upper body." },
  { title: "Lower Body Power", duration: "40 min", level: "Intermediate", description: "Strengthen your legs and improve mobility." },
  { title: "Full Body HIIT", duration: "25 min", level: "Advanced", description: "High intensity training for your entire body." },
];

export default function WorkoutsScreen() {
  const { darkMode } = useTheme();

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb", // border-gray-200 dark:border-gray-700
  };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };

  return (
    <DashboardLayout>
      {/* Workout Summary */}
      <View style={styles.statsRow}>
        {STATS.map((stat) => (
          <StatCard key={stat.title} {...stat} card={card} textColor={textColor} />
        ))}
      </View>

      {/* Workout Programs */}
      <View style={[styles.section, card]}>
        <Text style={[styles.sectionTitle, textColor]}>Recommended Workouts</Text>
        <Text style={styles.sectionSubtitle}>Workouts selected for your fitness goals.</Text>

        <View style={styles.programsRow}>
          {PROGRAMS.map((program) => (
            <WorkoutCard key={program.title} {...program} borderColor={card.borderColor} textColor={textColor} darkMode={darkMode} />
          ))}
        </View>
      </View>
    </DashboardLayout>
  );
}

function StatCard({ icon, title, value, subtitle, card, textColor }) {
  return (
    <View style={[styles.card, card, styles.flex1]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={22} color="#4CAF2F" />
        <Text style={styles.statTitle}>{title}</Text>
      </View>

      <Text style={[styles.statValue, textColor]}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

function WorkoutCard({ title, duration, level, description, borderColor, textColor, darkMode }) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={[styles.workoutCard, { borderColor }, styles.flex1]}>
      <View style={[styles.workoutImage, { backgroundColor: darkMode ? "#333333" : "#e5e7eb" }]}>
        <Ionicons name="barbell" size={40} color="#6a7282" />
      </View>

      <View style={styles.workoutBody}>
        <Text style={[styles.workoutTitle, textColor]}>{title}</Text>
        <Text style={styles.workoutMeta}>
          {duration} • {level}
        </Text>
        <Text style={styles.workoutDesc}>{description}</Text>

        <Pressable
          onPress={() => {}}
          onHoverIn={() => setPressed(true)}
          onHoverOut={() => setPressed(false)}
          style={[styles.startBtn, pressed && { backgroundColor: "#15803d" }]} // hover:bg-green-700
        >
          <Ionicons name="play" size={13} color="#fff" />
          <Text style={styles.startBtnText}>Start Workout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-4
  statsRow: { flexDirection: "row", gap: 12 }, // gap-3

  statHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statTitle: { fontSize: 12, fontWeight: "600", color: "#6a7282" }, // text-xs font-semibold text-gray-500
  statValue: { marginTop: 16, fontSize: 24, fontWeight: "700" }, // mt-4 text-2xl font-bold
  statSubtitle: { marginTop: 4, fontSize: 12, color: "#6a7282" }, // mt-1 text-xs

  section: { marginTop: 16, borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // mt-4 p-4
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 12, color: "#6a7282" }, // mt-1 text-xs

  programsRow: { flexDirection: "row", gap: 12, marginTop: 16 }, // mt-4 gap-3

  workoutCard: { borderRadius: radii.sm, borderWidth: 1, overflow: "hidden" },
  workoutImage: { height: 128, alignItems: "center", justifyContent: "center" }, // h-32
  workoutBody: { padding: 12 }, // p-3

  workoutTitle: { fontSize: 14, fontWeight: "700" }, // text-sm font-bold
  workoutMeta: { marginTop: 4, fontSize: 12, color: "#6a7282" }, // mt-1 text-xs
  workoutDesc: { marginTop: 8, fontSize: 12, color: "#6a7282" }, // mt-2 text-xs

  startBtn: {
    marginTop: 12, // mt-3
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 6, // rounded-md
    backgroundColor: "#4CAF2F",
    paddingVertical: 8, // py-2
  },
  startBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" }, // text-xs font-semibold
});