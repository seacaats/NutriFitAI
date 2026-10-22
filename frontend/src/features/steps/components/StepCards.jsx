import { apiClient } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ActionButton from "@/shared/components/ui/ActionButton";
import { RingInput } from "@/shared/components/ui/FormInput";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import Stepper from "@/shared/components/ui/Stepper";
import { STEP_GOAL } from "@/shared/constants/goalOptions";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { addDays, formatNumber, friendlyDate, todayISO } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// The Steps page's shared pieces, used by both web and mobile.
// Steps are edit-only: a saved day becomes "manual", which phone syncs never
// overwrite. Setting 0 records a day with no steps

export const MAX_STEPS = 20000;

// "Today" / "Yesterday" / "Mon, Sep 28"
export function dayLabel(day) {
  const today = todayISO();
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const styles = StyleSheet.create({
  todayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  quickInput: { minWidth: 120, fontSize: fs(15, 14), fontWeight: "600", borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },
  goalCard: { borderWidth: 1, borderRadius: radii.md, padding: 18, gap: 10 },
  goalTitle: { fontSize: 17, fontWeight: "800" },
  form: { gap: 12 },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  dayText: { fontSize: 15, fontWeight: "800", minWidth: 120, textAlign: "center" },
  inputBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 18, fontWeight: "700", outlineStyle: "none" },

  list: { gap: 16, width: "100%", maxWidth: 1200, alignSelf: "center" },
  month: { gap: 8 },
  monthHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  monthTitle: { fontSize: 15, fontWeight: "800" },
  monthSummary: { fontSize: fs(14, 12), marginLeft: "auto", flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fs(15, 14), fontWeight: "700" },
  rowMeta: { fontSize: fs(13, 11) },
  track: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 6, maxWidth: 220 },
  fill: { height: "100%", backgroundColor: shellColors.primary },
  value: { fontSize: 15, fontWeight: "800", minWidth: 64, textAlign: "right" },
  edit: { width: 26, alignItems: "center" },
  loading: { paddingVertical: 20, alignItems: "center" },
  more: { alignSelf: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  moreText: { color: shellColors.primary, fontSize: fs(14, 13), fontWeight: "700" },
  note: { fontSize: fs(14, 12), textAlign: "center" },
  error: { color: "#e5484d", fontSize: fs(14, 13) },
});

// ---- Today's steps -------------------------------------------------------------

const QUICK_ADDS = [500, 1000, 2500];

/**
 * Quick manual entry for today, like the water card's "+1 glass". Each add
 * saves today's new total through /steps/manual, which pins the day as
 * manual: a later phone sync won't change it. "Edit total" opens the day
 * editor (`onEdit`) to type an exact number
 */
export function TodayStepsCard({ todaySteps, onSaved, onEdit, style, loading = false }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = todaySteps ?? 0;
  const customValid = /^\d+$/.test(custom) && Number(custom) > 0 && current + Number(custom) <= MAX_STEPS;

  async function add(n) {
    setSaving(true);
    try {
      await apiClient.post("/steps/manual", { activityDate: todayISO(), stepCount: current + n }, { auth: true });
      setError("");
      setCustom("");
      onSaved?.();
    } catch (err) {
      setError(err?.message || "Couldn't save your steps.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.goalCard, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <View style={styles.todayHead}>
        <Text style={[styles.goalTitle, { color: tone.text }]}>Today's steps</Text>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Edit today's total">
          <Text style={styles.moreText}>Edit total</Text>
        </Pressable>
      </View>
      {loading ? <Skeleton width="85%" height={14} /> : (
        <Text style={[styles.rowMeta, { color: tone.muted }]}>
          {current.toLocaleString()} so far. Adding here overrides your phone's count for today.
        </Text>
      )}

      <View style={styles.quickRow}>
        {QUICK_ADDS.map((n) => (
          <ActionButton key={n} compact variant="secondary" label={`+${n.toLocaleString()}`} onPress={() => add(n)} disabled={saving || current + n > MAX_STEPS} darkMode={darkMode} />
        ))}
      </View>

      <View style={styles.quickRow}>
        <RingInput
          value={custom}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 5);
            if (digits === "") return setCustom("");
            setCustom(String(Math.min(Number(digits), MAX_STEPS)));
          }}
          placeholder="Other amount"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          style={[styles.input, styles.quickInput, { color: tone.text, borderColor: tone.border }]}
        />
        <ActionButton compact label="Add" onPress={() => add(Number(custom))} loading={saving} disabled={!customValid} darkMode={darkMode} />
      </View>
      {current >= MAX_STEPS && (
        <Text style={[styles.rowMeta, { color: tone.muted }]}>Daily maximum of {MAX_STEPS.toLocaleString()} steps reached.</Text>
      )}
      <ScreenError message={error} onDismiss={() => setError("")} />
    </View>
  );
}

// ---- Daily goal ------------------------------------------------------------------

// Daily goal card, same shape as Water's: a stepper and "Save goal"
export function StepGoalCard({ goal, onSaved, style }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [value, setValue] = useState(goal || STEP_GOAL.default);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Starts at the saved goal once it loads
  useEffect(() => {
    if (goal) setValue(goal);
  }, [goal]);

  async function save() {
    setSaving(true);
    try {
      await apiClient.put("/steps/goal", { dailySteps: value }, { auth: true });
      setError("");
      onSaved?.();
    } catch (err) {
      setError(err?.message || "Couldn't save your goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.goalCard, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <Text style={[styles.goalTitle, { color: tone.text }]}>Daily goal</Text>
      <Text style={[styles.rowMeta, { color: tone.muted }]}>Steps to aim for each day</Text>
      <Stepper label="Steps" value={value} onChange={setValue} min={STEP_GOAL.min} max={STEP_GOAL.max} step={STEP_GOAL.step} darkMode={darkMode} />
      <ScreenError message={error} onDismiss={() => setError("")} />
      <ActionButton label="Save goal" onPress={save} loading={saving} disabled={value === goal} darkMode={darkMode} />
    </View>
  );
}

/**
 * Pieces of the Steps page that both screens draw from the same data:
 * the range tabs, the Total / Daily avg / Goal days stats, and the Recent
 * days card. `steps` is the useDailySteps() result, `palette` the screen's
 * tones ({ card, border, text, muted, soft, track }). `wide` is the web
 * look: compact tabs, stats with dividers, and recent rows with distance
 * and goal columns. The hero card and the charts stay in each screen,
 * they're laid out differently on purpose
 */

export function RangeTabs({ steps, palette, wide = false, style }) {
  return (
    <View style={[wide ? w.tabsWide : w.tabs, { backgroundColor: palette.soft }, style]}>
      {steps.ranges.map((item) => {
        const active = steps.range === item;
        return (
          <Pressable key={item} onPress={() => steps.setRange(item)} style={[wide ? w.tabWide : w.tab, active && w.tabActive]}>
            <Text style={[wide ? w.tabTextWide : w.tabText, { color: active ? colors.white : palette.muted }]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// `loading` swaps each value for a placeholder of the same height
export function StepStats({ steps, palette, loading = false, wide = false, style }) {
  const stats = [
    { value: formatNumber(steps.total), label: wide ? "Total steps" : "Total" },
    { value: formatNumber(steps.average), label: wide ? "Daily average" : "Daily avg" },
    { value: String(steps.goalDays), label: "Goal days" },
  ];
  return (
    <View style={[wide ? w.statsWide : w.stats, style]}>
      {stats.map((s, i) => (
        <View key={s.label} style={wide ? w.statWideWrap : w.flex1}>
          {wide && i > 0 && <View style={[w.statDivider, { backgroundColor: palette.border }]} />}
          <View>
            {loading ? (
              <Skeleton width={56} height={wide ? 21 : 22} />
            ) : (
              <Text style={[wide ? w.statValueWide : w.statValue, { color: palette.text }]}>{s.value}</Text>
            )}
            <Text style={[wide ? w.statLabelWide : w.statLabel, { color: palette.muted }]}>{s.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The latest logged days with an edit button each, and "Full history".
 * Always shown, so Full history is reachable before anything is logged.
 *   sourceLabel  what a synced row says it came from
 *   connected    web only: picks the empty-state advice
 */
export function RecentDaysCard({
  steps, palette, loading = false, wide = false,
  sourceLabel, connected = false, onEdit, onHistory, style,
}) {
  const rowBorder = (index) => index > 0 && { borderTopWidth: 1, borderTopColor: palette.border };
  const rowStyle = wide ? w.rowWide : w.row;

  return (
    <View style={[w.card, wide && w.cardWide, { backgroundColor: palette.card, borderColor: palette.border }, style]}>
      <View style={w.head}>
        <View>
          <Text style={[wide ? w.titleWide : w.title, { color: palette.text }]}>Recent days</Text>
          <Text style={[w.subtitle, wide && w.subtitleWide, { color: palette.muted }]}>
            {wide ? "Your latest synced activity" : "Your latest logged days"}
          </Text>
        </View>
        <Pressable onPress={onHistory} style={[w.historyBtn, { borderColor: palette.border }]}>
          <Ionicons name="list" size={16} color={palette.text} />
          <Text style={[w.historyText, wide && w.historyTextWide, { color: palette.text }]}>Full history</Text>
        </Pressable>
      </View>

      <View style={wide && w.listWide}>
        {loading && [0, 1, 2, 3, 4].map((index) => (
          // Rows at their real height
          <View key={index} style={[rowStyle, rowBorder(index)]}>
            <Skeleton width={wide ? 40 : 36} height={wide ? 40 : 36} borderRadius={20} />
            <View style={wide ? w.infoWide : w.flex1}>
              <Skeleton width={90} height={15} />
              <Skeleton width={110} height={wide ? 12 : 11} style={w.skeletonGap} />
            </View>
            {wide ? [0, 1, 2].map((m) => (
              <View key={m} style={w.metric}>
                <Skeleton width={60} height={15} />
                <Skeleton width={40} height={10} style={w.skeletonGap} />
              </View>
            )) : <Skeleton width={56} height={18} />}
            <View style={w.editSpacer} />
          </View>
        ))}

        {!loading && steps.recentDays.length === 0 && (
          wide ? (
            <View style={w.empty}>
              <Ionicons name={connected ? "footsteps-outline" : "phone-portrait-outline"} size={28} color={palette.muted} />
              <Text style={[w.emptyTitle, { color: palette.text }]}>
                {connected ? "No steps recorded in this period" : "Connect your phone to track steps"}
              </Text>
              <Text style={[w.emptyCopy, { color: palette.muted }]}>
                {/* A brand-new account needs different advice from an account
                    that simply had a quiet week */}
                {connected
                  ? "Open NutriFitAI on your phone to sync your latest activity."
                  : "Step counts come from your phone's health data. Open NutriFitAI on iOS or Android and connect Apple Health or Health Connect."}
              </Text>
            </View>
          ) : (
            <Text style={[w.muted, { color: palette.muted }]}>No steps logged yet.</Text>
          )
        )}

        {!loading && steps.recentDays.map((day, index) => (
          <View key={day.activityDate} style={[rowStyle, rowBorder(index)]}>
            <View style={[wide ? w.iconWide : w.icon, { backgroundColor: palette.soft }]}>
              <Ionicons name="walk-outline" size={wide ? 20 : 18} color={shellColors.primary} />
            </View>
            <View style={wide ? w.infoWide : w.flex1}>
              <Text style={[wide ? w.dayWide : w.day, { color: palette.text }]}>{friendlyDate(day.activityDate)}</Text>
              <Text style={[wide ? w.sourceWide : w.source, { color: palette.muted }]}>
                {day.source === "manual" ? "Entered manually" : sourceLabel}
              </Text>
            </View>

            {wide ? (
              <>
                <Metric value={formatNumber(day.stepCount)} label="steps" palette={palette} />
                <Metric value={day.distanceMeters ? `${(day.distanceMeters / 1000).toFixed(1)} km` : "--"} label="distance" palette={palette} />
                <Metric
                  value={day.stepCount >= steps.dailyGoal ? "Goal hit" : `${Math.round((day.stepCount / steps.dailyGoal) * 100)}%`}
                  label="of goal"
                  palette={palette}
                />
              </>
            ) : (
              <Text style={[w.value, { color: palette.text }]}>{formatNumber(day.stepCount)}</Text>
            )}

            <Pressable onPress={() => onEdit(day)} hitSlop={8} accessibilityLabel="Edit steps">
              <Ionicons name="create-outline" size={18} color={shellColors.primary} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function Metric({ value, label, palette }) {
  return (
    <View style={w.metric}>
      <Text style={[w.metricValue, { color: palette.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[w.metricLabel, { color: palette.muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// The page widgets' styles, apart from the editing ones above
const w = StyleSheet.create({
  flex1: { flex: 1 },
  muted: { fontSize: fs(14, 12) },
  skeletonGap: { marginTop: 3 },
  editSpacer: { width: 18 },

  // Range tabs: full-width pills on mobile, a compact switch beside the chart title on web
  tabs: { flexDirection: "row", borderRadius: radii.pill, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  tabText: { fontSize: fs(14, 13), fontWeight: "700" },
  tabsWide: { flexDirection: "row", padding: 3, borderRadius: 8 },
  tabWide: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  tabTextWide: { fontSize: fs(12, 10), fontWeight: "700" },
  tabActive: { backgroundColor: shellColors.primary },

  // Stats
  stats: { flexDirection: "row", gap: 12 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: fs(13, 11) },
  statsWide: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 18 },
  statWideWrap: { flexDirection: "row", alignItems: "center", gap: 22 },
  statValueWide: { fontSize: 17, fontWeight: "800" },
  statLabelWide: { marginTop: 2, fontSize: fs(11, 9) },
  statDivider: { width: 1, height: 30 },

  // Recent days
  card: { borderWidth: 1, borderRadius: radii.xl, padding: 16, gap: 12 },
  cardWide: { borderRadius: radii.md, padding: 18, gap: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "700" },
  titleWide: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: fs(13, 11), marginTop: 2 },
  subtitleWide: { fontSize: fs(12, 10), marginTop: 3 },
  historyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  historyText: { fontSize: fs(13, 11), fontWeight: "700" },
  historyTextWide: { fontSize: fs(12, 10) },
  listWide: { marginTop: 13 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowWide: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconWide: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  // Columns share the row instead of fixed widths, so a narrow window
  // squeezes them rather than pushing the edit button off the card
  infoWide: { flex: 1.6, minWidth: 0 },
  day: { fontSize: fs(14, 13), fontWeight: "700" },
  dayWide: { fontSize: fs(14, 12), fontWeight: "700" },
  source: { fontSize: fs(13, 11) },
  sourceWide: { marginTop: 3, fontSize: fs(11, 9) },
  value: { fontSize: 15, fontWeight: "800" },
  metric: { flex: 1, minWidth: 0 },
  metricValue: { fontSize: fs(14, 12), fontWeight: "800" },
  metricLabel: { marginTop: 2, fontSize: fs(10, 8) },

  empty: { alignItems: "center", gap: 8, paddingVertical: 34, paddingHorizontal: 20 },
  emptyTitle: { fontSize: fs(15, 14), fontWeight: "700", textAlign: "center" },
  emptyCopy: { fontSize: fs(13, 11), lineHeight: 17, textAlign: "center", maxWidth: 420 },
});