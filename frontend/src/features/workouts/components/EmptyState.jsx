import { getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// Centered icon + text for empty lists and tabs
export default function EmptyState({ icon, title, body, action, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: tone.soft }]}>
        <Ionicons name={icon} size={26} color={shellColors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: tone.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: tone.muted }]}>{body}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyBody: { fontSize: fs(14, 13), textAlign: "center", maxWidth: 360, lineHeight: 19, marginBottom: 6 },
});
