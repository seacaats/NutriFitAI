import { apiClient } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { useFocusRing } from "@/shared/components/ui/FormInput";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { addDays, todayISO } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { dayLabel, MAX_STEPS, styles } from "./StepCards";

// Full steps history and the edit-a-day dialog

const HISTORY_PAGE_DAYS = 30;
const HISTORY_MAX_DAYS = 365;

// ---- Full history -------------------------------------------------------------

// Every day from today back, a month at a time, including days with no data
function useStepsHistory() {
  const [days, setDays] = useState([]);
  const [oldest, setOldest] = useState(null);
  const [dailyGoal, setDailyGoal] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWindow = useCallback(async (to, replace) => {
    const from = addDays(to, -(HISTORY_PAGE_DAYS - 1));
    setLoading(true);
    try {
      const data = await apiClient.get(`/steps?from=${from}&to=${to}`, { auth: true });
      const byDate = new Map((data.days || []).map((d) => [d.activityDate, d]));
      const page = Array.from({ length: HISTORY_PAGE_DAYS }, (_, i) => {
        const date = addDays(to, -i);
        return byDate.get(date) || { activityDate: date, stepCount: null, source: null };
      });
      setDays((current) => (replace ? page : [...current, ...page]));
      setOldest(from);
      setDailyGoal(data.dailyGoal || 10000);
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't load your steps.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => loadWindow(todayISO(), true), [loadWindow]);
  // Pull-to-refresh: first-load skeletons, then the newest window
  usePullRefresh(() => {
    setDays([]);
    return refresh();
  });
  useEffect(() => {
    refresh();
  }, [refresh]);

  const canLoadMore = oldest && oldest > addDays(todayISO(), -HISTORY_MAX_DAYS);
  const loadMore = () => oldest && !loading && loadWindow(addDays(oldest, -1), false);

  // A saved edit swaps its day in place, no refetch needed
  const applyRow = (row) =>
    setDays((current) => current.map((d) => (d.activityDate === row.activityDate ? { ...d, ...row } : d)));

  return { days, dailyGoal, loading, error, canLoadMore, loadMore, applyRow, refresh };
}

// Splits newest-first days into calendar months, newest first
function groupByMonth(days, dateOf) {
  const groups = [];
  for (const d of days) {
    const key = dateOf(d).slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {
        key,
        label: new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        days: [],
      };
      groups.push(group);
    }
    group.days.push(d);
  }
  return groups;
}

// Month heading that opens and closes its days, like the workout history
function MonthHeading({ label, summary, open, onToggle }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  return (
    <Pressable onPress={onToggle} style={styles.monthHead} hitSlop={4} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={tone.muted} />
      <Text style={[styles.monthTitle, { color: tone.text }]}>{label}</Text>
      <Text style={[styles.monthSummary, { color: tone.muted }]} numberOfLines={1}>{summary}</Text>
    </Pressable>
  );
}

// Month keys the user closed. Months start open, so ones added by "load
// older" show without extra state
function useClosedMonths() {
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (key) => setClosed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return [closed, toggle];
}

export function StepsHistoryPanel() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const history = useStepsHistory();
  const [editing, setEditing] = useState(null); // { date, current }
  const [closed, toggle] = useClosedMonths();
  const months = groupByMonth(history.days, (d) => d.activityDate);

  return (
    <View style={styles.list}>
      <ScreenError message={history.error} />

      {months.map((month) => {
        const logged = month.days.filter((d) => d.stepCount != null);
        const avg = logged.length ? Math.round(logged.reduce((sum, d) => sum + d.stepCount, 0) / logged.length) : 0;
        const open = !closed.has(month.key);

        return (
          <View key={month.key} style={styles.month}>
            <MonthHeading
              label={month.label}
              summary={logged.length ? `${avg.toLocaleString()} avg · ${logged.length} day${logged.length === 1 ? "" : "s"} logged` : "Nothing logged"}
              open={open}
              onToggle={() => toggle(month.key)}
            />

            {open && (
              <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
                {month.days.map((d, i) => {
                  const hasData = d.stepCount != null;
                  const pct = hasData ? Math.min(Math.round((d.stepCount / history.dailyGoal) * 100), 100) : 0;
                  return (
                    <View key={d.activityDate} style={[styles.row, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                      <View style={[styles.dot, { backgroundColor: !hasData ? tone.border : pct >= 100 ? shellColors.primary : tone.soft }]} />
                      <View style={styles.rowMain}>
                        <Text style={[styles.rowTitle, { color: tone.text }]}>{dayLabel(d.activityDate)}</Text>
                        <Text style={[styles.rowMeta, { color: tone.muted }]}>
                          {!hasData ? "No data" : d.source === "manual" ? "Entered manually" : "From your phone"}
                          {hasData ? ` · ${pct}% of goal` : ""}
                        </Text>
                      </View>
                      <Text style={[styles.value, { color: hasData ? tone.text : tone.muted }]}>
                        {hasData ? d.stepCount.toLocaleString() : "--"}
                      </Text>
                      <Pressable
                        onPress={() => setEditing({ date: d.activityDate, current: d.stepCount })}
                        hitSlop={8}
                        style={styles.edit}
                        accessibilityLabel={`Edit steps for ${dayLabel(d.activityDate)}`}
                      >
                        <Ionicons name="create-outline" size={18} color={shellColors.primary} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* Skeleton rows on the first load; older pages keep a spinner */}
      {history.loading && !history.days.length && <SkeletonRows tone={tone} />}
      {history.loading && history.days.length > 0 && (
        <View style={styles.loading}>
          <ActivityIndicator color={shellColors.primary} />
        </View>
      )}

      {history.canLoadMore && !history.loading && (
        <Pressable onPress={history.loadMore} style={[styles.more, { borderColor: tone.border }]}>
          <Text style={styles.moreText}>Load More</Text>
        </Pressable>
      )}

      <StepDayEditModal
        visible={Boolean(editing)}
        date={editing?.date}
        current={editing?.current}
        onClose={() => setEditing(null)}
        onSaved={history.applyRow}
      />
    </View>
  );
}

// First load: the same 30 days grouped by month the same way, so each
// heading and row sits exactly where the loaded one will
function SkeletonRows({ tone }) {
  const dates = Array.from({ length: HISTORY_PAGE_DAYS }, (_, i) => ({ activityDate: addDays(todayISO(), -i) }));
  return groupByMonth(dates, (d) => d.activityDate).map((month) => (
    <View key={month.key} style={styles.month}>
      <View style={styles.monthHead}>
        <Skeleton width={16} height={16} />
        <Skeleton width={110} height={17} />
      </View>
      <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
        {month.days.map((d, i) => (
          <View key={d.activityDate} style={[styles.row, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
            <Skeleton width={10} height={10} borderRadius={5} />
            <View style={styles.rowMain}>
              <Skeleton width={110} height={16} />
              <Skeleton width={130} height={13} />
            </View>
            <Skeleton width={64} height={18} />
            <View style={styles.edit} />
          </View>
        ))}
      </View>
    </View>
  ));
}

// ---- Edit a day ----------------------------------------------------------------

// Update-style confirm dialog holding the form, for one day
export function StepDayEditModal({ visible, date, current, onClose, onSaved }) {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [day, setDay] = useState(date || todayISO());
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDay(date || todayISO());
    setValue(current != null ? String(current) : "");
    setError("");
  }, [visible, date, current]);

  const count = Number(value);
  const valid = /^\d+$/.test(value) && count <= MAX_STEPS;
  const tooMany = /^\d+$/.test(value) && count > MAX_STEPS;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const row = await apiClient.post("/steps/manual", { activityDate: day, stepCount: count }, { auth: true });
      onSaved?.(row);
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't save your steps.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      tone="confirm"
      title="Edit steps"
      message={error || (tooMany
        ? `A day can hold up to ${MAX_STEPS.toLocaleString()} steps.`
        : `Saved as a manual entry, so your phone won't overwrite it. Up to ${MAX_STEPS.toLocaleString()} steps; enter 0 for a day without steps.`)}
      confirmLabel="Update"
      confirmDisabled={!valid}
      loading={saving}
      onConfirm={save}
      onCancel={onClose}
    >
      <View style={styles.form}>
        <View style={styles.dayRow}>
          <Text style={[styles.dayText, { color: tone.text }]}>{dayLabel(day)}</Text>
        </View>
        <View style={[styles.inputBox, { borderColor: tone.border }, ring.style]}>
          <Ionicons name="footsteps-outline" size={18} color={shellColors.primary} />
          <TextInput
            {...ring.handlers}
            value={value}
            // Same cap as "Other amount" on the Steps card: typing past it stops at the max
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 5);
              setValue(digits === "" ? "" : String(Math.min(Number(digits), MAX_STEPS)));
            }}
            keyboardType="number-pad"
            placeholder="Steps"
            placeholderTextColor={tone.muted}
            accessibilityLabel="Step count"
            style={[ring.input, styles.input, { color: tone.text }]}
          />
          <Text style={{ color: tone.muted }}>steps</Text>
        </View>
      </View>
    </ConfirmModal>
  );
}