import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

// Primary (filled) or secondary (outlined) button. Text only, like every
// other button in the app
export default function ActionButton({ label, onPress, variant = "primary", disabled, loading, darkMode, compact = false, active = false }) {
  const tone = getScreenTones(darkMode);
  const primary = variant === "primary";
  const danger = variant === "danger";
  // A toggled-on secondary button looks like a selected filter chip: primary
  // border and text over the soft tint
  const selected = active && !primary && !danger;
  const color = primary ? "#ffffff" : danger ? "#e5484d" : selected ? shellColors.primary : tone.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        primary
          ? { backgroundColor: shellColors.primary }
          : { borderWidth: 1, borderColor: danger ? "#e5484d" : selected ? shellColors.primary : tone.border },
        selected && { backgroundColor: tone.soft },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.btnText, compact && styles.btnTextCompact, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { fontSize: 13, fontWeight: "700" },
  btnTextCompact: { fontSize: 12 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});