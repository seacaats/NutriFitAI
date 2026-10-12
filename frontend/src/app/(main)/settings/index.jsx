import SettingsPanel from "@/features/user/components/SettingsPanel";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { Platform, StyleSheet, Text, View } from "react-native";

// One screen for both: on mobile it's on the bottom bar (no back arrow), on
// web the description sits under the title
export default function SettingsScreen() {
  const { shell: c } = useTheme();
  return (
    <DashboardLayout>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.sidebarText }]}>Settings</Text>
        {Platform.OS === "web" && <Text style={[styles.subtitle, { color: c.headerDescText }]}>Adjust how NutriFitAI works for you.</Text>}
      </View>
      <SettingsPanel />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Platform.OS === "web" ? 16 : 14 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: 13 },
});