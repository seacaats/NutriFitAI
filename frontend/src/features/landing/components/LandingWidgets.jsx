import { COACH_REPLIES, DEMO_DIETS, DEMO_GOALS, MEAL_SLOTS, SCAN_MEALS, WORKOUT_PICKS } from "@/shared/constants/publicContent";
import { chipTints, colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

// The landing page's interactive previews. All sample data (see publicContent), nothing here is saved

const GLASSES = 8;
const RING_R = 48;
const RING_LEN = 2 * Math.PI * RING_R;
const WATER_BLUE = chipTints.blue.icon;
// Width changes ease in on the web
const EASE = { transitionProperty: "width", transitionDuration: "500ms" };

// A looping 0 -> 1 -> 0 value, for the laser line and the floating chips
function useLoop(ms, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, ms, delay]);
  return v;
}

function Chip({ label, active, onPress, styles }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ hovered }) => [styles.chip, active && styles.chipOn, hovered && !active && styles.chipHover]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

// ---- Hero: the scanner card ---------------------------------------------------------

export function ScanCard({ p }) {
  const styles = useMemo(() => createStyles(p), [p]);
  const [idx, setIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const meal = SCAN_MEALS[idx];
  const laser = useLoop(1600);

  // The card follows the pointer a little, set on the DOM so moving the mouse never re-renders
  const tiltRef = useRef(null);
  useEffect(() => {
    const el = tiltRef.current;
    if (!el?.addEventListener) return undefined;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg)`;
    };
    const reset = () => { el.style.transform = ""; };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", reset); };
  }, []);

  // A short fade between meals, like a new photo being read
  const scan = (i) => {
    if (i === idx) return;
    setScanning(true);
    setTimeout(() => { setIdx(i); setScanning(false); }, 300);
  };

  const macros = [
    { label: "Protein", ...meal.protein, color: colors.primary },
    { label: "Carbs", ...meal.carbs, color: colors.orange400 },
    { label: "Fat", ...meal.fat, color: WATER_BLUE },
  ];

  return (
    <View style={styles.scanWrap}>
      <View ref={tiltRef} style={styles.scan}>
        <View style={styles.viewfinder}>
          <Animated.View style={[styles.laser, { top: laser.interpolate({ inputRange: [0, 1], outputRange: ["14%", "86%"] }), opacity: laser.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) }]} />
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={[styles.stage, scanning && styles.stageBusy]}>
            <View style={styles.mealIcon}>
              <Ionicons name={meal.icon} size={28} color={p.accent} />
            </View>
            <View style={styles.detectTag}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.detectText}>{meal.name}</Text>
            </View>
          </View>
        </View>

        {/* Pick a meal to "scan" it */}
        <View style={styles.strip}>
          <View style={styles.chipRow}>
            {SCAN_MEALS.map((m, i) => (
              <Chip key={m.id} styles={styles} label={m.name.split(" ")[0]} active={i === idx} onPress={() => scan(i)} />
            ))}
          </View>
        </View>

        <View style={styles.result}>
          <View style={styles.resultHead}>
            <View style={styles.flex}>
              <Text style={styles.resultName}>{meal.name}</Text>
              <Text style={styles.resultSub}>{meal.sub}</Text>
            </View>
            <Text style={styles.resultKcal}>{meal.kcal} <Text style={styles.resultUnit}>kcal</Text></Text>
          </View>
          {macros.map((m) => (
            <View key={m.label} style={styles.macroRow}>
              <Text style={styles.macroLabel}>{m.label}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, EASE, { width: `${m.pct}%`, backgroundColor: m.color }]} />
              </View>
              <Text style={styles.macroGrams}>{m.g}g</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---- Feature cards: one small working demo each ---------------------------------------

// Pick a slot and the ring fills to what that meal adds to the day
export function FoodDemo({ p }) {
  const styles = useMemo(() => createStyles(p), [p]);
  const [slot, setSlot] = useState("Lunch");
  const share = MEAL_SLOTS.find((s) => s.label === slot).share;

  return (
    <View style={styles.demoBox}>
      <View style={styles.chipRow}>
        <Text style={styles.demoLabel}>Log sample meal to:</Text>
        {MEAL_SLOTS.map((s) => <Chip key={s.label} styles={styles} label={s.label} active={s.label === slot} onPress={() => setSlot(s.label)} />)}
      </View>
      <View style={styles.ringRow}>
        <View style={styles.ring}>
          {/* Turned on a wrapper so the ring starts at the top. The svg's own rotation props aren't valid DOM on the web */}
          <View style={styles.ringTurn}>
            <Svg width={96} height={96} viewBox="0 0 120 120">
              <Circle cx={60} cy={60} r={RING_R} stroke={p.track} strokeWidth={10} fill="none" />
              <Circle cx={60} cy={60} r={RING_R} stroke={colors.primary} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={RING_LEN} strokeDashoffset={RING_LEN * (1 - share)} />
            </Svg>
          </View>
          <View style={styles.ringCenter}>
            <Text style={styles.ringValue}>{Math.round(share * 100)}%</Text>
            <Text style={styles.ringNote}>of target</Text>
          </View>
        </View>
        <View style={styles.flex}>
          <Text style={styles.pill}>{slot}</Text>
          <Text style={styles.demoTitle}>Chicken Adobo (+280 kcal)</Text>
          <Text style={styles.demoNote}>Synced to your daily macro ring and your AI Coach</Text>
        </View>
      </View>
    </View>
  );
}

// The same meal answered in each coach tone
export function CoachDemo({ p }) {
  const styles = useMemo(() => createStyles(p), [p]);
  const [tone, setTone] = useState("friendly");
  return (
    <View style={styles.demoBox}>
      <View style={styles.chipRow}>
        {COACH_REPLIES.map((r) => <Chip key={r.key} styles={styles} label={r.label} active={r.key === tone} onPress={() => setTone(r.key)} />)}
      </View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{COACH_REPLIES.find((r) => r.key === tone).text}</Text>
      </View>
    </View>
  );
}

// Equipment picks the exercises, each can be ticked off
export function WorkoutDemo({ p }) {
  const styles = useMemo(() => createStyles(p), [p]);
  const [equipment, setEquipment] = useState("Dumbbells");
  const [done, setDone] = useState({ 0: true });
  return (
    <View style={styles.demoBox}>
      <View style={styles.chipRow}>
        {Object.keys(WORKOUT_PICKS).map((e) => <Chip key={e} styles={styles} label={e} active={e === equipment} onPress={() => setEquipment(e)} />)}
      </View>
      {WORKOUT_PICKS[equipment].map(([name, meta], i) => (
        <Pressable key={name} onPress={() => setDone((d) => ({ ...d, [i]: !d[i] }))} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[i] }} style={styles.exercise}>
          <Ionicons name={done[i] ? "checkbox" : "square-outline"} size={20} color={done[i] ? colors.primary : p.muted} />
          <Text style={[styles.exerciseName, done[i] && styles.exerciseDone]}>{name}</Text>
          <Text style={styles.exerciseMeta}>{meta}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Tap a glass to set the count, the hero's chip follows it
export function ProgressDemo({ p, water, setWater }) {
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={styles.demoBox}>
      <View style={styles.waterHead}>
        <Text style={styles.demoTitle}>Water ({water}/{GLASSES} glasses)</Text>
        <Pressable onPress={() => setWater((c) => (c < GLASSES ? c + 1 : 1))} accessibilityRole="button" style={({ hovered }) => [styles.chip, hovered && styles.chipHover]}>
          <Text style={styles.chipText}>+ Add glass</Text>
        </Pressable>
      </View>
      <View style={styles.glasses}>
        {Array.from({ length: GLASSES }, (_, i) => (
          <Pressable key={i} onPress={() => setWater(i + 1)} accessibilityLabel={`Set ${i + 1} glasses`} style={[styles.glass, i < water && styles.glassFull]} />
        ))}
      </View>
      <Text style={styles.demoNote}>Weight trend: <Text style={styles.strong}>-2.1 kg</Text> (sample)</Text>
    </View>
  );
}

// ---- How it works: the live preview of the active step ---------------------------------

export function StepPreview({ p, step, goal, setGoal, diet, setDiet, water }) {
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHead}>
        <View style={styles.dots}>{[0, 1, 2].map((i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}</View>
        <Text style={styles.pill}>Preview</Text>
      </View>

      {step === 0 && (
        <>
          <Text style={styles.demoTitle}>Personalize your profile</Text>
          <Text style={styles.demoNote}>Pick your goal and diet to see how NutriFitAI adapts:</Text>
          <Text style={styles.demoLabel}>Primary goal</Text>
          <View style={styles.chipRow}>{DEMO_GOALS.map((g) => <Chip key={g} styles={styles} label={g} active={g === goal} onPress={() => setGoal(g)} />)}</View>
          <Text style={styles.demoLabel}>Diet preference</Text>
          <View style={styles.chipRow}>{DEMO_DIETS.map((d) => <Chip key={d} styles={styles} label={d} active={d === diet} onPress={() => setDiet(d)} />)}</View>
          <Text style={styles.target}>Sample target: <Text style={styles.strong}>2,150 kcal/day</Text> · <Text style={styles.strong}>145g protein</Text></Text>
        </>
      )}

      {step === 1 && (
        <>
          <Text style={styles.demoTitle}>Log in seconds</Text>
          <Text style={styles.demoNote}>Everything you log updates your dashboard:</Text>
          {[["restaurant-outline", "Lunch scan", "+280 kcal · 28g P"], ["barbell-outline", "Workout", "35 mins"], ["water-outline", "Water and steps", `${water} glasses · 8,940 steps`]].map(([icon, label, value]) => (
            <View key={label} style={styles.logRow}>
              <Ionicons name={icon} size={18} color={p.accent} />
              <Text style={styles.logLabel}>{label}</Text>
              <Text style={styles.strong}>{value}</Text>
            </View>
          ))}
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.demoTitle}>Your AI coach</Text>
          <Text style={styles.demoNote}>Tailored to your <Text style={styles.strong}>{goal}</Text> and <Text style={styles.strong}>{diet}</Text> profile:</Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleMeta}>Coach · just now</Text>
            <Text style={styles.bubbleText}>Since your goal is {goal} on a {diet} plan, your Chicken Adobo is a solid pick. Have a high-protein snack and 2 glasses of water before your next workout.</Text>
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (p) => StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: "800", color: p.ink },

  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipHover: { backgroundColor: p.soft },
  chipText: { ...typography.caption, fontWeight: "700", color: p.ink },
  chipTextOn: { color: colors.white },
  pill: { alignSelf: "flex-start", ...typography.caption, fontWeight: "700", color: p.accent, backgroundColor: p.soft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" },

  // Hero scanner
  scanWrap: { width: "100%", maxWidth: 420, alignItems: "center" },
  float: { position: "absolute", zIndex: 2, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: p.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: p.line, paddingHorizontal: 14, paddingVertical: 10, shadowColor: p.shadow, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  floatTop: { top: -16, left: -12 },
  floatBottom: { bottom: 24, right: -16 },
  floatTitle: { ...typography.caption, fontWeight: "800", color: p.ink },
  floatNote: { ...typography.caption, fontSize: 11, color: p.muted },
  scan: { width: "100%", backgroundColor: p.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: p.line, overflow: "hidden", shadowColor: p.shadow, shadowOpacity: 0.1, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, transitionProperty: "transform", transitionDuration: "150ms" },
  viewfinder: { height: 210, backgroundColor: p.soft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  laser: { position: "absolute", left: "10%", right: "10%", height: 2, backgroundColor: colors.primary },
  corner: { position: "absolute", width: 22, height: 22, borderColor: p.accent },
  cornerTL: { top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  stage: { alignItems: "center", gap: 12, opacity: 1, transform: [{ scale: 1 }], transitionProperty: "opacity, transform", transitionDuration: "200ms" },
  stageBusy: { opacity: 0.25, transform: [{ scale: 0.9 }] },
  mealIcon: { width: 56, height: 56, borderRadius: radii.lg, backgroundColor: p.surface, alignItems: "center", justifyContent: "center" },
  detectTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: p.tag, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 5 },
  detectText: { ...typography.caption, fontWeight: "700", color: p.ink },
  strip: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: p.soft, borderTopWidth: 1, borderBottomWidth: 1, borderColor: p.line },
  result: { padding: spacing.lg, gap: spacing.md },
  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultName: { ...typography.h3, color: p.ink },
  resultSub: { ...typography.caption, color: p.muted, marginTop: 2 },
  resultKcal: { fontSize: 28, fontWeight: "800", color: p.ink },
  resultUnit: { ...typography.caption, fontWeight: "600", color: p.muted },
  macroRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  macroLabel: { ...typography.caption, fontSize: 13, color: p.text, width: 52 },
  track: { flex: 1, height: 8, borderRadius: radii.pill, backgroundColor: p.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill },
  macroGrams: { ...typography.caption, fontSize: 13, fontWeight: "700", color: p.ink, width: 36, textAlign: "right" },

  // Feature demos
  demoBox: { marginTop: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: p.line, backgroundColor: p.soft },
  demoLabel: { ...typography.caption, fontWeight: "700", color: p.muted, marginRight: 4 },
  demoTitle: { ...typography.body, fontWeight: "800", color: p.ink },
  demoNote: { ...typography.caption, color: p.text, lineHeight: 18 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4 },
  ring: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ringTurn: { transform: [{ rotate: "-90deg" }] },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { fontSize: 18, fontWeight: "800", color: p.ink },
  ringNote: { fontSize: 10, color: p.muted },
  bubble: { padding: spacing.md, borderRadius: radii.md, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, gap: 4 },
  bubbleMeta: { ...typography.caption, fontWeight: "700", color: p.accent },
  bubbleText: { ...typography.body, fontSize: 14, lineHeight: 21, color: p.ink },
  exercise: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radii.md, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line },
  exerciseName: { ...typography.body, flex: 1, fontSize: 14, fontWeight: "600", color: p.ink },
  exerciseDone: { textDecorationLine: "line-through", color: p.muted },
  exerciseMeta: { ...typography.caption, color: p.muted },
  waterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  glasses: { flexDirection: "row", gap: 6 },
  glass: { flex: 1, height: 22, borderRadius: 5, borderWidth: 1, borderColor: WATER_BLUE, backgroundColor: "transparent" },
  glassFull: { backgroundColor: WATER_BLUE },

  // How it works preview
  previewCard: { minWidth: 280, padding: spacing.xl, gap: spacing.sm, borderRadius: radii.xl, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, shadowColor: p.shadow, shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.track },
  dotOn: { backgroundColor: colors.primary },
  target: { ...typography.body, fontSize: 14, color: p.text, marginTop: spacing.xs },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radii.md, backgroundColor: p.soft },
  logLabel: { ...typography.body, flex: 1, fontSize: 14, color: p.text },
});