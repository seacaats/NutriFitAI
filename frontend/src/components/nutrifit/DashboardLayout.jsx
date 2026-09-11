import { useTheme } from "@context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 12 : width >= 768 ? 24 : 16;
  const contentStyle = [styles.content, { paddingTop: insets.top + 16, paddingHorizontal: horizontalPadding }];

  const content = scrollable ? (
    <ScrollView style={styles.flex1} contentContainerStyle={contentStyle}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex1, { paddingTop: insets.top + 16, paddingHorizontal: horizontalPadding }]}>
      <View style={styles.nonScrollableContent}>{children}</View>
    </View>
  );

  return (
    <View style={[styles.outer, { backgroundColor: c.shellBg }]}>
      {content}

      {!hideTabBar && (
        <View style={[styles.tabBarShell, { backgroundColor: c.cardBg, borderTopColor: c.dropdownBorder, paddingBottom: 8 + insets.bottom }]}>
          <View style={styles.tabBar}>{TABS.map((tab) => {
            const active = pathname === tab.route;
            const color = active ? c.primary : c.inactiveNavText;
            return (
              <Pressable key={tab.name} style={styles.tabBtn} onPress={() => router.push(tab.route)}>
                <Ionicons name={tab.icon} size={22} color={color} />
                <Text style={[styles.tabLabel, { color }]}>{tab.name}</Text>
              </Pressable>
            );
          })}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  flex1: { flex: 1 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", paddingBottom: 24 },
  nonScrollableContent: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center" },

  tabBarShell: {
    borderTopWidth: 1,
  },
  tabBar: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    flexDirection: "row",
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: "600" },
});
