import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

// ♥ toggle used on exercise cards, the detail sheet and plan rows

const HEART = "#e5484d";

export default function FavoriteButton({ active, onPress, size = 18, style, filledBackground = false }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? "Remove from favorites" : "Add to favorites"}
      style={[filledBackground && heartStyles.bubble, style]}
    >
      <Ionicons name={active ? "heart" : "heart-outline"} size={size} color={active ? HEART : filledBackground ? "#ffffff" : "#9aa2b1"} />
    </Pressable>
  );
}

const heartStyles = StyleSheet.create({
  // Readable over photos: a dark translucent circle
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
