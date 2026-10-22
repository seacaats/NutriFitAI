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
 * Paginated workout history screen grouped by day.
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

  // Flatten day headers and session rows into a single array so FlatList
  // virtualization works without nested lists or SectionList sticky-header conflicts.
  // Collapsing a day simply omits its session rows from the flat array.
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

  // Disable DashboardLayout scrolling so FlatList handles windowing and pull-to-refresh directly
  return (
    <DashboardLayout scrollable={false} hideTabBar>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.sidebarText} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, textColor]}>Workout history</Text>
          {total > 0 && (
            <Text style={styles.subtitle}>
              {total} session{total === 1 ? "" : "s"} in the last 30 days
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/workouts")}
          hitSlop={8}
          style={[styles.headerActionButton, { borderColor: c.dropdownBorder }]}
        >
          <Text style={styles.headerAction}>Exercises</Text>
        </Pressable>
      </View>

      {/* Keep header visible while loading; show skeletons only for the session list */}
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
              <View style={styles.tileSlot}>
                <SessionTile session={item.session} imageOf={imageOf} darkMode={darkMode} timeOnly onDelete={deletes.askSession} onOpen={openSession} />
              </View>
            )
          }
          refreshControl={pull ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.refresh} tintColor={c.primary} /> : undefined}
          onEndReached={loadMore}
          // Trigger pagination slightly early so the next page loads before reaching the bottom
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
