import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, radii, shellColors } from "@/shared/theme/nutrifit";
import { dashboardStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";


export default function DashboardScreen() {
  // Real weekly totals. summary is null while loading and on failure; the card
  // shows an em dash rather than a spinner, because a dashboard tile flickering
  // between states is noisier than one that simply fills in.
  const { summary: workoutSummary } = useWorkoutSessions();

  const { shell: c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  // Same AuthContext DashboardLayout reads from — no extra request needed.
  const { firstName, loading } = useAuth();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const trackBg = { backgroundColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, textColor]}>Good Morning,</Text>
          <Text style={[styles.greetingName, textColor]}>
            {loading ? "..." : firstName}!👋
          </Text>
        </View>
        <Ionicons name="notifications-outline" size={24} color={c.notifIcon} />
      </View>

      {/* Daily Calories */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Daily Calories</Text>

        <View style={styles.rowBetween}>
          <Text style={[styles.bigNum, textColor]}>
            1850<Text style={styles.kcalSuffix}> /2200 kcal</Text>
          </Text>
          <Text style={styles.pctGreen}>84%</Text>
        </View>

        <View style={[styles.progressTrack, trackBg]}>
          <View style={[styles.progressFill, { width: "84%", backgroundColor: colors.calorieProgressFill }]} />
        </View>

        <View style={styles.macroRow}>
          <Macro name="Protein" value="79/120g" color="#00c2b8" pct={66} border={card.borderColor} text={textColor.color} />
          <Macro name="Carbs" value="165/250g" color="#ff9f43" pct={66} border={card.borderColor} text={textColor.color} />
          <Macro name="Fat" value="45/70g" color="#a45ee5" pct={64} border={card.borderColor} text={textColor.color} />
        </View>
      </View>

      {/*  */}
      <View style={[styles.shortcutRow, compact && styles.stackRow]}>
        <Pressable onPress={() => router.push("/food-scanner")} style={[styles.shortcutCard, { backgroundColor: chipTints.green.light }]}>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>Scan Food</Text>
            <Text style={styles.shortcutSub}>Analyze your food</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: shellColors.primary }]}>
            <Ionicons name="camera" size={20} color={colors.white} />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/ai-coach")} style={[styles.shortcutCard, { backgroundColor: chipTints.purple.light }]}>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>AI Coach</Text>
            <Text style={styles.shortcutSub}>Chat with your coach</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: chipTints.purple.icon }]}>
            <Ionicons name="hardware-chip" size={20} color={colors.white} />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/workouts")} style={[styles.shortcutCard, { backgroundColor: chipTints.green.light }]}>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>Workout Planner</Text>
            <Text style={styles.shortcutSub}>Plan your workouts</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: shellColors.primary }]}>
            <Ionicons name="barbell" size={20} color={colors.white} />
          </View>
        </Pressable>
      </View>

      {/* Today's Plan */}
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, textColor]}>Today's Plan</Text>
        <Pressable>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.planRow}>
        <View style={[styles.planCard, { backgroundColor: "#fbf6d9" }]}>
          <Ionicons name="restaurant" size={20} color="#c9a227" />
          <Text style={styles.planTitle}>Meal Plan</Text>
          <Text style={styles.planMeta}>2/4 Completed</Text>
        </View>

        <View style={[styles.planCard, card]}>
          <Ionicons name="barbell" size={20} color={chipTints.blue.icon} />
          <Text style={[styles.planTitle, textColor]}>Workout</Text>
          {/*
            Was "Upper Body" / "35 mins", hardcoded. Now the user's real week.
            A null target means no weekly goal is set, so the count is shown
            alone rather than against a denominator of nothing.
          */}
          <Text style={styles.planMeta}>
            {workoutSummary
              ? workoutSummary.target
                ? `${workoutSummary.completed}/${workoutSummary.target} this week`
                : `${workoutSummary.completed} this week`
              : "\u2014"}
          </Text>
          <Text style={styles.planMeta}>
            {workoutSummary ? `${workoutSummary.totalMinutes} mins` : "\u2014"}
          </Text>
        </View>
      </View>
    </DashboardLayout>
  );
}

function Macro({ name, value, color, pct, border, text }) {
  return (
    <View style={[styles.macroBox, { borderColor: border }]}>
      <Text style={[styles.macroName, { color: text }]}>{name}</Text>
      <Text style={styles.macroValue}>{value}</Text>
      <View style={[styles.macroTrack, { backgroundColor: border }]}>
        <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...dashboardStyles,

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "700" },
  greetingName: { fontSize: 26, fontWeight: "800", marginTop: 2 },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bigNum: { fontSize: 26, fontWeight: "800" },
  kcalSuffix: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  pctGreen: { fontSize: 15, fontWeight: "700", color: shellColors.primary },

  progressTrack: { marginTop: 10, height: 8, borderRadius: 4, overflow: "hidden" },

  macroRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  macroBox: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 8 },
  macroName: { fontSize: 12, fontWeight: "700" },
  macroValue: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  macroTrack: { marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden" },
  macroFill: { height: 4, borderRadius: 2 },

  shortcutRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  shortcutCard: { flex: 1, borderRadius: radii.sm, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutText: { flexShrink: 1 },
  shortcutTitle: { fontSize: 12, fontWeight: "700", color: colors.nearBlack },
  shortcutSub: { fontSize: 10, color: "#4b5563", marginTop: 2 },
  shortcutIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  sectionTitle: { fontSize: 18, fontWeight: "700" },

  planRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  planCard: { flex: 1, borderRadius: radii.sm, borderColor: "transparent", borderWidth: 1, padding: 12 },
  planTitle: { fontSize: 13, fontWeight: "700", marginTop: 8, color: colors.nearBlack },
  planMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});