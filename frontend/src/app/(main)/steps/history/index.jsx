import { StepsHistoryPanel } from "@/features/steps/components/StepHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";

// Every day's steps, newest first, a month at a time
export default function StepsHistoryScreen() {
  return (
    <DashboardLayout hideTabBar>
      <ScreenHeader title="Steps history" subtitle="Tap edit to correct a day" fallback="/steps" />
      <StepsHistoryPanel />
    </DashboardLayout>
  );
}