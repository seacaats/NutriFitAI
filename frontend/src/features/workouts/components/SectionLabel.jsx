import { getScreenTones } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// Small uppercase heading above a group of fields
export default function SectionLabel({ children, darkMode }) {
  const tone = getScreenTones(darkMode);
  return <Text style={[styles.section, { color: tone.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: { fontSize: fs(13, 11), fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
});
