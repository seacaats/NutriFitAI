import { useMealHistory, useScanHistory } from "@/features/food/hooks/useFoodScanner";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { DayHeadingSkeleton, dayLabel, dayOfInstant, DayTotals, DayTotalsSkeleton, describeMeal, describeScan, MealRow, MealRowSkeleton, ScanHistoryRow, ScanRowSkeleton, styles, useConfirmDelete } from "./FoodScanParts";

// Scan and meal history panels

function LoadMore({ paged, tone, color = shellColors.primary }) {
  if (paged.loading && paged.rows.length) return <View style={styles.placeholder}><ActivityIndicator color={color} /></View>;
  if (!paged.hasMore) return null;
  return (
    <Pressable onPress={paged.loadMore} style={[styles.more, { borderColor: tone.border }]}>
      <Text style={styles.moreText}>Load More</Text>
    </Pressable>
  );
}

// Day headings that collapse, same as the other history pages. Days start open
function useCollapsed() {
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (key) => setClosed((cur) => {
    const next = new Set(cur);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return { isOpen: (key) => !closed.has(key), toggle };
}

function DayHeading({ label, summary, open, onToggle, tone }) {
  return (
    <Pressable onPress={onToggle} style={styles.dayHead} accessibilityRole="button">
      <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={tone.text} />
      <Text style={[styles.dayTitle, { color: tone.text }]}>{label}</Text>
      <Text style={[styles.daySummary, { color: tone.muted }]}>{summary}</Text>
    </Pressable>
  );
}

/**
 * Every saved scan with its photo, grouped by day. Tapping one hands its id
 * to `onOpen`, which reopens it on the scanner to review or log again
 */
export function ScanHistoryPanel({ darkMode, onOpen }) {
  const tone = getScreenTones(darkMode);
  const paged = useScanHistory();
  const days = useCollapsed();
  const del = useConfirmDelete(paged.remove, describeScan);

  const groups = [];
  for (const scan of paged.rows) {
    const key = dayOfInstant(scan.scannedAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, scans: [] }));
    g.scans.push(scan);
  }

  // First load: day headings and scan rows in the real list's shape
  if (!paged.rows.length && paged.loading) {
    return (
      <View style={styles.historyList}>
        {[3, 2].map((n, g) => (
          <View key={g} style={styles.dayGroup}>
            <DayHeadingSkeleton />
            {Array.from({ length: n }, (_, i) => <ScanRowSkeleton key={i} tone={tone} />)}
          </View>
        ))}
      </View>
    );
  }

  if (!paged.rows.length && !paged.loading) {
    return paged.error
      ? <ScreenError message={paged.error} />
      : <Text style={[styles.muted, { color: tone.muted }]}>No scans yet. Your scanned meals will show up here.</Text>;
  }

  return (
    <View style={styles.historyList}>
      {groups.map((g) => {
        const open = days.isOpen(g.key);
        return (
          <View key={g.key} style={styles.dayGroup}>
            <DayHeading
              label={dayLabel(g.key)}
              summary={`${g.scans.length} scan${g.scans.length === 1 ? "" : "s"}`}
              open={open}
              onToggle={() => days.toggle(g.key)}
              tone={tone}
            />
            {open && g.scans.map((scan) => (
              <ScanHistoryRow key={scan.id} scan={scan} tone={tone} onPress={() => onOpen(scan.id)} onDelete={del.ask} />
            ))}
          </View>
        );
      })}
      <ScreenError message={del.error || (paged.rows.length ? paged.error : "")} onDismiss={del.clearError} />
      <LoadMore paged={paged} tone={tone} />
      {del.modal}
    </View>
  );
}

// Every day with logged meals, newest first, with the day's totals
export function MealHistoryPanel({ darkMode }) {
  const tone = getScreenTones(darkMode);
  const paged = useMealHistory();
  const days = useCollapsed();
  const del = useConfirmDelete(paged.remove, describeMeal);

  // First load: day headings and day cards in the real list's shape
  if (!paged.rows.length && paged.loading) {
    return (
      <View style={styles.historyList}>
        {[3, 2].map((n, g) => (
          <View key={g} style={styles.dayGroup}>
            <DayHeadingSkeleton />
            <View style={[styles.card, styles.cardStretch, { backgroundColor: tone.card, borderColor: tone.border }]}>
              <DayTotalsSkeleton tone={tone} />
              {Array.from({ length: n }, (_, i) => <MealRowSkeleton key={i} tone={tone} first={i === 0} />)}
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (!paged.rows.length && !paged.loading) {
    return paged.error
      ? <ScreenError message={paged.error} />
      : <Text style={[styles.muted, { color: tone.muted }]}>No meals logged yet. Meals you log from a scan show up here.</Text>;
  }

  return (
    <View style={styles.historyList}>
      {paged.rows.map((day) => {
        const open = days.isOpen(day.date);
        return (
          <View key={day.date} style={styles.dayGroup}>
            <DayHeading
              label={dayLabel(day.date)}
              summary={`${Math.round(day.totals.caloriesKcal)} kcal · ${day.meals.length} meal${day.meals.length === 1 ? "" : "s"}`}
              open={open}
              onToggle={() => days.toggle(day.date)}
              tone={tone}
            />
            {open && (
              <View style={[styles.card, styles.cardStretch, { backgroundColor: tone.card, borderColor: tone.border }]}>
                <DayTotals totals={day.totals} goals={paged.goals} tone={tone} />
                <View style={styles.fullWidth}>
                  {day.meals.map((meal, i) => (
                    <MealRow key={meal.id} meal={meal} tone={tone} first={i === 0} onDelete={del.ask} />
                  ))}
                </View>
              </View>
            )}
          </View>
        );
      })}
      <ScreenError message={del.error || (paged.rows.length ? paged.error : "")} onDismiss={del.clearError} />
      <LoadMore paged={paged} tone={tone} />
      {del.modal}
    </View>
  );
}
