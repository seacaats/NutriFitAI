import { colors, radii, spacing } from "@/theme/nutrifit";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({
  progress = 0,
  color = colors.primary,
  height = 8,
}: {
  progress?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, backgroundColor: color, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  track: { backgroundColor: "#E4E4E4", width: "100%", overflow: "hidden" },
  fill: {},
});
