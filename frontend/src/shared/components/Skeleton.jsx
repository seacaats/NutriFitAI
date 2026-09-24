import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii } from "@/shared/theme/nutrifit";
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/**
 * A single skeleton placeholder block: a rounded rectangle that pulses
 * gently while real content loads, in place of a plain centered spinner.
 *
 * Deliberately just one primitive with `width`/`height`/`borderRadius`
 * props -- screens compose a handful of these into a shape that roughly
 * mirrors their real content (a row of stat cards, a few list rows, a
 * chart-sized block) instead of each screen inventing its own bespoke
 * skeleton component
 */
export default function Skeleton({ width = "100%", height = 16, borderRadius = radii.sm, style }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: tone.surfaceMuted, opacity },
        style,
      ]}
    />
  );
}