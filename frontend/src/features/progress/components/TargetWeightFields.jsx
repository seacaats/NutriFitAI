import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import ActionButton from "@/shared/components/ui/ActionButton";
import NumberBox from "@/shared/components/ui/NumberBox";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import SheetModal from "@/shared/components/ui/SheetModal";
import { decimalOrNull, WEEKLY_PACE, weightTargetProblem } from "@/shared/constants/goalOptions";
import { getScreenTones } from "@/shared/theme/nutrifitai";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// Target weight and weekly pace: a typed kg box each, like Profile. Values are
// strings while typing ("" = not set). Used by the onboarding and the
// Progress screen's dialog below
export default function TargetWeightFields({ target, pace, onTarget, onPace, currentKg, onSubmit, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={styles.gap}>
      <View>
        <Text style={[styles.label, { color: tone.text }]}>Target weight</Text>
        <NumberBox value={target} onChangeText={onTarget} unit="kg" label="Target weight in kilograms" onSubmit={onSubmit} decimal darkMode={darkMode} style={styles.box} />
        {!!currentKg && <Text style={[styles.muted, { color: tone.muted }]}>You&apos;re at {currentKg} kg now.</Text>}
      </View>
      <View>
        <Text style={[styles.label, { color: tone.text }]}>Weekly pace</Text>
        <NumberBox value={pace} onChangeText={onPace} unit="kg / week" label="Weekly pace in kilograms" onSubmit={onSubmit} decimal maxLength={4} darkMode={darkMode} style={styles.box} />
        <Text style={[styles.muted, { color: tone.muted }]}>
          {WEEKLY_PACE.min}–{WEEKLY_PACE.max} kg a week. Slower is easier to keep up.
        </Text>
      </View>
    </View>
  );
}

// Progress > Weight's "Set target" dialog. Starts from the saved values
// (`goals` from /progress), saves to the profile, then `onSaved` reloads
export function TargetWeightModal({ visible, goals, currentKg, onClose, onSaved, darkMode }) {
  const [target, setTarget] = useState("");
  const [pace, setPace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTarget(goals?.targetWeightKg != null ? String(goals.targetWeightKg) : "");
    setPace(goals?.weeklyPaceKg != null ? String(goals.weeklyPaceKg) : "");
    setError("");
  }, [visible]);

  async function save() {
    const problem = weightTargetProblem(target, pace);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient.patch("/profile", { targetWeightKg: decimalOrNull(target), weeklyPaceKg: decimalOrNull(pace) }, { auth: true });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your target.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetModal
      visible={visible}
      title="Weight target"
      subtitle="Both optional. Leave a box empty to clear it."
      onClose={onClose}
      darkMode={darkMode}
      footer={<ActionButton label="Save" onPress={save} loading={saving} darkMode={darkMode} />}
    >
      <TargetWeightFields target={target} pace={pace} onTarget={setTarget} onPace={setPace} currentKg={currentKg} onSubmit={save} darkMode={darkMode} />
      <ScreenError message={error} onDismiss={() => setError("")} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  label: { fontSize: 13, fontWeight: "700" },
  muted: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  box: { maxWidth: 220, marginTop: 6 },
});
