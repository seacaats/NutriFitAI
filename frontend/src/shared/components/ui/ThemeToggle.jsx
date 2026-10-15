import { useTheme } from "@/shared/context/ThemeContext";
import { getPublicTones, radii } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

// Sun/moon button for the public pages' headers. Round and icon-only so it
// fits beside the other buttons, with the same hover as the header links
export default function ThemeToggle({ style }) {
  const { darkMode, toggleTheme } = useTheme();
  const p = getPublicTones(darkMode);

  return (
    <Pressable
      onPress={toggleTheme}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      style={({ hovered }) => [styles.btn, hovered && { backgroundColor: p.hover }, style]}
    >
      <Ionicons name={darkMode ? "sunny-outline" : "moon-outline"} size={20} color={p.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 38, height: 38, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
});