import SettingsPanel from "@/features/user/components/SettingsPanel";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { Platform, StyleSheet, Text } from "react-native";

// One screen for both: on mobile it's on the bottom bar (no back arrow), on
// web the sidebar entry supplies the description
export default function SettingsScreen() {
  const { shell: c } = useTheme();
  return (
    <DashboardLayout>
      <Text style={[styles.title, { color: c.sidebarText }]}>Settings</Text>
      <SettingsPanel />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", marginBottom: Platform.OS === "web" ? 16 : 14 },
});
