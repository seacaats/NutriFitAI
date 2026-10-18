import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Pressable, StyleSheet, Text } from "react-native";

// Selectable chip (days, times, preferences)
export default function Chip({ label, sublabel, active, onPress, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? shellColors.primary : tone.border },
        active && { backgroundColor: tone.soft },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? shellColors.primary : tone.text }]}>{label}</Text>
      {!!sublabel && <Text style={[styles.chipSub, { color: tone.muted }]}>{sublabel}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 58 },
  chipText: { fontSize: 13, fontWeight: "700" },
  chipSub: { fontSize: 10, marginTop: 1 },
});
