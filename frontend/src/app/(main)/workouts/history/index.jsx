import {
  groupByDay,
  useWorkoutHistory,
} from "@/features/workouts/hooks/useWorkoutHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, radii, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Full workout history, paged.
 *
 * The workouts tab shows the five most recent; everything older lived in the
 * database and was unreachable. This is where it goes.
 *
 * Grouped under day headings rather than shown as a flat list, because the
 * question people bring to a training log is "what did I do on Tuesday", not
 * "what was my 47th most recent session". Grouping also makes a rest day
 * legible as a gap between headings rather than as nothing at all.
 */
export default function WorkoutHistoryScreen() {
  const { shell: c, darkMode } = useTheme();
  const router = useRouter();

  const textColor = { color: c.sidebarText };
  const { sessions, total, loading, loadingMore, hasMore, error, loadMore } =
    useWorkoutHistory();

  const groups = groupByDay(sessions);

  // Which day headings are collapsed. Keyed by group.key rather than
  // expanded-by-default, so a day appended later by "load more" opens
  // automatically without this screen tracking it.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (key) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /**
   * Flattened into a single list of headers and rows rather than nested
   * FlatLists or a SectionList.
   *
   * SectionList would be the idiomatic choice, but its sticky headers fight
   * with DashboardLayout's own header on web, and the section data would have
   * to be rebuilt on every page append anyway. One flat array keeps
   * virtualisation working and the append cheap.
   *
   * Collapsing a day just skips pushing its session rows — the header stays
   * in the list either way, so the dropdown toggle is a plain array filter,
   * not a second render pass.
   */
  const rows = [];
  for (const group of groups) {
    const isOpen = !collapsed.has(group.key);
    rows.push({
      type: "header",
      key: `h-${group.key}`,
      label: group.label,
      count: group.sessions.length,
      isOpen,
      onToggle: () => toggleGroup(group.key),
    });
    if (isOpen) {
      for (const session of group.sessions) {
        rows.push({ type: "session", key: session.id, session });
      }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <View style={styles.skeletonWrap}>
          <Skeleton width={90} height={20} />
          {[0, 1, 2].map((g) => (
            <View key={g} style={{ marginTop: 20 }}>
              <Skeleton width={140} height={14} />
              {[0, 1].map((r) => (
                <View key={r} style={[styles.skeletonRow, { borderColor: c.dropdownBorder }]}>
                  <Skeleton width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1 }}>
                    <Skeleton width="45%" height={13} />
                    <Skeleton width="25%" height={11} style={{ marginTop: 6 }} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.sidebarText} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, textColor]}>Workout history</Text>
          {total > 0 && (
            <Text style={styles.subtitle}>
              {total} session{total === 1 ? "" : "s"} in the last 30 days
            </Text>
          )}
        </View>

        {/*
          Persistent, not only in the empty state. The "Browse exercises"
          button below disappears the moment a user logs their first session,
          which would leave this screen with no route back to the catalog at
          all — the empty state was doubling as navigation, which it should
          never be.
        */}
        <Pressable
          onPress={() => router.push("/workouts")}
          hitSlop={8}
          style={[styles.headerActionButton, { borderColor: c.dropdownBorder }]}
        >
          <Text style={styles.headerAction}>Exercises</Text>
        </Pressable>
      </View>

      {/*
        Empty state, not an error. A user with no history has not done anything
        wrong — the copy points at the next action rather than reporting an
        absence.
      */}
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={34} color={screenTones.light.mutedAlt} />
          <Text style={[styles.emptyTitle, textColor]}>No workouts yet</Text>
          <Text style={styles.emptyBody}>
            Finish a workout from the exercises tab and it will show up here.
          </Text>
          <Pressable onPress={() => router.push("/workouts")} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Browse exercises</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.type === "header" ? (
              <Pressable onPress={item.onToggle} style={styles.dayHeaderRow} hitSlop={6}>
                <Ionicons
                  name={item.isOpen ? "chevron-down" : "chevron-forward"}
                  size={12}
                  color={colors.textMuted}
                />
                <Text style={[styles.dayHeader, { color: c.sidebarText }]}>{item.label}</Text>
                <Text style={styles.dayCount}>{item.count}</Text>
              </Pressable>
            ) : (
              <HistoryRow
                session={item.session}
                textColor={textColor}
                borderColor={c.dropdownBorder}
              />
            )
          }
          onEndReached={loadMore}
          /**
           * 0.4 rather than the default 0.5: rows are short, so a later trigger
           * means the spinner appears only after the user has already hit the
           * bottom and stopped.
           */
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {error && sessions.length === 0 && (
        <Text style={styles.error}>{error}</Text>
      )}
    </DashboardLayout>
  );
}

/**
 * One session.
 *
 * Skipped sessions are shown, not hidden — the user did that work — but marked
 * in amber so the list stays honest about what was finished without colouring
 * an abandoned set like an error.
 */
function HistoryRow({ session, textColor, borderColor }) {
  const skipped = session.status === "skipped";
  const minutes = session.actualDurationSeconds
    ? Math.round(session.actualDurationSeconds / 60)
    : null;

  return (
    <View style={[styles.row, { borderBottomColor: borderColor }]}>
      <View
        style={[styles.icon, { backgroundColor: skipped ? chipTints.orange.light : chipTints.green.light }]}
      >
        <Ionicons
          name={skipped ? "pause" : "barbell"}
          size={16}
          color={skipped ? colors.skippedAmber : shellColors.primary}
        />
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, textColor]} numberOfLines={1}>
          {session.exerciseName}
        </Text>
        <Text style={styles.meta}>
          {skipped
            ? `${session.completedSets} of ${session.targetSets} sets`
            : `${session.completedSets} × ${session.targetReps}`}
          {minutes ? ` · ${minutes} min` : ""}
        </Text>
      </View>

      <Text style={styles.time}>
        {session.completedAt
          ? new Date(session.completedAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  skeletonWrap: {},
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, marginTop: 4 },

  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  backButton: { padding: 4, marginLeft: -4 },
  title: { fontSize: 20, fontWeight: "800" },
  headerActionButton: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerAction: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  listContent: { paddingBottom: 28 },

  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 2,
    paddingVertical: 4,
  },
  dayHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.6,
  },
  dayCount: { fontSize: 10, color: screenTones.light.mutedAlt, marginLeft: "auto" },

  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  icon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: "700" },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  time: { fontSize: 11, color: screenTones.light.mutedAlt },

  footer: { paddingVertical: 18, alignItems: "center" },
  footerEnd: { paddingVertical: 20, textAlign: "center", fontSize: 11, color: screenTones.light.mutedAlt },

  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: "center", maxWidth: 260, lineHeight: 18 },
  emptyButton: { marginTop: 10, backgroundColor: shellColors.primary, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 10 },
  emptyButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  error: { textAlign: "center", fontSize: 12, color: colors.dangerAlt, paddingVertical: 16 },
});