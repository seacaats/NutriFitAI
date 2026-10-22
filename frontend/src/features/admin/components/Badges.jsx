import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getChipTint, getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text, View } from "react-native";

/**
 * Maps audit log severity onto the four-tint palette:
 *   info     green   routine, expected
 *   notice   blue    notable event
 *   warning  orange  failure or manual override
 *   critical purple  privileged action or sensitive data access
 */
const SEVERITY_TINT = {
  info: "green",
  notice: "blue",
  warning: "orange",
  critical: "purple",
};

export function SeverityBadge({ severity }) {
  const { darkMode } = useTheme();
  const tint = getChipTint(SEVERITY_TINT[severity] || "green", darkMode);

  return (
    <View style={[styles.badge, { backgroundColor: tint.backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: tint.icon }]} />
      <Text style={[styles.badgeText, { color: darkMode ? colors.white : colors.nearBlack }]}>
        {severity}
      </Text>
    </View>
  );
}

/**
 * Role badge. Standard user accounts use a plain outline so elevated roles stand out visually.
 */
const ROLE_TINT = {
  admin: "blue",
};

export function RoleBadge({ role }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const tintName = ROLE_TINT[role];

  if (!tintName) {
    return (
      <View style={[styles.badge, styles.badgeOutline, { borderColor: tone.border }]}>
        <Text style={[styles.badgeText, { color: tone.muted }]}>user</Text>
      </View>
    );
  }

  const tint = getChipTint(tintName, darkMode);
  return (
    <View style={[styles.badge, { backgroundColor: tint.backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: tint.icon }]} />
      <Text style={[styles.badgeText, { color: darkMode ? colors.white : colors.nearBlack }]}>
        {role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeOutline: { borderWidth: 1, backgroundColor: "transparent" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
});
