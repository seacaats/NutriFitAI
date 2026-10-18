import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

/** Horizontally scrollable filter pills. */
export default function FilterRow({ options, value, onChange }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value ?? "__all"}
            onPress={() => onChange(option.value)}
            style={[
              styles.filterPill,
              { borderColor: tone.border, backgroundColor: tone.card },
              active && { backgroundColor: shellColors.primary, borderColor: shellColors.primary },
            ]}
          >
            <Text style={[styles.filterText, { color: active ? colors.white : tone.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  filterPill: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 12, fontWeight: "700" },
});
