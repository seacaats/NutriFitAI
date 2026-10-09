import {
  CaloriesCard, GoalCard, MacrosCard, PeriodBar, SummaryCards, WeightCard, WorkoutsCard,
} from "@/features/progress/components/ProgressWidgets";
import { useProgress } from "@/features/progress/hooks/useProgress";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { StyleSheet, useWindowDimensions, View } from "react-native";

// Meals, steps, workouts and weight over a week, month, 3 months or year,
// all from one GET /api/progress. The cards live in ProgressWidgets, shared
// with the web screen
export default function ProgressScreen() {
  const { darkMode } = useTheme();
  const progress = useProgress();
  const { width } = useWindowDimensions();
  // Macros and weight sit side by side unless the phone is too narrow
  const compact = width < 400;

  return (
    <DashboardLayout hideTabBar>
      {/* Opened from the ☰ menu, so no bottom bar; the header has a back arrow */}
      <ScreenHeader title="My Progress" subtitle="Your trends over time" />

      <PeriodBar progress={progress} darkMode={darkMode} style={styles.section} />
      <ScreenError message={progress.error} />

      <SummaryCards progress={progress} darkMode={darkMode} style={styles.section} />
      <GoalCard progress={progress} darkMode={darkMode} style={styles.section} />
      <CaloriesCard progress={progress} darkMode={darkMode} chartHeight={170} style={styles.section} />

      <View style={[styles.row, styles.section, compact && styles.stack]}>
        <MacrosCard progress={progress} darkMode={darkMode} style={!compact && styles.flex1} />
        <WeightCard progress={progress} darkMode={darkMode} chartHeight={110} style={!compact && styles.flex1} />
      </View>

      <WorkoutsCard progress={progress} darkMode={darkMode} chartHeight={120} style={[styles.section, styles.last]} />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12 },
  last: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  stack: { flexDirection: "column" },
  flex1: { flex: 1 },
});