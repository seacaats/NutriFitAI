import { colors, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

const BARS = [0.5, 0.9, 0.65, 1, 0.55];
// Warn when this little time is left, the clip stops by itself at the limit
const WARN_SECONDS = 10;

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// A pulsing dot and a few moving bars, so it is obvious the mic is live.
// The bars are decoration, they don't follow the volume
function Pulse() {
  const native = Platform.OS !== "web";
  const dot = useRef(new Animated.Value(1)).current;
  const bars = useRef(BARS.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(dot, { toValue: 0.3, duration: 700, useNativeDriver: native }),
        Animated.timing(dot, { toValue: 1, duration: 700, useNativeDriver: native }),
      ])),
      ...bars.map((v, i) => Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: BARS[i], duration: 350 + i * 90, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0.25, duration: 350 + i * 90, useNativeDriver: native }),
      ]))),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dot, bars, native]);

  return (
    <View style={styles.pulse}>
      <Animated.View style={[styles.dot, { opacity: dot }]} />
      <View style={styles.bars}>
        {bars.map((v, i) => <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: v }] }]} />)}
      </View>
    </View>
  );
}

// Replaces the text box while recording or turning the clip into text.
// Cancel throws the clip away; the check ends it and puts the text in the box
export default function VoiceRecordingBar({ voice, textStyle }) {
  if (voice.transcribing) {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={shellColors.primary} />
        <Text style={[styles.label, textStyle]}>Turning your voice into text...</Text>
      </View>
    );
  }

  const left = Math.max(0, voice.limitSeconds - voice.seconds);

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <Pressable onPress={voice.cancel} hitSlop={8} accessibilityLabel="Cancel recording" style={styles.iconBtn}>
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>

      <Pulse />
      <Text style={[styles.label, textStyle]}>Listening</Text>
      <Text style={[styles.time, left <= WARN_SECONDS && styles.timeWarn]}>
        {left <= WARN_SECONDS ? `${left}s left` : clock(voice.seconds)}
      </Text>

      <View style={styles.spacer} />

      <Pressable onPress={voice.stop} hitSlop={8} accessibilityLabel="Finish recording" style={styles.doneBtn}>
        <Ionicons name="checkmark" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pulse: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  bars: { flexDirection: "row", alignItems: "center", gap: 3, height: 20 },
  bar: { width: 3, height: 20, borderRadius: 2, backgroundColor: shellColors.primary },
  label: { fontSize: 14, fontWeight: "600" },
  time: { fontSize: 13, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  timeWarn: { color: colors.danger, fontWeight: "700" },
  spacer: { flex: 1 },
  doneBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: shellColors.primary, alignItems: "center", justifyContent: "center" },
});