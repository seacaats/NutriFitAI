import ExerciseWorkoutTracker from "@/features/workouts/components/ExerciseWorkoutTracker";
import { fetchCategories, fetchEquipment, fetchExerciseInfoPage, findWorkoutByName, getEnglishTranslation } from "@/features/workouts/hooks/useWorkoutApi";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { FormAlert, RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import PlanButton from "@/shared/components/ui/PlanButton";
import Stepper from "@/shared/components/ui/Stepper";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Chip, PlanModal, SectionLabel } from "./PlanParts";
import { WorkoutFilters } from "./PlanTiles";

// Workouts dialogs: scheduling, the routine editor and the routine player

// Pick a day (today + the next 6) and a time for an exercise or routine.
// scheduledFor is an INSTANT (a time of day), so local Date math is right here

const DAYS_AHEAD = 7;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(offset, date) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tmrw";
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

// Hour and minute are kept as the typed text (12-hour clock), so a field
// can be empty mid-edit. parseTime turns them into 24h numbers, or null
function parseTime({ hour, minute, period }) {
  const h = Number(hour);
  const m = Number(minute);
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  return { hour: (h % 12) + (period === "PM" ? 12 : 0), minute: m };
}

// Suggests the next 5-minute mark at least 15 minutes out. Just a starting
// point, any minute can be typed in
function defaultSlot() {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const offset = Math.round((new Date(d).setHours(0, 0, 0, 0) - startOfToday()) / 86400000);
  const h = d.getHours();
  return {
    offset: Math.min(offset, DAYS_AHEAD - 1),
    hour: String(h % 12 === 0 ? 12 : h % 12),
    minute: String(d.getMinutes()).padStart(2, "0"),
    period: h < 12 ? "AM" : "PM",
  };
}

// "__ : __  AM | PM", every part visible at once. Typed digits,
// a two-way toggle for the period
function TimeField({ slot, onChange, darkMode }) {
  const tone = getScreenTones(darkMode);
  const digits = (v) => v.replace(/\D/g, "").slice(0, 2);
  const box = [scheduleStyles.timeBox, { borderColor: tone.border, color: tone.text }];

  return (
    <View style={scheduleStyles.timeRow}>
      <RingInput
        value={slot.hour}
        onChangeText={(v) => onChange({ hour: digits(v) })}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="hh"
        placeholderTextColor={tone.muted}
        accessibilityLabel="Hour"
        style={box}
      />
      <Text style={[scheduleStyles.colon, { color: tone.text }]}>:</Text>
      <RingInput
        value={slot.minute}
        onChangeText={(v) => onChange({ minute: digits(v) })}
        onBlur={() => slot.minute.length === 1 && onChange({ minute: slot.minute.padStart(2, "0") })}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="mm"
        placeholderTextColor={tone.muted}
        accessibilityLabel="Minute"
        style={box}
      />
      <View style={[scheduleStyles.period, { borderColor: tone.border }]}>
        {["AM", "PM"].map((p) => {
          const active = slot.period === p;
          return (
            <Pressable
              key={p}
              onPress={() => onChange({ period: p })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[scheduleStyles.periodBtn, active && { backgroundColor: shellColors.primary }]}
            >
              <Text style={[scheduleStyles.periodText, { color: active ? "#fff" : tone.text }]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @param {{ kind: 'exercise'|'routine', refId: string|number, name: string,
 *           targetSets?: number, targetReps?: number }} target
 * @param {(body: object) => Promise<any>} onSubmit throws with the server message
 */
export function ScheduleModal({ visible, target, onClose, onSubmit, darkMode }) {
  const tone = getScreenTones(darkMode);
  const [slot, setSlot] = useState(defaultSlot);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Fresh defaults every time the dialog opens
  useEffect(() => {
    if (!visible) return;
    setSlot(defaultSlot());
    setSets(target?.targetSets || 3);
    setReps(target?.targetReps || 10);
    setError("");
  }, [visible, target]);

  const days = useMemo(() => {
    const base = startOfToday();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { offset: i, date: d };
    });
  }, [visible]);

  const time = parseTime(slot);
  const when = useMemo(() => {
    if (!time) return null;
    const d = new Date(days[slot.offset]?.date || startOfToday());
    d.setHours(time.hour, time.minute, 0, 0);
    return d;
  }, [days, slot.offset, time?.hour, time?.minute]);

  const inPast = Boolean(when) && when.getTime() <= Date.now();

  async function submit() {
    if (!when) {
      setError("Enter a time like 7:30, from 1:00 to 12:59.");
      return;
    }
    if (inPast) {
      setError("Please pick a time later than now.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { kind: target.kind, scheduledFor: when.toISOString() };
      if (target.kind === "routine") {
        body.routineId = String(target.refId);
      } else {
        Object.assign(body, {
          exerciseRef: Number(target.refId),
          exerciseName: target.name,
          targetSets: sets,
          targetReps: reps,
        });
      }
      await onSubmit(body);
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't schedule that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanModal
      visible={visible}
      onClose={onClose}
      darkMode={darkMode}
      title={target?.rescheduleId ? "Reschedule workout" : "Schedule workout"}
      subtitle={target ? `${target.name} · within the next 7 days` : ""}
      footer={(
        <>
          <PlanButton label="Cancel" variant="secondary" onPress={onClose} darkMode={darkMode} />
          <PlanButton
            label={target?.rescheduleId ? "Reschedule" : "Schedule"}
            onPress={submit}
            loading={saving}
            darkMode={darkMode}
          />
        </>
      )}
    >
      <SectionLabel darkMode={darkMode}>Day</SectionLabel>
      <View style={scheduleStyles.wrapRow}>
        {days.map(({ offset, date }) => (
          <Chip
            key={offset}
            label={dayLabel(offset, date)}
            sublabel={date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            active={slot.offset === offset}
            onPress={() => setSlot((s) => ({ ...s, offset }))}
            darkMode={darkMode}
          />
        ))}
      </View>

      <SectionLabel darkMode={darkMode}>Time</SectionLabel>
      <TimeField slot={slot} onChange={(part) => setSlot((s) => ({ ...s, ...part }))} darkMode={darkMode} />

      {target?.kind === "exercise" && !target.rescheduleId && (
        <View style={scheduleStyles.row}>
          <Stepper label="Sets" value={sets} onChange={setSets} min={1} max={20} darkMode={darkMode} />
          <Stepper label="Reps" value={reps} onChange={setReps} min={1} max={200} darkMode={darkMode} />
        </View>
      )}

      <Text style={[scheduleStyles.summary, { color: inPast || !when ? "#e5484d" : tone.text }]}>
        {when
          ? when.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          : "Enter a valid time"}
        {inPast ? " (already passed)" : ""}
      </Text>

      <FormAlert message={error} onDismiss={() => setError("")} />
    </PlanModal>
  );
}

const scheduleStyles = StyleSheet.create({
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  summary: { fontSize: 14, fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeBox: {
    width: 56, height: 44, borderWidth: 1, borderRadius: 10,
    textAlign: "center", fontSize: 18, fontWeight: "700",
  },
  colon: { fontSize: 20, fontWeight: "800" },
  period: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden", marginLeft: 4 },
  periodBtn: { paddingHorizontal: 14, height: 42, justifyContent: "center" },
  periodText: { fontSize: 14, fontWeight: "800" },
});

// Add a workout of your own to the catalog: same fields as a synced one. The
// name is checked against the catalog as it's typed, and a match with a wger
// workout asks before creating it anyway

const NAME_CHECK_MS = 350;
const WARN = "#d97706";

export function AddWorkoutModal({ visible, onClose, onSave, categories, equipmentList, muscleList = [], darkMode }) {
  const tone = getScreenTones(darkMode);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [equipmentIds, setEquipmentIds] = useState([]);
  const [muscleIds, setMuscleIds] = useState([]);
  const [secondaryIds, setSecondaryIds] = useState([]);
  // The catalog's workout with this name: { id, name, source } or null
  const [match, setMatch] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Optional photo, { uri, name, type }. Uploaded once the workout is added
  const [photo, setPhoto] = useState(null);
  // Added, but the photo didn't make it: the button turns into Done
  const [added, setAdded] = useState(false);

  // Blank on every open
  useEffect(() => {
    if (!visible) return;
    setName("");
    setDescription("");
    setCategoryId(null);
    setEquipmentIds([]);
    setMuscleIds([]);
    setSecondaryIds([]);
    setPhoto(null);
    setAdded(false);
    setMatch(null);
    setConfirming(false);
    setError("");
  }, [visible]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError("Photo library access is needed to add a photo.");
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (picked.canceled || !picked.assets?.length) return undefined;
    const asset = picked.assets[0];
    return setPhoto({ uri: asset.uri, name: asset.fileName || "workout.jpg", type: asset.mimeType || "image/jpeg" });
  }

  // Debounced match while typing. A failed check just shows no prompt: the
  // server checks again on save
  useEffect(() => {
    const query = name.trim();
    if (!visible || !query) {
      setMatch(null);
      return undefined;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      findWorkoutByName(query, { signal: abort.signal })
        .then((found) => !abort.signal.aborted && setMatch(found))
        .catch(() => !abort.signal.aborted && setMatch(null));
    }, NAME_CHECK_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [name, visible]);

  const own = match?.source === "user";

  async function save(confirmDuplicate = false) {
    setSaving(true);
    setError("");
    try {
      const result = await onSave({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(equipmentIds.length ? { equipmentIds } : {}),
        ...(muscleIds.length ? { muscleIds } : {}),
        ...(secondaryIds.length ? { secondaryMuscleIds: secondaryIds } : {}),
        ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
      }, photo);
      setConfirming(false);
      if (result?.photoFailed) {
        setAdded(true);
        setError("Workout added, but its photo couldn't be uploaded.");
        return;
      }
      onClose();
    } catch (err) {
      // The check hadn't finished when they pressed Add: ask now
      if (err?.code === "DUPLICATE_WGER") setMatch({ name: name.trim(), source: "wger" });
      else setError(err?.message || "Couldn't add the workout.");
      setConfirming(err?.code === "DUPLICATE_WGER");
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    if (added) return onClose();
    if (!name.trim()) return setError("Please give the workout a name.");
    if (own) return setError("You already have a workout with that name.");
    if (match) return setConfirming(true);
    return save();
  }

  // A muscle is main or secondary, never both: picking one clears the other
  const toggleMuscle = (id, setMine, setOther) => {
    setMine((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
    setOther((ids) => ids.filter((i) => i !== id));
  };
  const toggleEquipment = (id) => setEquipmentIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  const inputStyle = [editorStyles.input, { borderColor: tone.border, color: tone.text }];

  return (
    <PlanModal
      visible={visible}
      onClose={onClose}
      darkMode={darkMode}
      title="Add workout"
      subtitle="Your own, shown with the rest of the catalog"
      footer={(
        <>
          <PlanButton label="Cancel" variant="secondary" onPress={onClose} darkMode={darkMode} />
          <PlanButton label={added ? "Done" : "Add workout"} onPress={submit} loading={saving && !confirming} darkMode={darkMode} />
        </>
      )}
    >
      <SectionLabel darkMode={darkMode}>Name</SectionLabel>
      <RingInput
        value={name}
        onChangeText={setName}
        maxLength={150}
        placeholder="e.g. Sled Push"
        placeholderTextColor={tone.muted}
        style={inputStyle}
      />
      {!!match && (
        <View style={addStyles.prompt}>
          <Ionicons name={own ? "alert-circle" : "information-circle"} size={16} color={own ? "#e5484d" : WARN} />
          <Text style={[addStyles.promptText, { color: own ? "#e5484d" : WARN }]}>
            {own
              ? `You already have a workout named "${match.name}".`
              : `"${match.name}" is already in the catalog.`}
          </Text>
        </View>
      )}

      <SectionLabel darkMode={darkMode}>Category (optional)</SectionLabel>
      <View style={scheduleStyles.wrapRow}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onPress={() => setCategoryId((current) => (current === c.id ? null : c.id))}
            darkMode={darkMode}
          />
        ))}
      </View>

      <SectionLabel darkMode={darkMode}>Equipment (none = no equipment)</SectionLabel>
      <View style={scheduleStyles.wrapRow}>
        {equipmentList.map((e) => (
          <Chip
            key={e.id}
            label={e.name}
            active={equipmentIds.includes(e.id)}
            onPress={() => toggleEquipment(e.id)}
            darkMode={darkMode}
          />
        ))}
      </View>

      {muscleList.length > 0 && (
        <>
          <SectionLabel darkMode={darkMode}>Muscles worked (optional)</SectionLabel>
          <View style={scheduleStyles.wrapRow}>
            {muscleList.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                active={muscleIds.includes(m.id)}
                onPress={() => toggleMuscle(m.id, setMuscleIds, setSecondaryIds)}
                darkMode={darkMode}
              />
            ))}
          </View>

          <SectionLabel darkMode={darkMode}>Secondary muscles (optional)</SectionLabel>
          <View style={scheduleStyles.wrapRow}>
            {muscleList.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                active={secondaryIds.includes(m.id)}
                onPress={() => toggleMuscle(m.id, setSecondaryIds, setMuscleIds)}
                darkMode={darkMode}
              />
            ))}
          </View>
        </>
      )}

      <SectionLabel darkMode={darkMode}>Photo (optional)</SectionLabel>
      {photo ? (
        <View style={addStyles.photoRow}>
          <Image source={{ uri: photo.uri }} style={addStyles.photo} />
          <PlanButton compact variant="secondary" label="Remove" onPress={() => setPhoto(null)} darkMode={darkMode} />
        </View>
      ) : (
        <PlanButton compact variant="secondary" label="Choose a photo" onPress={pickPhoto} darkMode={darkMode} />
      )}

      <SectionLabel darkMode={darkMode}>Description (optional)</SectionLabel>
      <RingInput
        value={description}
        onChangeText={setDescription}
        maxLength={1500}
        multiline
        placeholder="How it's done"
        placeholderTextColor={tone.muted}
        style={[inputStyle, editorStyles.multiline]}
      />

      <FormAlert message={error} onDismiss={() => setError("")} />

      {/* Inside the dialog, so it opens over it rather than beside it */}
      <ConfirmModal
        visible={confirming}
        title="Add this workout?"
        message={`"${match?.name || name.trim()}" is already in the wger catalog. Do you still want to create your own?`}
        confirmLabel="Create"
        loading={saving}
        onConfirm={() => save(true)}
        onCancel={() => setConfirming(false)}
      />
    </PlanModal>
  );
}

const addStyles = StyleSheet.create({
  prompt: { flexDirection: "row", alignItems: "center", gap: 6 },
  promptText: { flex: 1, fontSize: 12, fontWeight: "600" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 96, height: 72, borderRadius: radii.sm },
});

// Create or edit a routine: name, optional description, and an ordered list
// of exercises with their own sets/reps. Exercises are added by search

const SEARCH_DEBOUNCE_MS = 300;
const MAX_EXERCISES = 30;
// Rough time per set including rest, for the "~N min" estimate
const MINUTES_PER_SET = 2;

export function estimateMinutes(exercises) {
  const sets = exercises.reduce((sum, e) => sum + (e.targetSets || 0), 0);
  return sets ? Math.max(5, Math.round(sets * MINUTES_PER_SET)) : null;
}

export function RoutineEditorModal({ visible, routine, onClose, onSave, darkMode }) {
  const ring = useFocusRing();
  const tone = getScreenTones(darkMode);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState([]);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // The Browse tab's filters, for finding exercises without a name to type
  const [category, setCategory] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [categories, setCategories] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);

  // Filter options, once per open. A failed load just leaves no chips
  useEffect(() => {
    if (!visible || categories.length) return;
    fetchCategories().then((list) => setCategories(list || [])).catch(() => {});
    fetchEquipment().then((list) => setEquipmentList(list || [])).catch(() => {});
  }, [visible, categories.length]);

  // Load the routine being edited (or blank for a new one) on open
  useEffect(() => {
    if (!visible) return;
    setTitle(routine?.title || "");
    setDescription(routine?.description || "");
    setExercises((routine?.exercises || []).map((e) => ({ ...e })));
    setTerm("");
    setResults([]);
    setError("");
    setCategory(null);
    setEquipment(null);
  }, [visible, routine]);

  // Debounced exercise search against the synced catalog. A filter on its
  // own lists matches too, like Browse; a term needs 2+ characters
  const filtered = category != null || equipment != null;
  useEffect(() => {
    const query = term.trim();
    if (query.length < 2 && !filtered) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const page = await fetchExerciseInfoPage({
          search: query.length >= 2 ? query : undefined,
          category: category ?? undefined,
          equipment: equipment ?? undefined,
          limit: 8,
        });
        if (!cancelled) {
          setResults((page.results || []).map((info) => ({
            exerciseRef: info.id,
            exerciseName: getEnglishTranslation(info).name,
            category: info.category?.name || "",
          })));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, category, equipment, filtered]);

  function addExercise(item) {
    if (exercises.length >= MAX_EXERCISES) {
      setError(`A routine can have up to ${MAX_EXERCISES} exercises.`);
      return;
    }
    setExercises((list) => [...list, { ...item, targetSets: 3, targetReps: 10 }]);
    setTerm("");
    setResults([]);
  }

  function updateAt(index, changes) {
    setExercises((list) => list.map((e, i) => (i === index ? { ...e, ...changes } : e)));
  }

  function move(index, delta) {
    setExercises((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    if (!title.trim()) return setError("Please give the routine a name.");
    if (!exercises.length) return setError("Add at least one exercise.");
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: routine?.id,
        title: title.trim(),
        description: description.trim(),
        estimatedDurationMinutes: estimateMinutes(exercises),
        exercises,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't save the routine.");
    } finally {
      setSaving(false);
    }
    return undefined;
  }

  const inputStyle = [editorStyles.input, { borderColor: tone.border, color: tone.text }];
  const minutes = estimateMinutes(exercises);

  return (
    <PlanModal
      visible={visible}
      onClose={onClose}
      darkMode={darkMode}
      wide
      title={routine?.id ? "Edit routine" : "New routine"}
      subtitle={minutes ? `${exercises.length} exercises · about ${minutes} min` : "Group exercises you do together"}
      footer={(
        <>
          <PlanButton label="Cancel" variant="secondary" onPress={onClose} darkMode={darkMode} />
          <PlanButton label="Save routine" onPress={save} loading={saving} darkMode={darkMode} />
        </>
      )}
    >
      <SectionLabel darkMode={darkMode}>Name</SectionLabel>
      <RingInput
        value={title}
        onChangeText={setTitle}
        maxLength={150}
        placeholder="e.g. Push Day, Morning Core"
        placeholderTextColor={tone.muted}
        style={inputStyle}
      />

      <SectionLabel darkMode={darkMode}>Description (optional)</SectionLabel>
      <RingInput
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        placeholder="e.g. Chest, shoulders and triceps"
        placeholderTextColor={tone.muted}
        style={[inputStyle, editorStyles.multiline]}
      />

      <SectionLabel darkMode={darkMode}>Exercises</SectionLabel>
      <View style={[editorStyles.search, { borderColor: tone.border }, ring.style]}>
        <Ionicons name="search" size={15} color={tone.muted} />
        <TextInput
          {...ring.handlers}
          value={term}
          onChangeText={setTerm}
          placeholder="Search exercises to add (e.g. squat)"
          placeholderTextColor={tone.muted}
          style={[ring.input, editorStyles.searchInput, { color: tone.text }]}
        />
        {searching && <ActivityIndicator size="small" color={shellColors.primary} />}
      </View>

      <WorkoutFilters
        categories={categories}
        category={category}
        onCategory={setCategory}
        equipment={equipment}
        onEquipment={setEquipment}
        equipmentList={equipmentList}
        darkMode={darkMode}
      />

      {results.length > 0 && (
        <View style={[editorStyles.results, { borderColor: tone.border }]}>
          {results.map((item) => (
            <Pressable
              key={item.exerciseRef}
              onPress={() => addExercise(item)}
              style={[editorStyles.resultRow, { borderBottomColor: tone.border }]}
            >
              <View style={editorStyles.flex1}>
                <Text numberOfLines={1} style={[editorStyles.resultName, { color: tone.text }]}>{item.exerciseName}</Text>
                {!!item.category && <Text style={[editorStyles.resultMeta, { color: tone.muted }]}>{item.category}</Text>}
              </View>
              <Ionicons name="add-circle" size={20} color={shellColors.primary} />
            </Pressable>
          ))}
        </View>
      )}

      {exercises.length === 0 ? (
        <Text style={[editorStyles.hint, { color: tone.muted }]}>No exercises yet. Search or filter above to add some.</Text>
      ) : (
        exercises.map((e, i) => (
          <View key={`${e.exerciseRef}-${i}`} style={[editorStyles.item, { borderColor: tone.border }]}>
            <View style={editorStyles.itemTop}>
              <Text style={[editorStyles.itemIndex, { color: shellColors.primary }]}>{i + 1}</Text>
              <Text numberOfLines={1} style={[editorStyles.itemName, { color: tone.text }]}>{e.exerciseName}</Text>
              <Pressable onPress={() => move(i, -1)} hitSlop={6} disabled={i === 0} accessibilityLabel="Move up">
                <Ionicons name="chevron-up" size={18} color={i === 0 ? tone.border : tone.muted} />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={6} disabled={i === exercises.length - 1} accessibilityLabel="Move down">
                <Ionicons name="chevron-down" size={18} color={i === exercises.length - 1 ? tone.border : tone.muted} />
              </Pressable>
              <Pressable
                onPress={() => setExercises((list) => list.filter((_, j) => j !== i))}
                hitSlop={6}
                accessibilityLabel="Remove exercise"
              >
                <Ionicons name="trash-outline" size={17} color="#e5484d" />
              </Pressable>
            </View>
            <View style={editorStyles.itemSteppers}>
              <Stepper label="Sets" value={e.targetSets} onChange={(v) => updateAt(i, { targetSets: v })} min={1} max={20} darkMode={darkMode} />
              <Stepper label="Reps" value={e.targetReps} onChange={(v) => updateAt(i, { targetReps: v })} min={1} max={200} darkMode={darkMode} />
            </View>
          </View>
        ))
      )}

      <FormAlert message={error} onDismiss={() => setError("")} />
    </PlanModal>
  );
}

const webNoOutline = Platform.OS === "web" ? { outlineStyle: "none" } : null;

const editorStyles = StyleSheet.create({
  flex1: { flex: 1 },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, ...webNoOutline },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, ...webNoOutline },
  results: { borderWidth: 1, borderRadius: radii.sm, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  resultName: { fontSize: 13, fontWeight: "700" },
  resultMeta: { fontSize: 11, marginTop: 1 },
  hint: { fontSize: 13 },
  item: { borderWidth: 1, borderRadius: radii.sm, padding: 12, gap: 10 },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemIndex: { fontSize: 13, fontWeight: "800", width: 18 },
  itemName: { flex: 1, fontSize: 14, fontWeight: "700" },
  itemSteppers: { flexDirection: "row", gap: 16, paddingLeft: 28 },
});

// Plays a routine one exercise at a time with the regular tracker. The run is
// logged ONCE, as a single routine session, when it ends or the user leaves.
// Its "sets" are exercises: completedSets = exercises finished

export function RoutinePlayerModal({ visible, routine: routineProp, plannedId, onClose, onFinish, darkMode }) {
  // The page clears the routine as it closes the modal. Keep showing the last
  // one while the close animation plays, instead of flashing "no exercises"
  const lastRoutineRef = useRef(routineProp);
  if (routineProp) lastRoutineRef.current = routineProp;
  const routine = routineProp || lastRoutineRef.current;

  const tone = getScreenTones(darkMode);
  const [step, setStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState([]);

  // Refs so the close path reads current values without re-render timing issues
  const startedAtRef = useRef(null);
  const doneRef = useRef(new Set());
  // step -> sets finished, including partial runs of an exercise
  const setsRef = useRef({});
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setDoneSteps([]);
    doneRef.current = new Set();
    setsRef.current = {};
    loggedRef.current = false;
    startedAtRef.current = new Date();
  }, [visible, routine?.id]);

  const exercises = routine?.exercises || [];
  const current = exercises[step];
  const isLast = step >= exercises.length - 1;

  // Only a fully completed exercise counts toward the routine
  function handleTrackerFinish(result) {
    setsRef.current[step] = Number(result.completedSets) || 0;
    if (result.status !== "completed") return;
    doneRef.current.add(step);
    setDoneSteps([...doneRef.current]);
  }

  // Logs once, and only if at least one exercise was finished
  function logRun() {
    if (loggedRef.current || !routine) return;
    loggedRef.current = true;
    const finished = doneRef.current.size;
    if (finished === 0) return;

    const startedAt = startedAtRef.current || new Date();
    onFinish({
      routineId: routine.id,
      completedSets: finished,
      targetSets: exercises.length,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      actualDurationSeconds: Math.min(21600, Math.round((Date.now() - startedAt.getTime()) / 1000)),
      // How each exercise went; the server saves it on the session
      exercises: exercises.map((e, i) => ({
        position: e.position ?? i,
        completedSets: setsRef.current[i] || 0,
        done: doneRef.current.has(i),
      })),
      ...(plannedId ? { plannedId } : {}),
    });
  }

  function close() {
    logRun();
    onClose();
  }

  function next() {
    if (isLast) {
      close();
      return;
    }
    setStep((s) => s + 1);
  }

  const stepDone = doneSteps.includes(step);

  return (
    <PlanModal
      visible={visible}
      onClose={close}
      darkMode={darkMode}
      wide
      title={routine?.title || "Routine"}
      subtitle={exercises.length ? `Exercise ${step + 1} of ${exercises.length} · ${doneSteps.length} done` : ""}
      footer={(
        <>
          <PlanButton label="End routine" variant="secondary" onPress={close} darkMode={darkMode} />
          <PlanButton
            label={isLast ? "Finish" : stepDone ? "Next exercise" : "Skip exercise"}
            onPress={next}
            darkMode={darkMode}
          />
        </>
      )}
    >
      {/* Progress dots, one per exercise */}
      <View style={playerStyles.dots}>
        {exercises.map((e, i) => (
          <View
            key={`${e.exerciseRef}-${i}`}
            style={[
              playerStyles.dot,
              { backgroundColor: doneSteps.includes(i) ? shellColors.primary : i === step ? tone.muted : tone.border },
            ]}
          />
        ))}
      </View>

      {current ? (
        <>
          <View style={playerStyles.titleRow}>
            <Ionicons name="barbell" size={18} color={shellColors.primary} />
            <Text style={[playerStyles.exerciseName, { color: tone.text }]}>{current.exerciseName}</Text>
            {stepDone && <Ionicons name="checkmark-circle" size={18} color={shellColors.primary} />}
          </View>
          {/* Keyed per step so each exercise starts a fresh tracker */}
          <ExerciseWorkoutTracker
            key={`${routine?.id}-${step}`}
            exerciseName={current.exerciseName}
            exerciseRef={current.exerciseRef}
            initialSets={current.targetSets}
            initialReps={current.targetReps}
            onFinish={handleTrackerFinish}
            darkMode={darkMode}
          />
        </>
      ) : (
        <Text style={{ color: tone.muted }}>This routine has no exercises.</Text>
      )}
    </PlanModal>
  );
}

const playerStyles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dot: { width: 22, height: 6, borderRadius: radii.pill },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exerciseName: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
});