import { chipTints, getChipTint } from "@/shared/theme/nutrifitai";
import { workoutsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

// Primary muscles, secondary muscles and equipment as tinted pills, for the
// exercise details dialog on web and mobile. Section spacing comes from the
// screen (`sectionStyle`, `titleStyle`), since the two dialogs differ there
const SECTIONS = [
  { key: "muscles", title: "Primary Muscles", tint: "blue", icon: "body", darkText: "#93c5fd" },
  { key: "musclesSecondary", title: "Secondary Muscles", tint: "purple", icon: "body-outline", darkText: "#e9b8f6" },
  { key: "equipment", title: "Equipment", tint: "orange", prefix: "🏋️ ", darkText: "#fbbf6a" },
];

export default function ExercisePills({ exercise, darkMode, textColor, sectionStyle, titleStyle }) {
  return SECTIONS.map(({ key, title, tint, icon, prefix = "", darkText }) => {
    const items = exercise[key];
    if (!items?.length) return null;
    return (
      <View key={key} style={sectionStyle}>
        <Text style={[titleStyle, textColor]}>{title}</Text>
        <View style={styles.muscleRow}>
          {items.map((item) => (
            <View key={item} style={[styles.musclePill, { backgroundColor: getChipTint(tint, darkMode).backgroundColor }]}>
              {icon && <Ionicons name={icon} size={12} color={chipTints[tint].icon} />}
              <Text style={[styles.musclePillText, textColor, darkMode && { color: darkText }]}>
                {prefix}{item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  muscleRow: workoutsStyles.muscleRow,
  musclePill: workoutsStyles.musclePill,
  musclePillText: { fontSize: 11, fontWeight: "600" },
});
