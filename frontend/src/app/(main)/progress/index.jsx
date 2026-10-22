import {
  CaloriesCard, GoalCard, MacrosCard, PeriodBar, SummaryCards, WeightCard, WorkoutsCard,
} from "@/features/progress/components/ProgressWidgets";
import { useProgress } from "@/features/progress/hooks/useProgress";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { StyleSheet, useWindowDimensions, View } from "react-native";

// Mobile progress screen displaying nutrition, steps, workouts, and weight trends over the selected period.
export default function ProgressScreen() {
  const { darkMode } = useTheme();
  const progress = useProgress();
  const { width } = useWindowDimensions();
  const compact = true;

  return (
    <DashboardLayout hideTabBar>
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
