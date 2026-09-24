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
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Full workout history — web.
 *
 * Four deliberate differences from the native screen:
 *
 *  1. A plain mapped list rather than FlatList. The page already scrolls inside
 *     DashboardLayout, and nesting a virtualised list inside a scrolling
 *     container on web gives you two scrollbars and an onEndReached that fires
 *     against the wrong element.
 *
 *  2. An explicit "Load more" button rather than infinite scroll. Infinite
 *     scroll is a touch pattern; with a mouse it makes the page footer
 *     unreachable and gives no sense of how much is left. A button is
 *     predictable and keyboard-reachable.
 *
 *  3. The page-header treatment the other web screens use (eyebrow, large
 *     title, subtitle) rather than a back chevron, since the sidebar already
 *     handles navigation here.
 *
 *  4. A day's sessions wrap into a row of cards instead of a single fixed-width
 *     column. A day with one exercise stretches that card across the full
 *     width (flexGrow on a lone child fills the row); a day with several wraps
 *     them two (or more) per line as the window allows, instead of leaving the
 *     right half of a wide screen blank under a 720px column.
 */
export default function WorkoutHistoryScreen() {
  const { shell: c } = useTheme();
  const router = useRouter();

  const textColor = { color: c.sidebarText };
  const { sessions, total, loading, loadingMore, hasMore, error, loadMore } =
    useWorkoutHistory();

  const groups = groupByDay(sessions);

  // Collapsed-by-key set rather than expanded-by-default per group: a day
  // newly appended by "Load more" should open automatically without this
  // screen having to know about it.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (key) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <DashboardLayout>
      <View style={styles.pageHeader}>
        <View style={ styles.headerContent }>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>TRAINING</Text>
            <Text style={[styles.pageTitle, textColor]}>Workout history</Text>
            <Text style={styles.pageSubtitle}>
              {total > 0
                ? `${total} session${total === 1 ? "" : "s"} in the last 30 days`
                : "Everything you have finished in the last 30 days"}
            </Text>
          </View>

          { sessions.length > 0 && (
          <Pressable
            onPress={() => router.push("/workouts")}
            style={{ borderColor: c.dropdownBorder }}
          >
            <Text style={styles.headerActionText}>Browse exercises</Text>
          </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View>
          {[0, 1, 2].map((g) => (
            <View key={g} style={{ marginTop: g === 0 ? 0 : 24 }}>
              <Skeleton width={140} height={14} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                {[0, 1].map((r) => (
                  <View
                    key={r}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 260, borderWidth: 1, borderColor: c.dropdownBorder, borderRadius: radii.sm, padding: 14 }}
                  >
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <View style={{ flex: 1 }}>
                      <Skeleton width="55%" height={13} />
                      <Skeleton width="30%" height={11} style={{ marginTop: 6 }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : sessions.length === 0 ? (
        /*
          Empty state, not an error. A user with no history has not done
          anything wrong, so the copy points at the next action rather than
          reporting an absence.
        */
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={34} color={screenTones.light.mutedAlt} />
          <Text style={[styles.emptyTitle, textColor]}>No workouts yet</Text>
          <Text style={styles.emptyBody}>
            Finish a workout from the exercises page and it will show up here.
          </Text>
          <Pressable onPress={() => router.push("/workouts")} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Browse exercises</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {groups.map((group) => {
            const isOpen = !collapsed.has(group.key);
            return (
              <View key={group.key} style={styles.group}>
                <Pressable
                  onPress={() => toggleGroup(group.key)}
                  style={styles.dayHeaderRow}
                  hitSlop={4}
                >
                  <Ionicons
                    name={isOpen ? "chevron-down" : "chevron-forward"}
                    size={13}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.dayHeader, textColor]}>{group.label}</Text>
                  <Text style={styles.dayCount}>
                    {group.sessions.length} session{group.sessions.length === 1 ? "" : "s"}
                  </Text>
                </Pressable>

                {isOpen && (
                  <View style={styles.dayRow}>
                    {group.sessions.map((session) => (
                      <View key={session.id} style={styles.cardSlot}>
                        <HistoryRow
                          session={session}
                          textColor={textColor}
                          borderColor={c.dropdownBorder}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {error && sessions.length === 0 && <Text style={styles.error}>{error}</Text>}
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
      <View style={[styles.icon, { backgroundColor: skipped ? chipTints.orange.light : chipTints.green.light }]}>
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

      {/* Sets and duration sit in their own columns on web, where the width is
          available — on mobile they are collapsed into the meta line. */}
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
  pageHeader: { marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, color: colors.textMuted },
  pageTitle: { marginTop: 2, fontSize: 28, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },

  // No max-width cap: a day with more than one exercise wraps cards to use the
  // full page width instead of leaving the right side of a wide screen empty.
  list: { width: "100%" },
  group: { marginBottom: 10 },

  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    cursor: "pointer",
  },
  dayHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  dayCount: { fontSize: 10, color: screenTones.light.mutedAlt, marginLeft: "auto" },

  // Cards wrap: one session stretches the full row (flexGrow with no sibling
  // to share with); two or more share it, each growing to fill its line.
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cardSlot: { flexGrow: 1, flexBasis: 380, minWidth: 320 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1 },
  icon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: "700" },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  time: { fontSize: 11, color: screenTones.light.mutedAlt },

  loadMore: {
    marginTop: 18,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
    cursor: "pointer",
  },
  loadMoreText: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  listEnd: { paddingVertical: 20, fontSize: 11, color: screenTones.light.mutedAlt },

  empty: { alignItems: "center", alignSelf: "center", paddingVertical: 56, gap: 8, maxWidth: 720 },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: "center", maxWidth: 300, lineHeight: 18 },
  emptyButton: {
    marginTop: 10,
    backgroundColor: shellColors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
    cursor: "pointer",
  },
  emptyButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  error: { fontSize: 12, color: colors.dangerAlt, paddingVertical: 16 },

  headerContent: {
    flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },

  headerAction: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    cursor: "pointer",
  },
  headerActionText: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
});