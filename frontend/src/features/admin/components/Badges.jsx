import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getChipTint, getScreenTones, radii } from "@/shared/theme/nutrifit";
import { StyleSheet, Text, View } from "react-native";

/**
 * Severity maps onto the EXISTING four-tint palette rather than a new one
 *
 *   info     green   routine, expected
 *   notice   blue    worth seeing in a list
 *   warning  orange  a failure or a manual override
 *   critical purple  privileged, or destroys/exposes data
 *
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
 * Role badge. An ordinary user gets a plain outline rather than a tint --
 * nearly every row in the users table is one, and tinting all of them would
 * turn the column into wallpaper with nothing standing out. Only elevated
 * roles are coloured 
 */
const ROLE_TINT = {
  admin: "blue",
  superadmin: "purple",
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
