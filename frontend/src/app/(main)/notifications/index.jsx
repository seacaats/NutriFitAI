import NotificationList from "@/features/notifications/components/NotificationList";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { StyleSheet, Text } from "react-native";

// The inbox. Same list as the web screen and the web header's bell
export default function NotificationsScreen() {
  const { shell: c } = useTheme();
  return (
    <DashboardLayout>
      <Text style={[styles.pageTitle, { color: c.sidebarText }]}>Notifications</Text>
      <NotificationList />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
});