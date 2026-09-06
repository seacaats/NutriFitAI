import { useTheme } from "@context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// insets to avoid overlapping with device

const TABS = [
  { name: "Home", icon: "home", route: "/dashboard" },
  { name: "Scan", icon: "camera", route: "/food-scanner" },
  { name: "AI Coach", icon: "hardware-chip", route: "/ai-coach" },
  { name: "Progress", icon: "bar-chart", route: "/progress" },
  { name: "Profile", icon: "person", route: "/profile" },
];

export default function DashboardLayout({ children, hideTabBar = false, scrollable = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const { shell: c } = useTheme();
  const insets = useSafeAreaInsets();

  const content = scrollable ? (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex1, { paddingTop: insets.top + 16 }]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.outer, { backgroundColor: c.shellBg }]}>
      {content}

      {!hideTabBar && (
        <View style={[styles.tabBar, { backgroundColor: c.cardBg, borderTopColor: c.dropdownBorder, paddingBottom: 8 + insets.bottom }]}>
          {TABS.map((tab) => {
            const active = pathname === tab.route;
            const color = active ? c.primary : c.inactiveNavText;
            return (
              <Pressable key={tab.name} style={styles.tabBtn} onPress={() => router.push(tab.route)}>
                <Ionicons name={tab.icon} size={22} color={color} />
                <Text style={[styles.tabLabel, { color }]}>{tab.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  flex1: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },

  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: "600" },
});
