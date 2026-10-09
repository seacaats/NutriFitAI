import { GLASS_ML, MAX_GOAL_GLASSES, MIN_GOAL_GLASSES, useWater } from "@/features/water/hooks/useWater";
import { apiClient } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { RingField, useFocusRing } from "@/shared/components/ui/FormInput";
import PlanButton from "@/shared/components/ui/PlanButton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import Stepper from "@/shared/components/ui/Stepper";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { toLocalISODate } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

// Water tracker pieces: the dashboard card, the Water page body and the
// edit-a-day dialog. Both screens read from useWater, so each keeps its own
// copy of the data

export const WATER_BLUE = "#155dfc";

// ---- Days ------------------------------------------------------------------------
// Water days come from the server as "YYYY-MM-DD" in the user's timezone.
// These read them as local dates (never Date.parse, which assumes UTC)

export function localDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Today" / "Yesterday" / "Mon, Sep 28"
export function dayLabel(day) {
  const today = new Date();
  if (day === toLocalISODate(today)) return "Today";
  today.setDate(today.getDate() - 1);
  if (day === toLocalISODate(today)) return "Yesterday";
  return localDate(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// 1750 -> "1.75 L", 400 -> "400 ml"
export function formatMl(ml) {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${Math.round(ml)} ml`;
}

// Glasses shown to one decimal only when it isn't whole (e.g. 5.5)
function formatGlasses(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ProgressBar({ value, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={[styles.track, { backgroundColor: tone.border }]}>
      <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

// ---- Editing a day ---------------------------------------------------------------

export function EditIcon({ onPress, label }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.editIcon}>
      <Ionicons name="create-outline" size={18} color={WATER_BLUE} />
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  monthHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  monthTitle: { fontSize: 15, fontWeight: "800" },
  monthSummary: { fontSize: 12, marginLeft: "auto", flexShrink: 1 },
  flex1: { flex: 1 },
  center: { textAlign: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editIcon: { width: 26, alignItems: "center" },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { color: WATER_BLUE, fontSize: 12, fontWeight: "700" },
  editList: { gap: 10 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editIndex: { width: 24 },
  editBox: { flex: 1 },
  historyList: { gap: 16, width: "100%", maxWidth: 1200, alignSelf: "center" },
  month: { gap: 8 },
  historyCard: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyDay: { fontSize: 14, fontWeight: "700" },
  more: { alignSelf: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  moreText: { color: WATER_BLUE, fontSize: 13, fontWeight: "700" },
  historyValue: { fontSize: 15, fontWeight: "800", minWidth: 70, textAlign: "right" },

  // Page: same card rhythm as Steps (a wide card beside a narrow one)
  page: { gap: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  stack: { flexDirection: "column" },
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  wide: { flex: 2.2, minWidth: 280, padding: 18 },
  narrowCard: { flex: 1, minWidth: 240, padding: 18 },
  shrink: { flexShrink: 1, minWidth: 0 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: WATER_BLUE },
  kicker: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  percent: { color: WATER_BLUE, fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { fontSize: 11, marginTop: 2 },
  historyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  historyBtnText: { fontSize: 11, fontWeight: "700" },
  weekList: { marginTop: 8 },
  emptyText: { marginTop: 8 },
  loading: { paddingVertical: 48, alignItems: "center" },
  skeletonList: { gap: 12 },
  bigNumSkeleton: { marginTop: 4 },
  lineSkeleton: { marginTop: 3 },
  alignEnd: { alignSelf: "flex-end" },
  card: { borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 8 },
  cardLoading: { paddingVertical: 20 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardLabel: { fontSize: 15, fontWeight: "700" },
  cardActions: { flexDirection: "row", marginTop: 4 },
  bigNum: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  hero: { fontSize: 30, lineHeight: 34, fontWeight: "800" },
  suffix: { fontSize: 14, fontWeight: "600" },
  small: { fontSize: 12 },
  error: { fontSize: 12, color: "#e5484d" },
  track: { height: 8, borderRadius: radii.pill, overflow: "hidden", marginTop: 4 },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: WATER_BLUE },
  glasses: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  addRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  customBox: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  customInput: { width: 70, fontSize: 15, fontWeight: "700", outlineStyle: "none" },
  goalRow: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 12 },
  entry: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  entryAmount: { fontSize: 14, fontWeight: "700" },
  entryTime: { flex: 1 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 20 },
  dayLabel: { width: 64, fontSize: 13, fontWeight: "600" },
  dayTrack: { flex: 1, height: 10, borderRadius: radii.pill, overflow: "hidden" },
  dayFill: { height: "100%", borderRadius: radii.pill, backgroundColor: WATER_BLUE },
  dayValue: { width: 64, textAlign: "right" },
});

// ---- Dashboard card ------------------------------------------------------------

// Today's progress and a one-tap "+1 glass". Opens the Water page on tap
export function WaterCard({ darkMode, style }) {
  const tone = getScreenTones(darkMode);
  const router = useRouter();
  const water = useWater();

  return (
    <Pressable
      onPress={() => router.push("/water")}
      style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }, style]}
    >
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Ionicons name="water" size={20} color={WATER_BLUE} />
          <Text style={[styles.cardLabel, { color: tone.text }]}>Hydration</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tone.muted} />
      </View>

      {water.loading ? (
        // Line for line the loaded card below, so nothing moves when it fills in
        <>
          <Skeleton width={150} height={30} style={styles.bigNumSkeleton} />
          <Skeleton width={170} height={14} style={styles.lineSkeleton} />
          <ProgressBar value={0} darkMode={darkMode} />
          <View style={styles.cardActions}>
            <PlanButton compact label="1 glass" disabled darkMode={darkMode} />
          </View>
        </>
      ) : (
        <>
          {/* Same wording as the web dashboard's card */}
          <Text style={[styles.bigNum, { color: tone.text }]}>
            {formatMl(water.totalMl)}
            <Text style={[styles.suffix, { color: tone.muted }]}> / {formatMl(water.goalMl)}</Text>
          </Text>
          <Text style={[styles.small, { color: tone.muted }]}>
            {Math.round(water.progress * 100)}% of daily goal · {formatGlasses(water.glasses)} of {formatGlasses(water.goalGlasses)} glasses
          </Text>
          <ProgressBar value={water.progress} darkMode={darkMode} />
          <View style={styles.cardActions}>
            <PlanButton
              compact
              label="1 glass"
              loading={water.saving}
              onPress={() => water.addWater()}
              darkMode={darkMode}
            />
          </View>
          <ScreenError message={water.error} onDismiss={water.clearError} />
        </>
      )}
    </Pressable>
  );
}

// ---- Water page ------------------------------------------------------------------

// Laid out like the Steps page: the day's progress and the goal side by side,
// then the week and today's drinks. Everything stacks on narrow screens
export function WaterPanel({ darkMode }) {
  const ring = useFocusRing();
  const tone = getScreenTones(darkMode);
  const water = useWater();
  const [custom, setCustom] = useState("");
  const [goalGlasses, setGoalGlasses] = useState(MIN_GOAL_GLASSES);
  // Day open in the editor ("YYYY-MM-DD"), or null
  const [editing, setEditing] = useState(null);
  const router = useRouter();
  const narrow = useWindowDimensions().width < 900;

  // The stepper starts at the saved goal once it loads
  useEffect(() => {
    if (water.data) setGoalGlasses(Math.round(water.goalGlasses));
  }, [water.data?.goalMl]);

  // The page renders in full right away; only the numbers and lists are
  // placeholders while loading, each the size of what replaces it
  const loading = water.loading;

  const customValid = /^\d+$/.test(custom) && Number(custom) >= 10 && Number(custom) <= 5000;

  async function addCustom() {
    if (!customValid) return;
    if (await water.addWater(Number(custom))) setCustom("");
  }

  const goalChanged = goalGlasses * GLASS_ML !== water.goalMl;
  const days = water.data?.days || [];
  const best = Math.max(water.goalMl, ...days.map((d) => d.totalMl));
  const today = water.data?.date || toLocalISODate();
  const card = { backgroundColor: tone.card, borderColor: tone.border };
  // Stacked cards keep their natural height (flex: n would collapse them)
  const item = narrow && styles.stackItem;

  return (
    <View style={styles.page}>
      <ScreenError message={water.error} onDismiss={water.clearError} />

      <View style={[styles.row, narrow && styles.stack]}>
        {/* Today */}
        <View style={[styles.card, styles.wide, item, card]}>
          <View style={styles.rowBetween}>
            {/* Shrinks before the % and edit icon do, so they stay in the card */}
            <View style={[styles.rowGap, styles.shrink]}>
              <View style={styles.heroIcon}><Ionicons name="water" size={22} color="#ffffff" /></View>
              <View style={styles.shrink}>
                <Text style={[styles.kicker, { color: tone.muted }]}>TODAY</Text>
                {loading ? <Skeleton width={130} height={34} /> : (
                  <Text style={[styles.hero, { color: tone.text }]}>
                    {formatGlasses(water.glasses)}
                    <Text style={[styles.suffix, { color: tone.muted }]}> / {formatGlasses(water.goalGlasses)} glasses</Text>
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.rowGap}>
              {loading ? <Skeleton width={48} height={26} /> : <Text style={styles.percent}>{Math.round(water.progress * 100)}%</Text>}
              <EditIcon label="Edit today's water" onPress={() => setEditing(today)} />
            </View>
          </View>
          <ProgressBar value={water.progress} darkMode={darkMode} />
          {loading ? <Skeleton width={220} height={15} /> : (
            <Text style={[styles.small, { color: tone.muted }]}>
              {formatMl(water.totalMl)} of {formatMl(water.goalMl)} · one glass is {GLASS_ML} ml
            </Text>
          )}

          <View style={styles.addRow}>
            <PlanButton label="1 glass" onPress={() => water.addWater()} loading={water.saving} disabled={loading} darkMode={darkMode} />
            <View style={[styles.customBox, { borderColor: tone.border }, ring.style]}>
              <TextInput
                {...ring.handlers}
                value={custom}
                onChangeText={(v) => setCustom(v.replace(/\D/g, "").slice(0, 4))}
                onSubmitEditing={addCustom}
                keyboardType="number-pad"
                placeholder="Custom"
                placeholderTextColor={tone.muted}
                accessibilityLabel="Custom amount in milliliters"
                style={[ring.input, styles.customInput, { color: tone.text }]}
              />
              <Text style={[styles.small, { color: tone.muted }]}>ml</Text>
            </View>
            <PlanButton variant="secondary" label="Add" onPress={addCustom} disabled={!customValid || water.saving} darkMode={darkMode} />
          </View>
          {custom !== "" && !customValid && (
            <Text style={[styles.small, { color: tone.muted }]}>Enter between 10 and 5,000 ml.</Text>
          )}
        </View>

        {/* Goal */}
        <View style={[styles.card, styles.narrowCard, item, card]}>
          <Text style={[styles.sectionTitle, { color: tone.text }]}>Daily goal</Text>
          <Text style={[styles.sectionSubtitle, { color: tone.muted }]}>At least {MIN_GOAL_GLASSES} glasses a day</Text>
          <View style={styles.goalRow}>
            <Stepper label="Glasses" value={goalGlasses} onChange={setGoalGlasses} min={MIN_GOAL_GLASSES} max={MAX_GOAL_GLASSES} darkMode={darkMode} />
            <Text style={[styles.small, { color: tone.muted }]}>= {formatMl(goalGlasses * GLASS_ML)}</Text>
          </View>
          <PlanButton label="Save goal" onPress={() => water.setGoal(goalGlasses * GLASS_ML)} disabled={loading || !goalChanged || water.saving} darkMode={darkMode} />
        </View>
      </View>

      <View style={[styles.row, narrow && styles.stack]}>
        {/* Today's drinks */}
        <View style={[styles.card, styles.narrowCard, item, card]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.sectionTitle, { color: tone.text }]}>Logged today</Text>
              {loading ? <Skeleton width={60} height={13} style={styles.lineSkeleton} /> : (
                <Text style={[styles.sectionSubtitle, { color: tone.muted }]}>
                  {water.data?.entries?.length || 0} drink{water.data?.entries?.length === 1 ? "" : "s"}
                </Text>
              )}
            </View>
            <EditIcon label="Edit today's water" onPress={() => setEditing(today)} />
          </View>
          {loading ? (
            // Three entry rows at the real row height
            [0, 1, 2].map((i) => (
              <View key={i} style={[styles.entry, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                <Skeleton width={16} height={16} borderRadius={8} />
                <Skeleton width={60} height={16} />
                <Skeleton width={56} height={13} />
              </View>
            ))
          ) : water.data?.entries?.length ? (
            water.data.entries.map((e, i) => (
              <View key={e.id} style={[styles.entry, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                <Ionicons name="water" size={16} color={WATER_BLUE} />
                <Text style={[styles.entryAmount, { color: tone.text }]}>{formatMl(e.amountMl)}</Text>
                <Text style={[styles.small, styles.entryTime, { color: tone.muted }]}>
                  {new Date(e.loggedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.small, styles.emptyText, { color: tone.muted }]}>Nothing yet today. Tap “1 glass” each time you drink.</Text>
          )}
        </View>

        {/* Last 7 days, newest first */}
        <View style={[styles.card, styles.wide, item, card]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.sectionTitle, { color: tone.text }]}>Last 7 days</Text>
              <Text style={[styles.sectionSubtitle, { color: tone.muted }]}>Your daily totals against the goal</Text>
            </View>
            <Pressable onPress={() => router.push("/water/history")} style={[styles.historyBtn, { borderColor: tone.border }]}>
              <Ionicons name="list" size={16} color={tone.text} />
              <Text style={[styles.historyBtnText, { color: tone.text }]}>Full history</Text>
            </Pressable>
          </View>
          <View style={styles.weekList}>
            {/* Always 7 rows, so the placeholder rows are an exact match */}
            {loading && Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={[styles.dayRow, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                <View style={styles.dayLabel}><Skeleton width={40} height={15} /></View>
                <View style={[styles.dayTrack, { backgroundColor: tone.border }]} />
                <View style={styles.dayValue}><Skeleton width={50} height={14} style={styles.alignEnd} /></View>
                <View style={styles.editIcon} />
              </View>
            ))}
            {[...days].reverse().map((d, i) => {
              const met = d.totalMl >= water.goalMl;
              return (
                // Divider between days, like the Steps page's recent days
                <View key={d.date} style={[styles.dayRow, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                  <Text style={[styles.dayLabel, { color: tone.text }]}>{d.date === today ? "Today" : dayLabel(d.date).split(",")[0]}</Text>
                  <View style={[styles.dayTrack, { backgroundColor: tone.border }]}>
                    <View style={[styles.dayFill, { width: `${Math.round((d.totalMl / best) * 100)}%`, opacity: met ? 1 : 0.55 }]} />
                  </View>
                  <Text style={[styles.small, styles.dayValue, { color: tone.muted }]}>{formatMl(d.totalMl)}</Text>
                  <EditIcon label={`Edit water for ${dayLabel(d.date)}`} onPress={() => setEditing(d.date)} />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <WaterDayEditModal visible={Boolean(editing)} date={editing} onClose={() => setEditing(null)} onSaved={water.replaceData} />
    </View>
  );
}

// Update-style dialog listing a day's drinks. Each one's ml can be changed,
// and drinks added (a glass, or a custom amount) or removed. Saving replaces
// the whole day with the list. Any past day
export function WaterDayEditModal({ visible, date, onClose, onSaved }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [rows, setRows] = useState([]); // { key, ml: string }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !date) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    apiClient.get(`/water/day/${date}`, { auth: true })
      .then((day) => !cancelled && setRows(day.entries.map((e) => ({ key: e.id, ml: String(e.amountMl) }))))
      .catch((err) => !cancelled && setError(err?.message || "Couldn't load that day."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, date]);

  const add = (ml) => setRows((r) => [...r, { key: `new-${Date.now()}-${r.length}`, ml: ml ? String(ml) : "" }]);
  const change = (key, ml) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ml: ml.replace(/\D/g, "").slice(0, 4) } : row)));
  const remove = (key) => setRows((r) => r.filter((row) => row.key !== key));

  const amounts = rows.map((r) => Number(r.ml));
  const valid = rows.every((r) => /^\d+$/.test(r.ml) && Number(r.ml) >= 10 && Number(r.ml) <= 5000) && rows.length <= 40;
  const total = valid ? amounts.reduce((a, b) => a + b, 0) : null;

  async function save() {
    setSaving(true);
    try {
      const data = await apiClient.put(`/water/day/${date}`, { amounts }, { auth: true });
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't save that day.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      tone="confirm"
      title={`Edit water · ${date ? dayLabel(date) : ""}`}
      message={error || (total != null ? `${rows.length} drink${rows.length === 1 ? "" : "s"} · ${formatMl(total)}` : "Each drink is 10 to 5,000 ml.")}
      confirmLabel="Update"
      confirmDisabled={loading || !valid}
      loading={saving}
      onConfirm={save}
      onCancel={onClose}
    >
      {loading ? (
        <View style={styles.editList}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={38} />)}
        </View>
      ) : (
        <View style={styles.editList}>
          {rows.length === 0 && (
            <Text style={[styles.small, styles.center, { color: tone.muted }]}>No drinks. Saving leaves this day empty.</Text>
          )}
          {rows.map((row, i) => (
            <View key={row.key} style={styles.editRow}>
              <Ionicons name="water" size={16} color={WATER_BLUE} />
              <Text style={[styles.small, styles.editIndex, { color: tone.muted }]}>#{i + 1}</Text>
              {/* RingField: one focus ring per row, a hook can't run inside map */}
              <RingField style={[styles.customBox, styles.editBox, { borderColor: tone.border }]}>{(ring) => (
                <>
                <TextInput
                  {...ring.handlers}
                  value={row.ml}
                  onChangeText={(v) => change(row.key, v)}
                  keyboardType="number-pad"
                  placeholder="ml"
                  placeholderTextColor={tone.muted}
                  accessibilityLabel={`Drink ${i + 1} in milliliters`}
                  style={[ring.input, styles.customInput, { color: tone.text }]}
                />
                <Text style={[styles.small, { color: tone.muted }]}>ml</Text>
                </>
              )}</RingField>
              <Pressable onPress={() => remove(row.key)} hitSlop={8} accessibilityLabel={`Remove drink ${i + 1}`}>
                <Ionicons name="close-circle" size={20} color={tone.muted} />
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <PlanButton compact label="1 glass" onPress={() => add(GLASS_ML)} darkMode={darkMode} />
            <PlanButton compact variant="secondary" label="Custom" onPress={() => add(null)} darkMode={darkMode} />
          </View>
        </View>
      )}
    </ConfirmModal>
  );
}
