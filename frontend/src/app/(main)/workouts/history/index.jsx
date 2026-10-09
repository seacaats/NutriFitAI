import { ExerciseSessionModal, RoutineDetailsModal, SessionTile } from "@/features/workouts/components/PlanPanels";
import { useWorkoutHistory } from "@/features/workouts/hooks/useWorkoutHistory";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { usePullRefreshState } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, radii, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
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
  const {
    viewing, setViewing, viewingExercise, setViewingExercise, openSession,
    sessions, total, loading, loadingMore, hasMore, error, loadMore,
    deletes, groups, imageOf, collapsed, toggleGroup,
  } = useWorkoutHistory();

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
      onDelete: () => deletes.askDay(group),
    });
    if (isOpen) {
      for (const session of group.sessions) {
        rows.push({ type: "session", key: session.id, session });
      }
    }
  }

  const pull = usePullRefreshState();

  // The FlatList does the scrolling; a page ScrollView around it breaks its windowing
  return (
    <DashboardLayout scrollable={false}>
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

      {/* Header stays real while loading; only the list is a placeholder */}
      {loading ? (
        <View style={styles.skeletonWrap}>
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
      ) : sessions.length === 0 ? (
        // Empty state, not an error: the copy points at the next action
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
                <Pressable onPress={item.onDelete} hitSlop={8} style={styles.dayDelete} accessibilityLabel={`Delete ${item.label}'s sessions`}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            ) : (
              // Same image cards as the Recent tab
              <View style={styles.tileSlot}>
                <SessionTile session={item.session} imageOf={imageOf} darkMode={darkMode} timeOnly onDelete={deletes.askSession} onOpen={openSession} />
              </View>
            )
          }
          // The list scrolls here, not the layout, so the pull lives here too
          refreshControl={pull ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.refresh} tintColor={c.primary} /> : undefined}
          onEndReached={loadMore}
          /**
           * 0.4 rather than the default 0.5: rows are short, so a later trigger
           * means the spinner appears only after the user has already hit the
           * bottom and stopped.
           */
          onEndReachedThreshold={0.4}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ScreenError message={sessions.length === 0 ? error : ""} />
      {deletes.modal}

      <RoutineDetailsModal
        visible={viewing !== null}
        routine={viewing}
        imageOf={imageOf}
        onClose={() => setViewing(null)}
        darkMode={darkMode}
      />

      <ExerciseSessionModal
        visible={viewingExercise !== null}
        session={viewingExercise}
        onClose={() => setViewingExercise(null)}
        darkMode={darkMode}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  tileSlot: { marginBottom: 12 },
  dayDelete: { marginLeft: "auto", padding: 4 },
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

  list: { flex: 1 },
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

  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: "center", maxWidth: 260, lineHeight: 18 },
  emptyButton: { marginTop: 10, backgroundColor: shellColors.primary, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 10 },
  emptyButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },

});