import Skeleton from "@/shared/components/Skeleton";
import { chipTints, colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

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

// Icon and tint per recommendation kind (the backend's Recommendation.KINDS)
const REC_KINDS = {
  food: { icon: "nutrition", tint: "orange" },
  workout: { icon: "barbell", tint: "purple" },
  general: { icon: "sparkles", tint: "green" },
};

/**
 * The dashboard's "For You" strip: today's recommendation cards from
 * useRecommendations. Each has one action button, a close and a thumbs up or
 * down. Shows skeleton cards on the first load, then renders nothing until
 * there is a card, so it never leaves a gap
 */
export function RecommendationsStrip({ recs, darkMode, onOpen, style }) {
  const tone = getScreenTones(darkMode);
  // First load only: same card and row shapes as below
  if (recs.loading && !recs.loaded) {
    return (
      <View style={[recStyles.wrap, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
        <Skeleton width={70} height={16} />
        {[0, 1].map((i) => (
          <View key={i} style={[recStyles.row, { borderColor: tone.border }]}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <View style={[recStyles.text, { gap: 6 }]}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="90%" height={12} />
              <Skeleton width={90} height={13} style={{ marginTop: 4 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (!recs.items.length && !recs.error) return null;

  return (
    <View style={[recStyles.wrap, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <View style={recStyles.header}>
        <Text style={[recStyles.title, { color: tone.text }]}>For You</Text>
        {/* Always there; dimmed while the server paces refreshes. Pressing it then shows why */}
        <Pressable onPress={recs.refresh} disabled={recs.busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Refresh recommendations" style={!recs.canRefresh && !recs.busy ? { opacity: 0.45 } : null}>
          {recs.busy ? <ActivityIndicator size="small" color={shellColors.primary} /> : <Ionicons name="refresh" size={18} color={tone.muted} />}
        </Pressable>
      </View>
      {!!recs.error && <Text style={[recStyles.meta, { color: tone.muted }]}>{recs.error}</Text>}

      {recs.items.map((item) => {
        const kind = REC_KINDS[item.kind] || REC_KINDS.general;
        const tint = chipTints[kind.tint];
        return (
          <View key={item.id} style={[recStyles.row, { borderColor: tone.border }]}>
            <View style={[recStyles.icon, { backgroundColor: darkMode ? tint.dark : tint.light }]}>
              <Ionicons name={kind.icon} size={18} color={tint.icon} />
            </View>
            <View style={recStyles.text}>
              <Text style={[recStyles.name, { color: tone.text }]}>{item.title}</Text>
              <Text style={[recStyles.meta, { color: tone.muted }]}>{item.body}</Text>
              {/* Figures from the food table or the catalog, not the model */}
              {!!item.detail && <Text style={[recStyles.detail, { color: tone.text }]}>{item.detail}</Text>}
              <View style={recStyles.actions}>
                <Pressable onPress={() => onOpen(item)} hitSlop={8} accessibilityRole="button">
                  <Text style={recStyles.link}>{item.action.label}</Text>
                </Pressable>
                <Pressable onPress={() => recs.rate(item.id, "up")} hitSlop={8} accessibilityLabel="Helpful">
                  <Ionicons name={item.feedback === "up" ? "thumbs-up" : "thumbs-up-outline"} size={15} color={tone.muted} />
                </Pressable>
                <Pressable onPress={() => recs.rate(item.id, "down")} hitSlop={8} accessibilityLabel="Not helpful">
                  <Ionicons name={item.feedback === "down" ? "thumbs-down" : "thumbs-down-outline"} size={15} color={tone.muted} />
                </Pressable>
              </View>
            </View>
            <Pressable onPress={() => recs.close(item.id, "dismissed")} hitSlop={8} accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={tone.muted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const recStyles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radii.md, padding: 14, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: fs(16, 15), fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: fs(15, 14), fontWeight: "700" },
  meta: { fontSize: fs(13, 12), marginTop: 2, lineHeight: 18 },
  detail: { fontSize: fs(13, 12), fontWeight: "600", marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  link: { fontSize: fs(14, 13), fontWeight: "700", color: shellColors.primary },
});

const plannedStyles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 4 },
  gap: { marginTop: 6 },
  footer: { fontSize: 13, fontWeight: "600" },
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  box: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10 },
  name: { fontSize: 13, fontWeight: "700" },
  value: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  track: { marginTop: 8, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
});

// Narrow cards: nothing under 11px
const smallStyles = StyleSheet.create({
  ...styles,
  row: { flexDirection: "row", gap: 6, marginTop: 16 },
  box: { flex: 1, borderRadius: 6, borderWidth: 1, padding: 8 },
  name: { fontSize: 12, fontWeight: "700" },
  value: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  track: { marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden" },
});