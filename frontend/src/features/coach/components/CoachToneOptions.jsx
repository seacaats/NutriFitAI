import { PlanModal } from "@/features/workouts/components/PlanParts";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { COACH_TONES, DEFAULT_COACH_TONE } from "@/shared/constants/goalOptions";
import { UntrackedSkeletons } from "@/shared/state/skeletonTracker";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Coach tone: the three choices as tappable rows. Used by the onboarding
// and the AI Coach screen's tone dialog; Settings has the compact switch.
// Tapping the picked one again clears it (null), back to the default voice
// `loading` shows placeholder rows until the saved tone arrives
export default function CoachToneOptions({ value, onChange, disabled, darkMode, loading = false }) {
  const tone = getScreenTones(darkMode);
  // Inside a dialog, so it doesn't hide the page's scrollbar
  if (loading) {
    return (
      <UntrackedSkeletons>
        <View style={styles.list}>
          {COACH_TONES.map((o) => <Skeleton key={o.value} height={56} borderRadius={radii.md} />)}
        </View>
      </UntrackedSkeletons>
    );
  }
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {COACH_TONES.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(active ? null : o.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            style={[
              styles.option,
              { borderColor: active ? shellColors.primary : tone.border, backgroundColor: active ? tone.soft : tone.card },
            ]}
          >
            <Ionicons name={o.icon} size={20} color={active ? shellColors.primary : tone.muted} />
            <View style={styles.flex1}>
              <Text style={[styles.title, { color: tone.text }]}>{o.label}</Text>
              <Text style={[styles.hint, { color: tone.muted }]}>{o.hint}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={20} color={shellColors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// The AI Coach header's tone button and its dialog. A tap saves right away,
// and the next reply uses it
export function CoachToneButton({ color, darkMode }) {
  const [open, setOpen] = useState(false);
  // undefined while loading, null when none is picked
  const [value, setValue] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Read fresh on each open, Settings may have changed it since
  useEffect(() => {
    if (!open) return;
    apiClient.get("/profile", { auth: true })
      .then((data) => setValue(data?.coachTone ?? null))
      .catch(() => setValue((v) => v ?? null));
  }, [open]);

  async function choose(next) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError("");
    try {
      await apiClient.patch("/profile", { coachTone: next }, { auth: true });
    } catch (err) {
      setValue(previous);
      setError(err instanceof ApiClientError ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Coach tone">
        <Ionicons name="color-wand-outline" size={20} color={color} />
      </Pressable>
      <PlanModal
        visible={open}
        title="Coach tone"
        subtitle={`How Nori talks to you, from the next reply. None picked is ${DEFAULT_TONE_LABEL}.`}
        onClose={() => { setOpen(false); setError(""); }}
        darkMode={darkMode}
      >
        <CoachToneOptions value={value} onChange={choose} disabled={saving} loading={value === undefined} darkMode={darkMode} />
        <ScreenError message={error} onDismiss={() => setError("")} />
      </PlanModal>
    </>
  );
}

const DEFAULT_TONE_LABEL = COACH_TONES.find((t) => t.value === DEFAULT_COACH_TONE).label.toLowerCase();

const styles = StyleSheet.create({
  list: { gap: 10 },
  flex1: { flex: 1 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radii.md, padding: 14, minHeight: 56 },
  title: { fontSize: 14, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
});