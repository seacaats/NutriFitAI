import { fetchCategories, fetchEquipment, fetchMuscles } from "@/features/workouts/hooks/useWorkoutApi";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ActionButton from "@/shared/components/ui/ActionButton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import SheetModal from "@/shared/components/ui/SheetModal";
import { NO_WORKOUT_PREFS } from "@/shared/constants/goalOptions";
import { radii } from "@/shared/theme/nutrifitai";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Chip from "./Chip";
import SectionLabel from "./SectionLabel";

// Workout preferences picker for onboarding and profile forms.
// Configures preferred categories, equipment, and target muscle groups.

// Fetches options for workout preference selections
export function useWorkoutOptions(enabled = true) {
  const [categories, setCategories] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [muscleList, setMuscleList] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    Promise.all([fetchCategories(), fetchEquipment(), fetchMuscles()])
      .then(([cats, equipment, muscles]) => {
        setCategories(cats || []);
        setEquipmentList(equipment || []);
        setMuscleList(muscles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { categories, equipmentList, muscleList, loading };
}

// Generates a human-readable summary of workout preferences
export function describeWorkoutPrefs(prefs, { categories, equipmentList, muscleList = [] }) {
  if (!prefs) return "";
  const parts = [];
  const names = (ids, list) => ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean).join(", ");
  if (prefs.categoryIds?.length) parts.push(names(prefs.categoryIds, categories));
  if (prefs.equipment === "none") parts.push("Bodyweight only");
  else if (prefs.equipment === "any") parts.push(names(prefs.equipmentIds || [], equipmentList) || "Needs equipment");
  if (prefs.muscleIds?.length) parts.push(names(prefs.muscleIds, muscleList));
  if (prefs.secondaryMuscleIds?.length) parts.push(`${names(prefs.secondaryMuscleIds, muscleList)} (secondary)`);
  return parts.filter(Boolean).join(" · ");
}

const toggle = (ids, id) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export default function WorkoutPrefsPicker({ value, onChange, options, darkMode }) {
  const prefs = value || NO_WORKOUT_PREFS;
  const { categories, equipmentList, muscleList = [], loading } = options;
  const set = (changes) => onChange({ ...prefs, ...changes });
  const muscleIds = prefs.muscleIds || [];
  const secondaryIds = prefs.secondaryMuscleIds || [];

  // Toggle muscle selection between primary and secondary groups
  const toggleMuscle = (id, key) => {
    const main = key === "muscleIds";
    set({
      [key]: toggle(main ? muscleIds : secondaryIds, id),
      [main ? "secondaryMuscleIds" : "muscleIds"]: (main ? secondaryIds : muscleIds).filter((x) => x !== id),
    });
  };

  if (loading) {
    return (
      <View style={styles.chips}>
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={72} height={34} borderRadius={radii.sm} />)}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SectionLabel darkMode={darkMode}>Categories</SectionLabel>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={prefs.categoryIds.includes(c.id)}
            onPress={() => set({ categoryIds: toggle(prefs.categoryIds, c.id) })}
            darkMode={darkMode}
          />
        ))}
      </View>

      <SectionLabel darkMode={darkMode}>Equipment</SectionLabel>
      <View style={styles.chips}>
        <Chip label="Any" active={prefs.equipment == null} onPress={() => set({ equipment: null, equipmentIds: [] })} darkMode={darkMode} />
        <Chip label="No equipment" active={prefs.equipment === "none"} onPress={() => set({ equipment: "none", equipmentIds: [] })} darkMode={darkMode} />
        <Chip label="Needs equipment" active={prefs.equipment === "any"} onPress={() => set({ equipment: "any" })} darkMode={darkMode} />
      </View>

      {prefs.equipment === "any" && equipmentList.length > 0 && (
        <View style={[styles.chips, styles.nested]}>
          {equipmentList.map((e) => (
            <Chip
              key={e.id}
              label={e.name}
              active={prefs.equipmentIds.includes(e.id)}
              onPress={() => set({ equipmentIds: toggle(prefs.equipmentIds, e.id) })}
              darkMode={darkMode}
            />
          ))}
        </View>
      )}

      {muscleList.length > 0 && (
        <>
          <SectionLabel darkMode={darkMode}>Muscles worked</SectionLabel>
          <View style={styles.chips}>
            {muscleList.map((m) => (
              <Chip key={m.id} label={m.name} active={muscleIds.includes(m.id)} onPress={() => toggleMuscle(m.id, "muscleIds")} darkMode={darkMode} />
            ))}
          </View>

          <SectionLabel darkMode={darkMode}>Secondary muscles</SectionLabel>
          <View style={styles.chips}>
            {muscleList.map((m) => (
              <Chip key={m.id} label={m.name} active={secondaryIds.includes(m.id)} onPress={() => toggleMuscle(m.id, "secondaryMuscleIds")} darkMode={darkMode} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// Workout preferences modal dialog for updating user exercise filters
export function WorkoutPrefsModal({ visible, onClose, onSaved, options, darkMode }) {
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setValue(null);
    setError("");
    apiClient.get("/profile", { auth: true })
      .then((data) => setValue(data?.workoutPrefs || NO_WORKOUT_PREFS))
      .catch(() => setValue(NO_WORKOUT_PREFS));
  }, [visible]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiClient.patch("/profile", { workoutPrefs: value }, { auth: true });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetModal
      visible={visible}
      title="Workout preferences"
      subtitle="Matching exercises show first in Browse, with everything else after them."
      onClose={onClose}
      darkMode={darkMode}
      footer={(
        <>
          <ActionButton variant="secondary" label="Reset" onPress={() => setValue(NO_WORKOUT_PREFS)} disabled={!value || saving} darkMode={darkMode} />
          <ActionButton label="Save" onPress={save} loading={saving} disabled={!value} darkMode={darkMode} />
        </>
      )}
    >
      <WorkoutPrefsPicker value={value} onChange={setValue} options={{ ...options, loading: options.loading || !value }} darkMode={darkMode} />
      <ScreenError message={error} onDismiss={() => setError("")} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nested: { paddingLeft: 12 },
});
