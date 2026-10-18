import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** Page picker. Hidden entirely at one page */
export default function Pager({ page, pageCount, total, onChange, unit = "rows" }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  if (pageCount <= 1) return null;

  const Btn = ({ icon, disabled, onPress, label }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.pagerBtn, { borderColor: tone.border }, disabled && styles.pagerBtnDisabled]}
    >
      <Ionicons name={icon} size={16} color={disabled ? tone.muted : tone.text} />
    </Pressable>
  );

  return (
    <View style={styles.pager}>
      <Text style={[styles.pagerText, { color: tone.muted }]}>
        Page {page} of {pageCount} · {total} {unit}
      </Text>
      <View style={styles.pagerBtns}>
        <Btn icon="chevron-back" label="Previous page" disabled={page <= 1} onPress={() => onChange(page - 1)} />
        <Btn icon="chevron-forward" label="Next page" disabled={page >= pageCount} onPress={() => onChange(page + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" },
  pagerText: { fontSize: 12 },
  pagerBtns: { flexDirection: "row", gap: 8 },
  pagerBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },
  pagerBtnDisabled: { opacity: 0.4 },
});
