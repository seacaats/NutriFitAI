import Skeleton from "@/shared/components/Skeleton";
import { chipTints, colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Shared by the web and phone dashboards

export const DASH = "—";
export const MACRO_COLORS = { protein: shellColors.primary, carbs: chipTints.blue.icon, fat: chipTints.orange.icon };
export const pct = (value, target) => (target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0);

const EMPTY_MACROS = [{ key: "protein", label: "Protein" }, { key: "carbs", label: "Carbs" }, { key: "fat", label: "Fat" }];

// Grams of each macro eaten today, each bar its share of today's calories.
// `small` is the denser web card
export function MacroRow({ macros, darkMode, small = false }) {
  const tone = getScreenTones(darkMode);
  const s = small ? smallStyles : styles;
  return (
    <View style={s.row}>
      {(macros || EMPTY_MACROS).map((m) => (
        <View key={m.key} style={[s.box, { borderColor: tone.border }]}>
          <Text style={[s.name, { color: tone.text }]}>{m.label}</Text>
          {/* "40 / 120 g" once a target is set on the Food Scanner */}
          <Text style={s.value}>{macros ? (m.goal ? `${m.grams} / ${m.goal} g` : `${m.grams} g`) : DASH}</Text>
          <View style={[s.track, { backgroundColor: tone.border }]}>
            <View style={[s.fill, { width: `${m.percent || 0}%`, backgroundColor: MACRO_COLORS[m.key] }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// "Today, 6:30 PM", "Tomorrow, 7:00 AM", "Fri, 6:30 PM"
function whenLabel(iso) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(at) - startOf(new Date())) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  return `${at.toLocaleDateString(undefined, { weekday: "short" })}, ${time}`;
}

// The next few planned sessions, missed ones first, each with its kind and
// time. `summary` is the week line under them. Tapping opens Workouts
export function PlannedWorkouts({ view, summary, darkMode, onOpen }) {
  const tone = getScreenTones(darkMode);
  const rows = view?.plannedWorkouts || [];
  const more = view ? view.plannedCount + view.missedCount - rows.length : 0;

  return (
    <View style={plannedStyles.wrap}>
      {!view ? (
        [0, 1].map((i) => (
          <View key={i} style={[plannedStyles.row, { borderColor: tone.border }]}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <View style={plannedStyles.text}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="40%" height={11} style={plannedStyles.gap} />
            </View>
          </View>
        ))
      ) : rows.length === 0 ? (
        <Pressable onPress={onOpen} style={[plannedStyles.row, { borderColor: tone.border }]}>
          <View style={[plannedStyles.icon, { backgroundColor: tone.soft }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          </View>
          <View style={plannedStyles.text}>
            <Text style={[plannedStyles.name, { color: tone.text }]}>Nothing planned</Text>
            <Text style={[plannedStyles.meta, { color: tone.muted }]}>Schedule an exercise or routine from Workouts</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tone.muted} />
        </Pressable>
      ) : (
        rows.map((w) => (
          <Pressable key={w.id} onPress={onOpen} style={[plannedStyles.row, { borderColor: tone.border }]}>
            <View style={[plannedStyles.icon, { backgroundColor: tone.soft }]}>
              <Ionicons name={w.kind === "routine" ? "list" : "barbell"} size={18} color={shellColors.primary} />
            </View>
            <View style={plannedStyles.text}>
              <Text numberOfLines={1} style={[plannedStyles.name, { color: tone.text }]}>{w.name}</Text>
              <Text numberOfLines={1} style={[plannedStyles.meta, { color: w.missed ? colors.danger : tone.muted }]}>
                {w.kind === "routine" ? "Routine" : "Exercise"} · {w.missed ? `Missed, ${whenLabel(w.scheduledFor)}` : whenLabel(w.scheduledFor)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tone.muted} />
          </Pressable>
        ))
      )}

      <Text style={[plannedStyles.footer, { color: tone.muted }]}>
        {[
          more > 0 ? `+${more} more planned` : null,
          summary ? `${summary.completed} done this week · ${summary.totalMinutes} min` : null,
        ].filter(Boolean).join(" · ") || DASH}
      </Text>
    </View>
  );
}

const plannedStyles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 2 },
  gap: { marginTop: 6 },
  footer: { fontSize: 12, fontWeight: "600" },
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  box: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 8 },
  name: { fontSize: 12, fontWeight: "700" },
  value: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  track: { marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
});

const smallStyles = StyleSheet.create({
  ...styles,
  row: { flexDirection: "row", gap: 4, marginTop: 16 },
  box: { flex: 1, borderRadius: 6, borderWidth: 1, padding: 6 },
  name: { fontSize: 10, fontWeight: "700" },
  value: { fontSize: 8, color: colors.textMuted },
  track: { marginTop: 4, height: 4, borderRadius: 2, overflow: "hidden" },
});