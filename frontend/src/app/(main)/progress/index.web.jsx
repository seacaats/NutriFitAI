import {
  CaloriesCard, GoalCard, MacrosCard, PeriodBar, SummaryCards, WeightCard, WorkoutsCard,
} from "@/features/progress/components/ProgressWidgets";
import { useProgress } from "@/features/progress/hooks/useProgress";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Web progress screen arranging shared ProgressWidgets into responsive two-column rows.
export default function ProgressScreen() {
  const { darkMode } = useTheme();
  const { textColor } = getScreenPalette(darkMode);
  const progress = useProgress();
  const { width } = useWindowDimensions();
  const narrow = width < 980;
  // Prevent flex children from collapsing to zero height when stacked vertically.
  const item = (flex) => (narrow ? styles.stackItem : { flex });

  return (
    <DashboardLayout>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, textColor]}>Progress</Text>
        <Text style={styles.pageSubtitle}>Track your fitness journey and see how far you've come.</Text>
      </View>

      <PeriodBar progress={progress} darkMode={darkMode} style={styles.periodBar} />
      <ScreenError message={progress.error} />

      <SummaryCards progress={progress} darkMode={darkMode} wide style={styles.section} />
      <GoalCard progress={progress} darkMode={darkMode} style={styles.section} />

      <View style={[styles.row, styles.section, narrow && styles.stack]}>
        <CaloriesCard progress={progress} darkMode={darkMode} chartHeight={230} style={item(2)} />
        <MacrosCard progress={progress} darkMode={darkMode} style={item(1)} />
      </View>

      <View style={[styles.row, styles.section, narrow && styles.stack]}>
        <WeightCard progress={progress} darkMode={darkMode} chartHeight={180} style={item(1)} />
        <WorkoutsCard progress={progress} darkMode={darkMode} chartHeight={180} style={item(1)} />
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: "700" },
  pageSubtitle: { marginTop: 6, fontSize: 14, color: colors.textMuted },
  periodBar: { maxWidth: 560 },
  section: { marginTop: 12 },
  row: { flexDirection: "row", gap: 12 },
  stack: { flexDirection: "column", alignItems: "stretch" },
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
});
