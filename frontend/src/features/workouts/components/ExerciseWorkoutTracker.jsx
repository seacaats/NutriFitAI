import { chipTints, shellColors, colors as themeColors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * @param {object} props
 * @param {string} props.exerciseName
 * @param {number} [props.exerciseRef] wger exercise id — required to log a session
 * @param {(session: object) => void} [props.onFinish] called ONCE per workout,
 *   on completion or on abandoning after at least one set. Must not throw and
 *   must not block
 * @param {boolean} [props.darkMode]
 */
export default function ExerciseWorkoutTracker({
  exerciseName,
  exerciseRef,
  onFinish,
  darkMode = false,
}) {
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [completedSets, setCompletedSets] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  /**
   * elapsedSeconds is a counter, not a clock, so there was nothing here to
   * record as startedAt. Captured on Start instead
   */
  const startedAtRef = useRef(null);

  /**
   * Guards against double-logging one workout.
   *
   * Without it, completing the final set fires onFinish, and then closing or
   * resetting fires the abandon path too — two sessions for one workout, one of
   * them wrong. A ref rather than state because it must not trigger a render
   * and must be readable synchronously inside the same handler
   */
  const loggedRef = useRef(false);

  const isComplete = completedSets >= sets;
  const progress = Math.min((completedSets / sets) * 100, 100);
  const colors = {
    surface: darkMode ? "#252d23" : "#f4faF1",
    border: darkMode ? "#3c4a38" : "#dcebd6",
    text: darkMode ? themeColors.white : "#172015",
    muted: darkMode ? "#aab2bf" : themeColors.textMuted,
    control: darkMode ? "#353f33" : themeColors.white,
    track: darkMode ? "#465143" : "#dce7d8",
  };

  /**
   * Unmount is the other way a workout ends — closing the modal, navigating
   * away, or the screen being torn down. Same abandon path.
   *
   * The ref dance is because this effect must run only on unmount (empty deps)
   * while reading values that change every second; closing over them directly
   * would capture the values from first render
   */
  const abandonRef = useRef(() => {});
  useEffect(() => () => abandonRef.current(), []);

  useEffect(() => {
    if (!isActive || isComplete) return undefined;
    const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive, isComplete]);

  const adjust = (setter, amount, minimum, maximum) => {
    if (hasStarted) return;
    setter((value) => Math.min(Math.max(value + amount, minimum), maximum));
  };

  /**
   * Builds the payload from current values. Kept separate so the complete and
   * abandon paths cannot drift apart
   */
  const buildSession = (setsDone, status) => ({
    exerciseRef,
    exerciseName,
    targetSets: sets,
    targetReps: reps,
    completedSets: setsDone,
    startedAt: startedAtRef.current,
    completedAt: new Date().toISOString(),
    actualDurationSeconds: elapsedSeconds,
    status,
  });

  const logOnce = (setsDone, status) => {
    if (loggedRef.current) return;
    if (!exerciseRef || !startedAtRef.current) return; // nothing loggable
    loggedRef.current = true;
    onFinish?.(buildSession(setsDone, status));
  };

  const completeSet = () => {
    setCompletedSets((value) => {
      const next = Math.min(value + 1, sets);
      if (next === sets) {
        setIsActive(false);
        logOnce(next, "completed");
      }
      return next;
    });
  };

  /**
   * Records partial work before clearing
   *
   * A user who finishes one of three sets and walks away has done something
   * real. Dropping it would make the coach\'s 7-day count and the weekly goal
   * both understate reality — the app would tell them they did nothing
   *
   * Silent on purpose: prompting "save your partial workout?" turns exercise
   * into bookkeeping
   */
  const abandon = () => {
    if (hasStarted && completedSets > 0) logOnce(completedSets, "skipped");
  };

  const reset = () => {
    abandon();
    loggedRef.current = false;
    startedAtRef.current = null;
    setCompletedSets(0);
    setElapsedSeconds(0);
    setIsActive(false);
    setHasStarted(false);
  };

  // Refreshed every render so the unmount handler sees current values
  abandonRef.current = () => {
    if (hasStarted && completedSets > 0 && !loggedRef.current) {
      loggedRef.current = true;
      onFinish?.(buildSession(completedSets, "skipped"));
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>CUSTOM WORKOUT</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{exerciseName}</Text>
        </View>
        {hasStarted && (
          <View style={styles.timerPill}>
            <Ionicons name="timer-outline" size={14} color={shellColors.primary} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        )}
      </View>

      {!hasStarted ? (
        <>
          <Text style={[styles.helper, { color: colors.muted }]}>Customize your target before starting.</Text>
          <View style={styles.configRow}>
            <Counter label="Sets" value={sets} onDecrease={() => adjust(setSets, -1, 1, 10)} onIncrease={() => adjust(setSets, 1, 1, 10)} colors={colors} />
            <Counter label="Reps per set" value={reps} onDecrease={() => adjust(setReps, -1, 1, 100)} onIncrease={() => adjust(setReps, 1, 1, 100)} colors={colors} />
          </View>
          <Pressable
            onPress={() => {
              startedAtRef.current = new Date().toISOString();
              loggedRef.current = false;
              setHasStarted(true);
              setIsActive(true);
            }}
            style={styles.startButton}
          >
            <Ionicons name="play" size={16} color={themeColors.white} />
            <Text style={styles.primaryButtonText}>Start Workout</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.liveSummary}>
            <View>
              <Text style={[styles.liveLabel, { color: colors.muted }]}>{isComplete ? "WORKOUT COMPLETE" : "CURRENT TARGET"}</Text>
              <Text style={[styles.liveTarget, { color: colors.text }]}>{isComplete ? `${sets} sets finished` : `Set ${completedSets + 1} of ${sets} · ${reps} reps`}</Text>
            </View>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.track }]}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <View style={styles.setDots}>
            {Array.from({ length: sets }, (_, index) => (
              <View key={index} style={[styles.setDot, { borderColor: colors.border }, index < completedSets && styles.setDotDone]}>
                {index < completedSets ? <Ionicons name="checkmark" size={13} color={themeColors.white} /> : <Text style={[styles.setDotText, { color: colors.muted }]}>{index + 1}</Text>}
              </View>
            ))}
          </View>
          {!isComplete && (
            <View style={styles.actionRow}>
              <Pressable onPress={() => setIsActive((value) => !value)} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.control }]}>
                <Ionicons name={isActive ? "pause" : "play"} size={15} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{isActive ? "Pause" : "Resume"}</Text>
              </Pressable>
              <Pressable onPress={completeSet} style={styles.completeButton}>
                <Ionicons name="checkmark-circle" size={16} color={themeColors.white} />
                <Text style={styles.primaryButtonText}>Complete Set</Text>
              </Pressable>
            </View>
          )}
          {isComplete && (
            <View style={styles.completeMessage}>
              <Ionicons name="trophy" size={20} color="#f59e0b" />
              <Text style={[styles.completeText, { color: colors.text }]}>Great work! You completed {sets * reps} total reps.</Text>
            </View>
          )}
          <Pressable onPress={reset} style={styles.resetButton}><Text style={[styles.resetText, { color: colors.muted }]}>{isComplete ? "Start again" : "Reset workout"}</Text></Pressable>
        </>
      )}
    </View>
  );
}

function Counter({ label, value, onDecrease, onIncrease, colors }) {
  return (
    <View style={[styles.counter, { backgroundColor: colors.control, borderColor: colors.border }]}>
      <Text style={[styles.counterLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.counterControls}>
        <Pressable onPress={onDecrease} style={[styles.counterButton, { borderColor: colors.border }]}><Ionicons name="remove" size={16} color={colors.text} /></Pressable>
        <Text style={[styles.counterValue, { color: colors.text }]}>{value}</Text>
        <Pressable onPress={onIncrease} style={[styles.counterButton, { borderColor: colors.border }]}><Ionicons name="add" size={16} color={colors.text} /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  eyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { marginTop: 3, fontSize: 17, fontWeight: "800", maxWidth: 420 }, helper: { marginTop: 7, fontSize: 11 },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: chipTints.green.light, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 }, timerText: { color: "#347a22", fontSize: 11, fontWeight: "800" },
  configRow: { flexDirection: "row", gap: 10, marginTop: 14 }, counter: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 11 }, counterLabel: { fontSize: 9, fontWeight: "700" }, counterControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }, counterButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" }, counterValue: { minWidth: 32, textAlign: "center", fontSize: 20, fontWeight: "800" },
  startButton: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8, backgroundColor: shellColors.primary, paddingVertical: 12 }, primaryButtonText: { color: themeColors.white, fontSize: 12, fontWeight: "800" },
  liveSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 15 }, liveLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, liveTarget: { marginTop: 3, fontSize: 16, fontWeight: "800" }, progressPercent: { color: shellColors.primary, fontSize: 17, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 }, progressFill: { height: 8, borderRadius: 4, backgroundColor: shellColors.primary }, setDots: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 }, setDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, setDotDone: { backgroundColor: shellColors.primary, borderColor: shellColors.primary }, setDotText: { fontSize: 10, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 }, secondaryButton: { flex: 0.7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingVertical: 11 }, secondaryButtonText: { fontSize: 11, fontWeight: "700" }, completeButton: { flex: 1.3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, backgroundColor: shellColors.primary, paddingVertical: 11 },
  completeMessage: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.12)", marginTop: 14, padding: 11 }, completeText: { flex: 1, fontSize: 11, fontWeight: "700" }, resetButton: { alignItems: "center", paddingTop: 12 }, resetText: { fontSize: 10, fontWeight: "700", textDecorationLine: "underline" },
});