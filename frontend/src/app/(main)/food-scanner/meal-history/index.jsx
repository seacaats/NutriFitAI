import { MealHistoryPanel } from "@/features/food/components/FoodHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import { useTheme } from "@/shared/context/ThemeContext";

// Every day with logged meals, newest first, with the day's totals
export default function MealHistoryScreen() {
  const { darkMode } = useTheme();
  return (
    <DashboardLayout hideTabBar>
      <ScreenHeader title="Meal history" subtitle="Your logged meals by day" fallback="/food-scanner" />
      <MealHistoryPanel darkMode={darkMode} />
    </DashboardLayout>
  );
}