import FilterRow from "@/features/admin/components/FilterRow";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Compact filter bar: renders one toggle button per filter and expands options
 * for the selected filter. Active filters highlight with the selected option label.
 * `filters` = [{ key, label, options: [{ value, label }], value }], where options[0] is the unfiltered default.
 */
export default function FilterDropdowns({ filters, onChange, onClear, children }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [openKey, setOpenKey] = useState(null);
  const open = filters.find((f) => f.key === openKey);
  const anyOn = filters.some((f) => f.value !== f.options[0].value);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {filters.map((f) => {
          const on = f.value !== f.options[0].value;
          const chosen = f.options.find((o) => o.value === f.value);
          const isOpen = openKey === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setOpenKey(isOpen ? null : f.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={[
                styles.button,
                { borderColor: tone.border, backgroundColor: tone.card },
                (on || isOpen) && { borderColor: shellColors.primary },
                on && { backgroundColor: tone.soft },
              ]}
            >
              <Text style={[styles.text, { color: on ? shellColors.primary : tone.text }]} numberOfLines={1}>
                {on ? `${f.label}: ${chosen?.label}` : f.label}
              </Text>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={on ? shellColors.primary : tone.muted} />
            </Pressable>
          );
        })}
        {children}
        {anyOn && onClear && (
          <Pressable onPress={() => { setOpenKey(null); onClear(); }} hitSlop={6} accessibilityRole="button">
            <Text style={[styles.clear, { color: shellColors.primary }]}>Clear filters</Text>
          </Pressable>
        )}
      </View>
      {open && (
        <FilterRow
          options={open.options}
          value={open.value}
          onChange={(value) => { onChange(open.key, value); setOpenKey(null); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  button: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, height: 40 },
  text: { fontSize: 13, fontWeight: "700" },
  clear: { fontSize: 13, fontWeight: "700", height: 40, textAlignVertical: "center", lineHeight: 40 },
});
