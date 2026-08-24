import { Card, ProgressBar } from "@/components/nutrifit/Card";
import { currentUser, dailyNutrition, todaysPlan } from "@/data/placeholders";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function MacroBox({ label, current, goal, unit = "g", color }: { label: string; current: number; goal: number; unit?: string; color: string }) {
  return (
    <View style={styles.macroBox}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {current}
        <Text style={styles.macroGoal}>
          /{goal}
          {unit}
        </Text>
      </Text>
      <ProgressBar progress={current / goal} color={color} height={6} />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const pct = Math.round((dailyNutrition.caloriesConsumed / dailyNutrition.caloriesGoal) * 100);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.name}>{currentUser.name.split(" ")[0]}! 👋</Text>
        </View>
        <Ionicons name="notifications-outline" size={26} color={colors.textPrimary} />
      </View>

      <Card style={styles.calorieCard}>
        <Text style={styles.cardTitle}>Daily Calories</Text>
        <View style={styles.calorieRow}>
          <Text style={styles.calorieValue}>
            {dailyNutrition.caloriesConsumed}
            <Text style={styles.calorieGoal}>/{dailyNutrition.caloriesGoal} kcal</Text>
          </Text>
          <Text style={styles.caloriePct}>{pct}%</Text>
        </View>
        <ProgressBar progress={pct / 100} height={10} />

        <View style={styles.macroRow}>
          <MacroBox label="Protein" current={dailyNutrition.protein.current} goal={dailyNutrition.protein.goal} color={colors.protein} />
          <MacroBox label="Carbs" current={dailyNutrition.carbs.current} goal={dailyNutrition.carbs.goal} color={colors.carbs} />
          <MacroBox label="Fat" current={dailyNutrition.fat.current} goal={dailyNutrition.fat.goal} color={colors.fat} />
        </View>
      </Card>

      <View style={styles.quickRow}>
        <Pressable style={[styles.quickCard, { backgroundColor: colors.scanCardBg }]} onPress={() => router.push("/(tabs)/scan")}>
          <View>
            <Text style={styles.quickTitle}>Scan Food</Text>
            <Text style={styles.quickSubtitle}>Analyze your meal</Text>
          </View>
          <View style={[styles.quickIconWrap, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera-outline" size={24} color={colors.white} />
          </View>
        </Pressable>

        <Pressable style={[styles.quickCard, { backgroundColor: colors.coachCardBg }]} onPress={() => router.push("/(tabs)/ai-coach")}>
          <View>
            <Text style={styles.quickTitle}>AI Coach</Text>
            <Text style={styles.quickSubtitle}>Chat with your coach</Text>
          </View>
          <View style={[styles.quickIconWrap, { backgroundColor: "#9C27B0" }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.white} />
          </View>
        </Pressable>
      </View>

      <View style={styles.planHeaderRow}>
        <Text style={styles.sectionTitle}>Today's Plan</Text>
        <Pressable onPress={() => router.push("/(tabs)/progress")}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.planRow}>
        <View style={[styles.planCard, { backgroundColor: colors.mealCardBg }]}>
          <Text style={styles.planTitle}>Meal Plan</Text>
          <Text style={styles.planDetail}>
            {todaysPlan.mealPlan.completed}/{todaysPlan.mealPlan.total} <Text style={styles.planDetailMuted}>Completed</Text>
          </Text>
          <Ionicons name="restaurant-outline" size={30} color={colors.primary} style={styles.planIcon} />
        </View>
        <View style={[styles.planCard, { backgroundColor: colors.workoutCardBg }]}>
          <Text style={styles.planTitle}>Workout</Text>
          <Text style={styles.planDetail}>{todaysPlan.workout.name}</Text>
          <Text style={styles.planDetailMuted}>{todaysPlan.workout.durationMins} mins</Text>
          <Ionicons name="barbell-outline" size={30} color="#2196F3" style={styles.planIcon} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgWhite },
  container: { padding: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  greeting: { ...typography.h3, color: colors.textPrimary },
  name: { ...typography.h1 },
  calorieCard: { marginBottom: spacing.lg },
  cardTitle: { ...typography.h3, marginBottom: spacing.sm },
  calorieRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm },
  calorieValue: { fontSize: 30, fontWeight: "800", color: colors.textPrimary },
  calorieGoal: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  caloriePct: { fontSize: 20, fontWeight: "800", color: colors.primary },
  macroRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  macroBox: { flex: 1, backgroundColor: colors.bgWhite, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.md, padding: 10 },
  macroLabel: { ...typography.bodyBold, marginBottom: 4 },
  macroValue: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  macroGoal: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  quickRow: { flexDirection: "row", gap: 12, marginBottom: spacing.lg },
  quickCard: { flex: 1, borderRadius: radii.lg, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 90 },
  quickTitle: { ...typography.bodyBold, marginBottom: 4 },
  quickSubtitle: { ...typography.caption, color: colors.textSecondary },
  quickIconWrap: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { ...typography.h3 },
  viewAll: { color: colors.primary, fontWeight: "700" },
  planRow: { flexDirection: "row", gap: 12 },
  planCard: { flex: 1, borderRadius: radii.lg, padding: spacing.md, minHeight: 110 },
  planTitle: { ...typography.bodyBold, marginBottom: 6 },
  planDetail: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  planDetailMuted: { fontSize: 13, color: colors.textSecondary },
  planIcon: { position: "absolute", right: 14, bottom: 14, opacity: 0.85 },
});
