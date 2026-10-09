import { WaterHistoryPanel } from "@/features/water/components/WaterHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";

// Daily water totals, newest first, a month at a time
export default function WaterHistoryScreen() {
  return (
    <DashboardLayout hideTabBar>
      <ScreenHeader title="Water history" subtitle="Tap edit to correct a day" fallback="/water" />
      <WaterHistoryPanel />
    </DashboardLayout>
  );
}