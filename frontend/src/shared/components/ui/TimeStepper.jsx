import { getScreenTones } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Quiet hours: the window turned on by default, then adjusted in 30-minute
// steps. The window may cross midnight; the server reads it in the user's zone.
// Used by Settings and the onboarding
export const QUIET_START = "22:00";
export const QUIET_END = "07:00";
const QUIET_STEP_MIN = 30;

// "HH:MM" moved by `delta` minutes, wrapping around midnight
function shiftTime(hhmm, delta) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// 22:00 -> 10:00 PM
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// − 10:00 PM +
export default function TimeStepper({ value, onChange, disabled, darkMode }) {
  const tone = getScreenTones(darkMode);
  const step = (delta, icon, label) => (
    <Pressable
      onPress={() => onChange(shiftTime(value, delta))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.stepBtn, { borderColor: tone.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={16} color={tone.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {step(-QUIET_STEP_MIN, "remove", "Earlier")}
      <Text style={[styles.stepValue, { color: tone.text }]}>{formatTime(value)}</Text>
      {step(QUIET_STEP_MIN, "add", "Later")}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 76, textAlign: "center", fontSize: 14, fontWeight: "600" },
});
