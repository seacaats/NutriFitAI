import { WORKOUT_TABS } from "@/features/workouts/hooks/useWorkoutTab";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// Segmented tabs for the Workouts page. Counts show only when non-zero

export default function WorkoutTabs({ value, onChange, counts = {}, darkMode }) {
  const tone = getScreenTones(darkMode);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tabStyles.row}>
      <View style={[tabStyles.track, { backgroundColor: tone.surfaceMuted }]}>
        {WORKOUT_TABS.map((tab) => {
          const active = tab.key === value;
          const count = counts[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[tabStyles.tab, active && [tabStyles.tabActive, { backgroundColor: tone.card }]]}
            >
              <Ionicons
                name={active ? tab.icon : `${tab.icon}-outline`}
                size={15}
                color={active ? shellColors.primary : tone.muted}
              />
              <Text style={[tabStyles.label, { color: active ? tone.text : tone.muted }]}>{tab.label}</Text>
              {!!count && (
                <View style={[tabStyles.badge, { backgroundColor: active ? shellColors.primary : tone.border }]}>
                  <Text style={[tabStyles.badgeText, { color: active ? "#ffffff" : tone.text }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  row: { paddingVertical: 2 },
  track: { flexDirection: "row", borderRadius: radii.md, padding: 4, gap: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  tabActive: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: fs(14, 13), fontWeight: "700" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: fs(12, 10), fontWeight: "800" },
});
