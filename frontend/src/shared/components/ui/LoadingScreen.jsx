import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getPublicTones } from "@/shared/theme/nutrifitai";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// Timing, the usual practice (Material's progress guidance, React Suspense,
// most app shells): show nothing for a quick check, so it never flashes, and
// once the loader is up keep it long enough to read instead of blinking
const SHOW_AFTER_MS = 150;
const MIN_VISIBLE_MS = 500;

/**
 * Full-screen wait (session checks, sign-in): the logo with a spinner under
 * it, the same on web and mobile. `visible` false is just the background,
 * for the first moments before the loader is worth showing
 */
export default function LoadingScreen({ visible = true, message = "" }) {
  // Background follows the light/dark theme
  const { darkMode } = useTheme();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);

  return (
    <View style={styles.root}>
      {visible && (
        <>
          <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.logo} contentFit="contain" />
          <ActivityIndicator size="large" color={darkMode ? p.accent : colors.green600} />
          {!!message && <Text style={styles.message}>{message}</Text>}
        </>
      )}
    </View>
  );
}

/**
 * When to show LoadingScreen for a `loading` flag:
 *   - done in under 150ms: never shown
 *   - otherwise shown, and kept for at least 500ms
 * `pending` says to render LoadingScreen (instead of the screen), `visible`
 * whether it shows the logo yet.
 *   const gate = useLoadingGate(loading);
 *   if (gate.pending) return <LoadingScreen visible={gate.visible} />;
 */
export function useLoadingGate(loading) {
  const [visible, setVisible] = useState(false);
  const [holding, setHolding] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_AFTER_MS);
      return () => clearTimeout(t);
    }
    if (!visible) return undefined;
    // Finished while showing: keep it up for the rest of the minimum
    const left = MIN_VISIBLE_MS - (Date.now() - shownAt.current);
    if (left <= 0) {
      setVisible(false);
      return undefined;
    }
    setHolding(true);
    const t = setTimeout(() => {
      setHolding(false);
      setVisible(false);
    }, left);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return { pending: loading || holding || (visible && !loading), visible };
}

const createStyles = (p) => StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: p.bg },
  logo: { width: 96, height: 107 },
  message: { fontSize: 13, color: p.text },
});