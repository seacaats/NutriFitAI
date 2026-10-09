import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

// − value + control. `step` is how much one tap moves it (1 by default).
// `editable` makes the value a box the user can type into too (servings):
// any number from `min` up, and `max` is optional there (no ceiling)
export default function Stepper({ label, value, onChange, min, max = Infinity, darkMode, step: by = 1, editable = false }) {
  const tone = getScreenTones(darkMode);
  const clamp = (n) => Math.min(max, Math.max(min, n));
  // Rounded to the step's decimals, so 0.1 + 0.2 shows as 0.3
  const tidy = (n) => Math.round(n * 100) / 100;
  const step = (d) => onChange(tidy(clamp(value + d * by)));

  // What's typed, kept apart from `value` so "1." or an empty box can sit
  // there mid-edit. Synced back whenever the value changes from outside
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const type = (t) => {
    const clean = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setText(clean);
    const n = Number(clean);
    if (clean && Number.isFinite(n) && n >= min && n <= max) onChange(tidy(n));
  };
  // Leaving the box: anything out of range snaps back to the nearest allowed
  const commit = () => {
    const n = Number(text);
    const next = text && Number.isFinite(n) ? tidy(clamp(n)) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: tone.muted }]}>{label}</Text>
      <View style={[styles.stepBox, { borderColor: tone.border }]}>
        <Pressable onPress={() => step(-1)} disabled={value <= min} hitSlop={6} accessibilityLabel={`Fewer ${label}`}>
          <Ionicons name="remove" size={15} color={value <= min ? tone.muted : tone.text} />
        </Pressable>
        {editable ? (
          <TextInput
            value={text}
            onChangeText={type}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            selectTextOnFocus
            maxLength={6}
            style={[styles.stepValue, styles.stepInput, { color: tone.text }, Platform.OS === "web" && styles.noOutline]}
            accessibilityLabel={label}
          />
        ) : (
          <Text style={[styles.stepValue, { color: tone.text }]}>{value.toLocaleString()}</Text>
        )}
        <Pressable onPress={() => step(1)} disabled={value >= max} hitSlop={6} accessibilityLabel={`More ${label}`}>
          <Ionicons name="add" size={15} color={value >= max ? tone.muted : tone.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: 4 },
  stepLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  stepBox: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 5 },
  stepValue: { fontSize: 14, fontWeight: "800", minWidth: 22, textAlign: "center" },
  // Wide enough for "12.75", no box of its own inside the stepper's border
  stepInput: { width: 48, padding: 0 },
  noOutline: { outlineStyle: "none" },
});
