import { MAX_CONVERSATIONS } from "@/features/coach/hooks/useCoachChat";
import { getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Shown in place of the chat while it's empty, and gone as soon as the user
// sends something. Nothing here is saved to the conversation. At the
// conversation limit it explains that instead of offering prompts

const SUGGESTIONS = [
  "How am I doing on steps this week?",
  "Suggest a quick workout for today",
  "What should I eat after a workout?",
];

// Opened from "Ask AI Coach" on a scan or meal
const SUBJECT_SUGGESTIONS = [
  "Is it high in protein?",
  "How can I make this lighter?",
  "How does this fit my calories today?",
];

export default function CoachWelcome({ darkMode, atLimit = false, onPick, subject = null }) {
  const tone = getScreenTones(darkMode);
  const about = Boolean(subject && !subject.missing);

  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: tone.soft }]}>
        <Ionicons name={atLimit ? "albums-outline" : "hardware-chip"} size={26} color={shellColors.primary} />
      </View>

      {atLimit ? (
        <>
          <Text style={[styles.title, { color: tone.text }]}>You've reached {MAX_CONVERSATIONS} conversations</Text>
          <Text style={[styles.body, { color: tone.muted }]}>
            Delete one from History to start a new chat. You can still open and continue any of them.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: tone.text }]}>{about ? "Ask about this meal" : "Your NutriFitAI coach"}</Text>
          <Text style={[styles.body, { color: tone.muted }]}>
            {about
              ? "Nori can see the foods and nutrition above. Pick a question or ask your own."
              : "Ask about your steps, meals, workouts or goals. Answers use what you've logged in the app."}
          </Text>
          <View style={styles.chips}>
            {(about ? SUBJECT_SUGGESTIONS : SUGGESTIONS).map((s) => (
              <Pressable
                key={s}
                onPress={() => onPick?.(s)}
                style={[styles.chip, { borderColor: tone.border, backgroundColor: tone.card }]}
              >
                <Text style={[styles.chipText, { color: tone.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Pinned above the chat when the thread is about a scan or logged meal, so
 * it's clear what Nori is looking at. Sits on the right, the user's side,
 * since it's what the user brought into the chat. The label comes from the server
 * (describeSubject), the same for a new thread and a reopened one
 */
export function SubjectChip({ subject, darkMode }) {
  const tone = getScreenTones(darkMode);
  if (!subject) return null;

  const what = subject.kind === "scan" ? "Food scan" : capitalize(subject.mealType) || "Meal";
  const text = subject.missing
    ? `This ${subject.kind === "scan" ? "scan" : "meal"} has been deleted`
    : `${subject.label} · ${subject.caloriesKcal} kcal`;

  return (
    <View style={[styles.subject, { borderColor: tone.border, backgroundColor: tone.soft }]}>
      <Ionicons name={subject.kind === "scan" ? "camera-outline" : "restaurant-outline"} size={15} color={shellColors.primary} />
      <View style={styles.subjectCopy}>
        <Text style={[styles.subjectKind, { color: tone.muted }]}>ABOUT · {what.toUpperCase()}</Text>
        <Text style={[styles.subjectText, { color: tone.text }]} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 16, gap: 8 },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 380 },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10, maxWidth: 520 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "600" },
  fine: { fontSize: 11, marginTop: 10, textAlign: "center" },

  subject: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subjectCopy: { flexShrink: 1 },
  subjectKind: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  subjectText: { fontSize: 13, fontWeight: "700", marginTop: 1 },
});