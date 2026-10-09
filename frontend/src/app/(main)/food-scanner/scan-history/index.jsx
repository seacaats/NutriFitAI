import { ScanHistoryPanel } from "@/features/food/components/FoodHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import { useTheme } from "@/shared/context/ThemeContext";
import { useRouter } from "expo-router";

// Every saved scan, newest first. Tapping one reopens it on the scanner
export default function ScanHistoryScreen() {
  const { darkMode } = useTheme();
  const router = useRouter();
  return (
    <DashboardLayout hideTabBar>
      <ScreenHeader title="Scan history" subtitle="Tap a scan to review or log it" fallback="/food-scanner" />
      <ScanHistoryPanel darkMode={darkMode} onOpen={(id) => router.push(`/food-scanner?scan=${id}`)} />
    </DashboardLayout>
  );
}