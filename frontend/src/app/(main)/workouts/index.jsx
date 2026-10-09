import ExercisePills from "@/features/workouts/components/ExercisePills";
import ExerciseWorkoutTracker from "@/features/workouts/components/ExerciseWorkoutTracker";
import { RoutineEditorModal, RoutinePlayerModal, ScheduleModal } from "@/features/workouts/components/PlanModals";
import { FavoriteRoutines, PanelHeading, RecentPanel, relativeDay, RoutinesPanel, UpcomingPanel } from "@/features/workouts/components/PlanPanels";
import { EmptyState, FavoriteButton, WorkoutTabs } from "@/features/workouts/components/PlanParts";
import { WorkoutFilters, WorkoutImage } from "@/features/workouts/components/PlanTiles";
import { WorkoutPrefsModal } from "@/features/workouts/components/WorkoutPrefsPicker";
import {
  getWorkoutFallbackImage,
} from "@/features/workouts/hooks/useWorkoutApi";
import { useWorkouts } from "@/features/workouts/hooks/useWorkouts";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { MenuButton } from "@/shared/components/layout/ScreenHeader";
import Skeleton from "@/shared/components/Skeleton";
import { useFocusRing } from "@/shared/components/ui/FormInput";
import PlanButton from "@/shared/components/ui/PlanButton";
import { useTheme } from "@/shared/context/ThemeContext";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { chipTints, colors, getChipTint, getScreenPalette, radii, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { workoutsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────
export default function WorkoutsScreen() {
  const ring = useFocusRing();
  // darkMode is read here (not just `shell`) because it's threaded down to
  // RecentSessionRow below, which needs the raw boolean for its own
  // light/dark text color -- not the resolved shell palette.
  const { shell: c, darkMode } = useTheme();
  const router = useRouter();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const { mutedText } = getScreenPalette(darkMode);

  const {
    activeCategory,
    categories,
    closeDetail,
    detailLoading,
    detailPlan,
    editor,
    equipment,
    equipmentList,
    exerciseHistory,
    exercises,
    filtered,
    loadExercises,
    loading,
    loadingMore,
    hasMoreRef,
    logFromDetail,
    logRoutineRun,
    openDetail,
    plan,
    player,
    prefsOpen,
    recent,
    refreshSessions,
    reloadExercises,
    scheduleTarget,
    searchQuery,
    selectedExercise,
    sessionsLoading,
    setActiveCategory,
    setEditor,
    setEquipment,
    setPlayer,
    setPrefsOpen,
    setScheduleTarget,
    setSearchQuery,
    setTab,
    startScheduled,
    suggested,
    summary,
    tab,
  } = useWorkouts();

  return (
    <DashboardLayout hideTabBar>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.sidebarText} />
        </Pressable>
        <Text style={[styles.pageTitle, textColor]}>Workouts</Text>
        {/* Same width as the back button, so the title stays centered */}
        <View style={styles.backBtn}><MenuButton /></View>
      </View>
      <Text style={styles.pageSubtitle}>Browse workouts with photos</Text>

      {/* Quick Stats */}
      {/*
        Was "1,400+ Exercises / 15 Categories / All Muscles" — facts about the
        catalog. Nothing on this screen told the user anything about themselves.
        Same component and position, the user's own week instead.
      */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: getChipTint("green", darkMode).backgroundColor }]}>
          <Ionicons name="barbell" size={18} color={shellColors.primary} />
          <Text style={[styles.statValue, textColor]}>
            {summary ? `${summary.completed}` : "\u2014"}
          </Text>
          <Text style={[styles.statLabel, mutedText]}>This week</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: getChipTint("blue", darkMode).backgroundColor }]}>
          <Ionicons name="time" size={18} color={chipTints.blue.icon} />
          <Text style={[styles.statValue, textColor]}>{summary ? summary.totalMinutes : "\u2014"}</Text>
          <Text style={[styles.statLabel, mutedText]}>Minutes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: getChipTint("purple", darkMode).backgroundColor }]}>
          <Ionicons name="layers" size={18} color={chipTints.purple.icon} />
          <Text style={[styles.statValue, textColor]}>{categories.length}</Text>
          <Text style={[styles.statLabel, mutedText]}>Categories</Text>
        </View>
      </View>

      {/* Browse / Favorites / Routines / Upcoming / Recent */}
      <View style={styles.tabsRow}>
        <WorkoutTabs
          value={tab}
          onChange={setTab}
          darkMode={darkMode}
          counts={{
            favorites: plan.favorites.length,
            routines: plan.routines.length,
            upcoming: plan.schedule.length,
          }}
        />
      </View>

      {tab === "routines" && (
        <RoutinesPanel
          plan={plan}
          onNew={() => setEditor({ open: true, routine: null })}
          onEdit={(routine) => setEditor({ open: true, routine })}
          onStart={(routine) => setPlayer({ routine, plannedId: null })}
          onSchedule={setScheduleTarget}
          darkMode={darkMode}
        />
      )}

      {tab === "upcoming" && (
        <UpcomingPanel
          plan={plan}
          onStart={startScheduled}
          onReschedule={(s) => setScheduleTarget({
            kind: s.kind,
            refId: s.kind === "routine" ? s.routineId : s.exerciseRef,
            name: s.kind === "routine" ? s.routineName : s.exerciseName,
            rescheduleId: s.id,
          })}
          onGoBrowse={() => setTab("browse")}
          onOpenExercise={(ref) => openDetail(ref)}
          darkMode={darkMode}
        />
      )}

      {tab === "recent" && (
        <RecentPanel
          sessions={recent}
          loading={sessionsLoading}
          onSeeAll={() => router.push("/workouts/history")}
          onGoBrowse={() => setTab("browse")}
          onChanged={refreshSessions}
          darkMode={darkMode}
        />
      )}

      {tab === "favorites" && !plan.loading && !plan.favorites.length && (
        <EmptyState
          icon="heart-outline"
          title="No favorites yet"
          body="Tap the heart on any exercise or routine to keep it here for quick access."
          darkMode={darkMode}
        />
      )}

      {(tab === "browse" || (tab === "favorites" && (plan.loading || plan.favorites.length > 0))) && (
      <>
      {/* Favorites: routines first, then the exercise grid below */}
      {tab === "favorites" && plan.favorites.some((f) => f.kind === "routine") && (
        <View style={styles.favSection}>
          <PanelHeading icon="list" title="Routines" darkMode={darkMode} />
          <FavoriteRoutines
            plan={plan}
            onStartRoutine={(routine) => setPlayer({ routine, plannedId: null })}
            onSchedule={setScheduleTarget}
            onEdit={(routine) => setEditor({ open: true, routine })}
            darkMode={darkMode}
          />
          <PanelHeading icon="barbell" title="Exercises" darkMode={darkMode} />
        </View>
      )}
      {/* Search Bar */}
      <View style={[styles.searchBar, card, ring.style]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          {...ring.handlers}
          style={[ring.input, styles.searchInput, textColor]}
          placeholder="Search exercises, muscles…"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Category and equipment, behind one "Filters" button */}
      <WorkoutFilters
        categories={categories}
        category={activeCategory}
        onCategory={setActiveCategory}
        equipment={equipment}
        onEquipment={setEquipment}
        equipmentList={equipmentList}
        onPreferences={() => setPrefsOpen(true)}
        darkMode={darkMode}
      />

      {/* Results Header */}
      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, textColor]}>
          {activeCategory
            ? categories.find((c) => c.id === activeCategory)?.name ||
              "Exercises"
            : tab === "favorites" ? "" : suggested ? "Picked for you" : "All Exercises"}
        </Text>
        <Text style={styles.resultCount}>{filtered.length} loaded</Text>
      </View>

      {/* Exercise List */}
      {loading ? (
        <View>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.exerciseCard, card]}>
              <Skeleton width={76} height={76} borderRadius={8} />
              <View style={styles.flex1}>
                <Skeleton width="60%" height={14} />
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <Skeleton width={70} height={18} borderRadius={4} />
                  <Skeleton width={70} height={18} borderRadius={4} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="search" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, textColor]}>No exercises found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search or category
          </Text>
        </View>
      ) : (
        <>
          {filtered.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              card={card}
              textColor={textColor}
              shellColors={c}
              favorite={plan.isFavorite("exercise", exercise.id)}
              onToggleFavorite={() => plan.toggleFavorite({ kind: "exercise", refId: exercise.id, name: exercise.name })}
              onPress={() => openDetail(exercise.id, exercise.image)}
            />
          ))}

          {/* Load More */}
          {hasMoreRef.current && !searchQuery && (
            <Pressable
              onPress={() => loadExercises(false)}
              style={[styles.loadMoreBtn, { borderColor: c.dropdownBorder }]}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={shellColors.primary} />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={shellColors.primary}
                  />
                  <Text style={styles.loadMoreText}>Load More Exercises</Text>
                </>
              )}
            </Pressable>
          )}
        </>
      )}
      </>
      )}

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        visible={detailLoading || selectedExercise !== null}
        exercise={selectedExercise}
        loading={detailLoading}
        onClose={closeDetail}
        shellColors={c}
        onLogSession={logFromDetail}
        lastSession={exerciseHistory}
        planned={detailPlan}
        favorite={selectedExercise ? plan.isFavorite("exercise", selectedExercise.id) : false}
        onToggleFavorite={() =>
          selectedExercise &&
          plan.toggleFavorite({ kind: "exercise", refId: selectedExercise.id, name: selectedExercise.name })}
        onSchedule={() =>
          selectedExercise &&
          setScheduleTarget({ kind: "exercise", refId: selectedExercise.id, name: selectedExercise.name })}
      />

      <ScheduleModal
        visible={scheduleTarget !== null}
        target={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        // A missed plan moves its own row instead of adding a new one
        onSubmit={(body) => (scheduleTarget?.rescheduleId
          ? plan.reschedule(scheduleTarget.rescheduleId, body.scheduledFor)
          : plan.scheduleWorkout(body))}
        darkMode={darkMode}
      />

      <RoutineEditorModal
        visible={editor.open}
        routine={editor.routine}
        onClose={() => setEditor({ open: false, routine: null })}
        onSave={plan.saveRoutine}
        darkMode={darkMode}
      />

      <RoutinePlayerModal
        visible={player.routine !== null}
        routine={player.routine}
        plannedId={player.plannedId}
        onClose={() => setPlayer({ routine: null, plannedId: null })}
        onFinish={logRoutineRun}
        darkMode={darkMode}
      />

      <WorkoutPrefsModal
        visible={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        onSaved={reloadExercises}
        options={{ categories, equipmentList, loading: false }}
        darkMode={darkMode}
      />
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────
// Exercise Card Component
// ──────────────────────────────────────────────
function ExerciseCard({ exercise, card, textColor, shellColors, onPress, favorite, onToggleFavorite }) {
  return (
    <Pressable onPress={onPress} style={[styles.exerciseCard, card]}>
      {/* Image */}
      <View
        style={[
          styles.exerciseImage,
          { backgroundColor: shellColors.inactiveNavHoverBg },
        ]}
      >
        <WorkoutImage
              uri={exercise.image}
              fallbackUri={getWorkoutFallbackImage(exercise.category, exercise.name)}
              style={styles.exerciseImg}
        />
      </View>

      {/* Info */}
      <View style={styles.flex1}>
        <Text style={[styles.exerciseName, textColor]} numberOfLines={1}>
          {exercise.name}
        </Text>

        <View style={styles.exerciseMeta}>
          <View style={styles.metaPill}>
            <Ionicons name="folder-outline" size={11} color={shellColors.primary} />
            <Text style={styles.metaPillText}>{exercise.category}</Text>
          </View>
          {exercise.muscles.length > 0 && (
            <View style={styles.metaPill}>
              <Ionicons name="body-outline" size={11} color={chipTints.blue.icon} />
              <Text style={styles.metaPillText}>{exercise.muscles[0]}</Text>
            </View>
          )}
        </View>

        {exercise.equipment.length > 0 && (
          <Text style={styles.equipmentText} numberOfLines={1}>
            🏋️ {exercise.equipment.join(", ")}
          </Text>
        )}
      </View>

      <View style={styles.cardSide}>
        <FavoriteButton active={favorite} onPress={onToggleFavorite} />
        <View style={styles.cardStartButton}>
          <Ionicons name="play" size={12} color={colors.white} />
          <Text style={styles.cardStartText}>Start</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Exercise Detail Modal
// ──────────────────────────────────────────────
function ExerciseDetailModal({
  visible,
  exercise: exerciseProp,
  loading: loadingProp,
  onClose,
  shellColors,
  onLogSession,
  lastSession: lastSessionProp,
  planned: plannedProp,
  favorite: favoriteProp,
  onToggleFavorite,
  onSchedule,
}) {
  // Kept while the modal fades out: the parent clears the exercise as it
  // closes, which used to blank the card for a moment first
  const { exercise, loading, lastSession, planned, favorite } = useHeldWhileClosing(visible, {
    exercise: exerciseProp,
    loading: loadingProp,
    lastSession: lastSessionProp,
    planned: plannedProp,
    favorite: favoriteProp,
  });
  const { darkMode } = useTheme();
  // Note: `shellColors` here is the resolved-per-theme prop (see call site),
  // not the theme module's raw shellColors export, so the dark literal below
  // can't be swapped for `shellColors.dark.shellBg` without breaking on this
  // shadowed name -- left as a literal rather than threading another prop
  // through for one modal background.
  const bg = darkMode ? "#1a1a1a" : colors.white;
  const textColor = { color: darkMode ? colors.white : screenTones.light.text };

  return (
    <Modal
      // Never over another screen: hidden once you've navigated away
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: bg }]}>
          {/* Close button */}
          <Pressable style={styles.modalClose} onPress={onClose}>
            <Ionicons
              name="close"
              size={24}
              color={darkMode ? colors.white : screenTones.light.text}
            />
          </Pressable>

          {loading ? (
            <View style={{ paddingTop: 8 }}>
              <Skeleton width="100%" height={180} borderRadius={12} />
              <Skeleton width="55%" height={20} style={{ marginTop: 16 }} />
              <Skeleton width="35%" height={13} style={{ marginTop: 10 }} />
              <Skeleton width="100%" height={13} style={{ marginTop: 18 }} />
              <Skeleton width="90%" height={13} style={{ marginTop: 8 }} />
              <Skeleton width="70%" height={13} style={{ marginTop: 8 }} />
            </View>
          ) : exercise ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Image */}
              <View
                style={[
                  styles.modalImage,
                  { backgroundColor: darkMode ? "#222" : "#f3f4f6" },
                ]}
              >
                <WorkoutImage
                  uri={exercise.image}
                  fallbackUri={getWorkoutFallbackImage(exercise.category, exercise.name)}
                  style={styles.modalImg}
                />
              </View>

              {/* Title */}
              <Text style={[styles.modalTitle, textColor]}>
                {exercise.name}
              </Text>

              {/* Category Badge */}
              <View style={styles.modalBadgeRow}>
                <View
                  style={[styles.modalBadge, { backgroundColor: getChipTint("green", darkMode).backgroundColor }]}
                >
                  <Text style={[styles.modalBadgeText, textColor]}>
                    📂 {exercise.category}
                  </Text>
                </View>
              </View>

              <ExercisePills
                exercise={exercise}
                darkMode={darkMode}
                textColor={textColor}
                sectionStyle={styles.modalSection}
                titleStyle={styles.modalSectionTitle}
              />

              {/* Description */}
              {exercise.description ? (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, textColor]}>
                    Description
                  </Text>
                  <Text
                    style={[
                      styles.modalDesc,
                      { color: darkMode ? "#ccc" : colors.textSecondary },
                    ]}
                  >
                    {exercise.description.replace(/<[^>]*>/g, "")}
                  </Text>
                </View>
              ) : null}

              {lastSession && (
                <View style={styles.lastPerformed}>
                  <Text style={styles.lastPerformedLabel}>LAST PERFORMED</Text>
                  <View style={styles.lastPerformedRow}>
                    <Text style={styles.lastPerformedValue}>
                      {lastSession.completedSets} x {lastSession.targetReps}
                      {lastSession.actualDurationSeconds
                        ? ` \u00b7 ${Math.round(lastSession.actualDurationSeconds / 60)} min`
                        : ""}
                    </Text>
                    <Text style={styles.lastPerformedWhen}>
                      {relativeDay(lastSession.completedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Plan actions. Hidden when this run is a scheduled session */}
              {!planned && (
                <View style={styles.detailActions}>
                  <PlanButton
                    variant="secondary"
                    label={favorite ? "Favorited" : "Favorite"}
                    onPress={onToggleFavorite}
                    darkMode={darkMode}
                  />
                  <PlanButton variant="secondary" label="Schedule" onPress={onSchedule} darkMode={darkMode} />
                </View>
              )}
              {planned && (
                <Text style={styles.plannedNote}>Scheduled session. Finishing it here marks it done.</Text>
              )}

              <ExerciseWorkoutTracker
                key={`${exercise.id}-${planned?.plannedId || "free"}`}
                exerciseName={exercise.name}
                exerciseRef={exercise.id}
                initialSets={planned?.targetSets || 3}
                initialReps={planned?.targetReps || 10}
                onFinish={onLogSession}
                darkMode={darkMode}
              />

              {/* Extra Images */}
              {exercise.images?.length > 1 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, textColor]}>
                    More Images
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {exercise.images.slice(1, 4).map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.extraImage}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  favSection: { gap: 10, marginBottom: 16 },
  tabsRow: { marginTop: 4, marginBottom: 14 },
  cardSide: { alignItems: "flex-end", gap: 10 },
  detailActions: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" },
  plannedNote: { fontSize: 12, fontWeight: "700", marginTop: 16, color: shellColors.primary },

  ...workoutsStyles,

  lastPerformed: { marginTop: 16, borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.infoBg, borderRadius: 10, padding: 11 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  pageSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    textAlign: "center",
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: radii.sm,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },

  // Results
  resultTitle: { fontSize: 16, fontWeight: "700" },
  resultCount: { fontSize: 12, color: colors.textMuted },

  // Exercise Card
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  // Bigger thumbnail so the exercise reads at a glance
  exerciseImage: {
    width: 76,
    height: 76,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseImg: { width: 76, height: 76 },
  exerciseMeta: { flexDirection: "row", gap: 6, marginTop: 4 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(76,175,47,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equipmentText: { fontSize: 10, color: colors.textMuted, marginTop: 3 },

  // Load More
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },

  emptyWrap: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  modalClose: {
    alignSelf: "flex-end",
    padding: 4,
    marginBottom: 4,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 16,
  },
  modalImg: { width: "100%", height: 200 },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modalBadgeText: { fontSize: 12, fontWeight: "600" },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  modalDesc: { fontSize: 13, lineHeight: 20 },
  extraImage: {
    width: 120,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
  },
  cardStartButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 14, backgroundColor: shellColors.primary, paddingHorizontal: 9, paddingVertical: 7 },
  cardStartText: { color: colors.white, fontSize: 10, fontWeight: "800" },
});