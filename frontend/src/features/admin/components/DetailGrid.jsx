import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text, View } from "react-native";

/**
 * Label/value pairs for a row's expanded drawer. Wraps rather than scrolls
 */
export default function DetailGrid({ items }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);

  return (
    <View style={styles.detailGrid}>
      {items
        .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
        .map((item) => (
          <View key={item.label} style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: tone.muted }]}>{item.label}</Text>
            {/* selectable so an id or an IP can be copied out of the drawer --
                the single most common thing anyone does with either. */}
            <Text selectable style={[styles.detailValue, { color: tone.text }]}>{item.value}</Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Items wrap two-up on a phone and grow on wider screens. flexShrink and
  // maxWidth let a long value (a user agent, an ID) wrap inside its item
  // instead of pushing the drawer wider than the screen
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  detailItem: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0, maxWidth: "100%", gap: 2 },
  detailLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  detailValue: { fontSize: 13 },
});
