import { colors } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  scan: "camera",
  "ai-coach": "hardware-chip",
  progress: "stats-chart",
  profile: "person",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9A9A9A",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: { height: 68, paddingTop: 6, paddingBottom: 10 },
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={`${ICONS[route.name]}${focused ? "" : "-outline"}` as keyof typeof Ionicons.glyphMap} size={22} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="scan" options={{ title: "Scan" }} />
      <Tabs.Screen name="ai-coach" options={{ title: "AI Coach" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}