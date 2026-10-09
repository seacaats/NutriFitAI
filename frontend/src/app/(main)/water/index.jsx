import { WaterPanel } from "@/features/water/components/WaterCards";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import { useTheme } from "@/shared/context/ThemeContext";

// Mobile: opened from the ☰ menu, so no bottom bar and a back arrow.
// Web: a sidebar page, so just the title
export default function WaterScreen() {
  const { darkMode } = useTheme();
  return (
    <DashboardLayout hideTabBar>
      <ScreenHeader title="Water" subtitle="Log drinks, hit your goal" />
      <WaterPanel darkMode={darkMode} />
    </DashboardLayout>
  );
}