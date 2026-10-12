import NotificationList from "@/features/notifications/components/NotificationList";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { Platform, StyleSheet, Text, View } from "react-native";

// The inbox. Same list as the web screen and the web header's bell
export default function NotificationsScreen() {
  const { shell: c } = useTheme();
  return (
    <DashboardLayout>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: c.sidebarText }]}>Notifications</Text>
        {Platform.OS === "web" && <Text style={[styles.pageSubtitle, { color: c.headerDescText }]}>Updates and reminders in one place.</Text>}
      </View>
      <NotificationList />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 13 },
});