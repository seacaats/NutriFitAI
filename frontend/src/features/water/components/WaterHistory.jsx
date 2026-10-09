import { apiClient } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones } from "@/shared/theme/nutrifitai";
import { addDays, toLocalISODate } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { dayLabel, EditIcon, formatMl, localDate, styles, WATER_BLUE, WaterDayEditModal } from "./WaterCards";

// Full water history, a month at a time

// Splits newest-first days into calendar months, newest first
function groupByMonth(days) {
  const groups = [];
  for (const d of days) {
    const key = d.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: localDate(`${key}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" }), days: [] };
      groups.push(group);
    }
    group.days.push(d);
  }
  return groups;
}

// Month heading that opens and closes its days
function MonthHeading({ label, summary, open, onToggle }) {
  const tone = getScreenTones(useTheme().darkMode);
  return (
    <Pressable onPress={onToggle} style={styles.monthHead} hitSlop={4} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={tone.muted} />
      <Text style={[styles.monthTitle, { color: tone.text }]}>{label}</Text>
      <Text style={[styles.monthSummary, { color: tone.muted }]} numberOfLines={1}>{summary}</Text>
    </Pressable>
  );
}

// ---- Full history ----------------------------------------------------------------

// Same paging as Steps: 30 days per request, back to a year
const HISTORY_PAGE_DAYS = 30;
const HISTORY_MAX_DAYS = 365;

// Daily totals, newest first, each one editable. "Load older days" pages back
export function WaterHistoryPanel() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const [days, setDays] = useState([]);
  const [goalMl, setGoalMl] = useState(null);
  const [oldest, setOldest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  // Month keys the user closed; months start open
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (key) => setClosed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  // Loads the window ending on `to`; `replace` starts the list over
  const loadWindow = useCallback(async (to, replace) => {
    setLoading(true);
    try {
      const d = await apiClient.get(`/water?days=${HISTORY_PAGE_DAYS}&to=${to}`, { auth: true });
      const page = [...(d.days || [])].reverse();
      setDays((current) => (replace ? page : [...current, ...page]));
      setOldest(page[page.length - 1]?.date || null);
      setGoalMl(d.goalMl);
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't load your water history.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => loadWindow(toLocalISODate(), true), [loadWindow]);
  // Pull-to-refresh: first-load skeletons, then the newest window
  usePullRefresh(() => {
    setDays([]);
    return reload();
  });

  useEffect(() => {
    reload();
  }, [reload]);

  const canLoadMore = oldest && oldest > addDays(toLocalISODate(), -HISTORY_MAX_DAYS);
  const loadMore = () => oldest && !loading && loadWindow(addDays(oldest, -1), false);

  if (!days.length && error) return <ScreenError message={error} />;

  const months = groupByMonth(days);

  return (
    <View style={styles.historyList}>
      {months.map((month) => {
        const logged = month.days.filter((d) => d.totalMl > 0);
        const met = month.days.filter((d) => d.totalMl >= goalMl).length;
        const avg = logged.length ? logged.reduce((sum, d) => sum + d.totalMl, 0) / logged.length : 0;
        const open = !closed.has(month.key);

        return (
          <View key={month.key} style={styles.month}>
            <MonthHeading
              label={month.label}
              summary={logged.length ? `${formatMl(avg)} avg · goal met ${met} day${met === 1 ? "" : "s"}` : "Nothing logged"}
              open={open}
              onToggle={() => toggle(month.key)}
            />
            {open && (
              <View style={[styles.historyCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
                {month.days.map((d, i) => {
                  const hit = d.totalMl >= goalMl;
                  return (
                    <View key={d.date} style={[styles.historyRow, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                      <View style={[styles.historyDot, { backgroundColor: !d.totalMl ? tone.border : hit ? WATER_BLUE : `${WATER_BLUE}55` }]} />
                      <View style={styles.flex1}>
                        <Text style={[styles.historyDay, { color: tone.text }]}>{dayLabel(d.date)}</Text>
                        <Text style={[styles.small, { color: tone.muted }]}>
                          {!d.totalMl ? "No drinks logged" : `${Math.round((d.totalMl / goalMl) * 100)}% of goal`}
                        </Text>
                      </View>
                      <Text style={[styles.historyValue, { color: d.totalMl ? tone.text : tone.muted }]}>
                        {d.totalMl ? formatMl(d.totalMl) : "--"}
                      </Text>
                      <EditIcon label={`Edit water for ${dayLabel(d.date)}`} onPress={() => setEditing(d.date)} />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* First load: the same 30 days grouped the same way, so every month
          heading and row lands where the real one will. Older pages keep a spinner */}
      {loading && !days.length && groupByMonth(
        Array.from({ length: HISTORY_PAGE_DAYS }, (_, i) => ({ date: addDays(toLocalISODate(), -i) })),
      ).map((month) => (
        <View key={month.key} style={styles.month}>
          <View style={styles.monthHead}>
            <Skeleton width={16} height={16} />
            <Skeleton width={110} height={17} />
          </View>
          <View style={[styles.historyCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
            {month.days.map((d, i) => (
              <View key={d.date} style={[styles.historyRow, i > 0 && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
                <Skeleton width={10} height={10} borderRadius={5} />
                <View style={styles.flex1}>
                  <Skeleton width={110} height={17} />
                  <Skeleton width={80} height={14} style={styles.lineSkeleton} />
                </View>
                <Skeleton width={60} height={18} />
                <View style={styles.editIcon} />
              </View>
            ))}
          </View>
        </View>
      ))}
      {loading && days.length > 0 && <View style={styles.loading}><ActivityIndicator color={WATER_BLUE} /></View>}

      {canLoadMore && !loading && (
        <Pressable onPress={loadMore} style={[styles.more, { borderColor: tone.border }]}>
          <Text style={styles.moreText}>Load More</Text>
        </Pressable>
      )}

      <WaterDayEditModal visible={Boolean(editing)} date={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </View>
  );
}
