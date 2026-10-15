import ExercisePills from "@/features/workouts/components/ExercisePills";
import ExerciseWorkoutTracker from "@/features/workouts/components/ExerciseWorkoutTracker";
import { AddWorkoutModal, RoutineEditorModal, RoutinePlayerModal, ScheduleModal } from "@/features/workouts/components/PlanModals";
import { FavoriteRoutines, PanelHeading, RecentPanel, relativeDay, RoutinesPanel, UpcomingPanel } from "@/features/workouts/components/PlanPanels";
import { EmptyState, FavoriteButton, WorkoutTabs } from "@/features/workouts/components/PlanParts";
import { WorkoutFilters, WorkoutImage } from "@/features/workouts/components/PlanTiles";
import { WorkoutPrefsModal } from "@/features/workouts/components/WorkoutPrefsPicker";
import {
  getWorkoutFallbackImage,
} from "@/features/workouts/hooks/useWorkoutApi";
import { PAGE_SIZE, useWorkouts } from "@/features/workouts/hooks/useWorkouts";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { useFocusRing } from "@/shared/components/ui/FormInput";
import PlanButton from "@/shared/components/ui/PlanButton";
import { useTheme } from "@/shared/context/ThemeContext";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import {
  chipTints,
  colors,
  getChipTint,
  getScreenPalette,
  getScreenTones,
  radii,
  screenTones,
  shellColors,
} from "@/shared/theme/nutrifitai";
import { workoutsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

// ──────────────────────────────────────────────
// Main Screen (Web)
// ──────────────────────────────────────────────
export default function WorkoutsScreen() {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 980;
  const phone = width < 620;

  const { card, textColor, mutedText } = getScreenPalette(darkMode);

  const router = useRouter();
  const {
    activeCategory,
    addWorkout,
    addOpen,
    categories,
    closeDetail,
    detailLoading,
    detailPlan,
    editor,
    equipment,
    equipmentList,
    muscleList,
    muscles,
    musclesSecondary,
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
    setAddOpen,
    setEditor,
    setEquipment,
    setMuscles,
    setMusclesSecondary,
    setPlayer,
    setPrefsOpen,
    setScheduleTarget,
    setSearchQuery,
    setTab,
    setWorkoutSource,
    startScheduled,
    suggested,
    summary,
    tab,
    workoutSource,
    removeWorkout,
  } = useWorkouts();
  // The own workout asked about in the delete dialog, and what it says
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await removeWorkout(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err?.message || "Couldn't delete the workout.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.pageTitle, textColor]}>Workouts</Text>
          <Text style={[styles.pageSubtitle, mutedText]}>Stay active and reach your fitness goals.</Text>
        </View>
      </View>

      {/* Search + Stats Row */}
      <View style={[styles.topRow, narrow && styles.topRowNarrow]}>
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

        {/* Quick Stats */}
        <View style={[styles.statsRow, narrow && styles.statsRowNarrow]}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: getChipTint("green", darkMode).backgroundColor },
            ]}
          >
            <Ionicons name="barbell" size={18} color={shellColors.primary} />
            <Text style={[styles.statValue, textColor]}>
              {summary ? `${summary.completed}` : "\u2014"}
            </Text>
            <Text style={[styles.statLabel, mutedText]}>This week</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: getChipTint("blue", darkMode).backgroundColor },
            ]}
          >
            <Ionicons name="time" size={18} color={chipTints.blue.icon} />
            <Text style={[styles.statValue, textColor]}>
              {summary ? summary.totalMinutes : "\u2014"}
            </Text>
            <Text style={[styles.statLabel, mutedText]}>Minutes</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: getChipTint("purple", darkMode).backgroundColor },
            ]}
          >
            <Ionicons name="layers" size={18} color={chipTints.purple.icon} />
            <Text style={[styles.statValue, textColor]}>
              {categories.length}
            </Text>
            <Text style={[styles.statLabel, mutedText]}>Categories</Text>
          </View>
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
      {/* Category, equipment and muscles, behind one "Filters" button */}
      <WorkoutFilters
        categories={categories}
        category={activeCategory}
        onCategory={setActiveCategory}
        equipment={equipment}
        onEquipment={setEquipment}
        equipmentList={equipmentList}
        muscleList={muscleList}
        muscles={muscles}
        onMuscles={setMuscles}
        musclesSecondary={musclesSecondary}
        onMusclesSecondary={setMusclesSecondary}
        workoutSource={workoutSource}
        onWorkoutSource={setWorkoutSource}
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
        <View style={styles.resultActions}>
          <Text style={[styles.resultCount, mutedText]}>
            {filtered.length} loaded
          </Text>
          <PlanButton compact variant="secondary" label="Add workout" onPress={() => setAddOpen(true)} darkMode={darkMode} />
        </View>
      </View>

      {/* Exercise Grid / List */}
      {/* First load: one placeholder per exercise in a batch (PAGE_SIZE) */}
      {loading ? (
        <View style={styles.exerciseGrid}>
          {Array.from({ length: PAGE_SIZE }, (_, i) => i).map((i) => (
            <View
              key={i}
              style={[styles.exerciseCard, narrow && styles.exerciseCardNarrow, phone && styles.exerciseCardPhone, card]}
            >
              <Skeleton width="100%" height={170} borderRadius={0} />
              <View style={styles.exerciseBody}>
                <Skeleton width="70%" height={14} />
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
          <Ionicons
            name="search"
            size={56}
            color={darkMode ? screenTones.dark.border : colors.border}
          />
          <Text style={[styles.emptyTitle, textColor]}>No exercises found</Text>
          <Text style={[styles.emptySubtitle, mutedText]}>
            Try a different search or category
          </Text>
        </View>
      ) : (
        <>
          {/* Grid layout for web */}
          <View style={styles.exerciseGrid}>
            {filtered.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                card={card}
                textColor={textColor}
                darkMode={darkMode}
                favorite={plan.isFavorite("exercise", exercise.id)}
                onToggleFavorite={() => plan.toggleFavorite({ kind: "exercise", refId: exercise.id, name: exercise.name })}
                onPress={() => openDetail(exercise.id, exercise.image)}
                narrow={narrow}
                phone={phone}
              />
            ))}
          </View>

          {/* Load More */}
          {hasMoreRef.current && !searchQuery && (
            <Pressable
              onPress={() => loadExercises(false)}
              style={[styles.loadMoreBtn, { borderColor: card.borderColor }]}
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

      {/* Detail Modal */}
      <ExerciseDetailModal
        visible={detailLoading || selectedExercise !== null}
        exercise={selectedExercise}
        loading={detailLoading}
        onClose={closeDetail}
        onLogSession={logFromDetail}
        lastSession={exerciseHistory}
        darkMode={darkMode}
        planned={detailPlan}
        favorite={selectedExercise ? plan.isFavorite("exercise", selectedExercise.id) : false}
        onToggleFavorite={() =>
          selectedExercise &&
          plan.toggleFavorite({ kind: "exercise", refId: selectedExercise.id, name: selectedExercise.name })}
        onSchedule={() =>
          selectedExercise &&
          setScheduleTarget({ kind: "exercise", refId: selectedExercise.id, name: selectedExercise.name })}
        // Only the user's own workouts can be deleted
        onDelete={selectedExercise?.source === "user" ? () => setDeleteTarget({ id: selectedExercise.id, name: selectedExercise.name }) : undefined}
      />

      <ConfirmModal
        visible={deleteTarget !== null}
        tone="danger"
        title="Delete this workout?"
        message={deleteError || `"${deleteTarget?.name || ""}" will be deleted for good, along with its photo, favorite, logged and scheduled sessions. It's also taken out of your routines, and a routine left empty is deleted.`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
        onConfirm={confirmDelete}
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

      <AddWorkoutModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={addWorkout}
        categories={categories}
        equipmentList={equipmentList}
        muscleList={muscleList}
        darkMode={darkMode}
      />

      <WorkoutPrefsModal
        visible={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        onSaved={reloadExercises}
        options={{ categories, equipmentList, muscleList, loading: false }}
        darkMode={darkMode}
      />
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────
// Exercise Card (grid tile for web)
// ──────────────────────────────────────────────
function ExerciseCard({ exercise, card, textColor, darkMode, onPress, narrow, phone, favorite, onToggleFavorite }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.exerciseCard,
        narrow && styles.exerciseCardNarrow,
        phone && styles.exerciseCardPhone,
        card,
        hovered && {
          transform: [{ scale: 1.02 }],
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
        },
      ]}
    >
      {/* Image */}
      <View
        style={[
          styles.exerciseImage,
          { backgroundColor: getScreenTones(darkMode).surfaceMuted },
        ]}
      >
        <WorkoutImage
          uri={exercise.image}
          fallbackUri={getWorkoutFallbackImage(
            exercise.category,
            exercise.name,
          )}
          style={styles.exerciseImg}
        />
        <FavoriteButton active={favorite} onPress={onToggleFavorite} filledBackground style={styles.cardHeart} />
      </View>

      {/* Body */}
      <View style={styles.exerciseBody}>
        <Text style={[styles.exerciseName, textColor]} numberOfLines={1}>
          {exercise.name}
        </Text>

        <View style={styles.exerciseMeta}>
          <View
            style={[
              styles.metaPill,
              { backgroundColor: getChipTint("green", darkMode).backgroundColor },
            ]}
          >
            <Ionicons name="folder-outline" size={11} color={shellColors.primary} />
            <Text style={styles.metaPillText}>{exercise.category}</Text>
          </View>
          {exercise.muscles.length > 0 && (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: getChipTint("blue", darkMode).backgroundColor },
              ]}
            >
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

        {/* Start button */}
        <View style={styles.viewBtnRow}>
          <View style={styles.viewBtn}>
            <Ionicons name="play" size={13} color={colors.white} />
            <Text style={styles.viewBtnText}>Start Workout</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Exercise Detail Modal (centered for web)
// ──────────────────────────────────────────────
function ExerciseDetailModal({
  visible,
  exercise: exerciseProp,
  loading: loadingProp,
  onClose,
  onLogSession,
  lastSession: lastSessionProp,
  darkMode,
  planned: plannedProp,
  favorite: favoriteProp,
  onToggleFavorite,
  onSchedule,
  onDelete,
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
  const { width } = useWindowDimensions();
  const narrow = width < 720;
  const bg = darkMode ? "#1a1a1a" : colors.white;
  const { textColor } = getScreenPalette(darkMode);

  return (
    <Modal
      // Never over another screen: hidden once you've navigated away
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, narrow && styles.modalContentNarrow, { backgroundColor: bg }]}>
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
              <Skeleton width="100%" height={220} borderRadius={12} />
              <Skeleton width="50%" height={22} style={{ marginTop: 18 }} />
              <Skeleton width="30%" height={13} style={{ marginTop: 10 }} />
              <Skeleton width="100%" height={13} style={{ marginTop: 20 }} />
              <Skeleton width="90%" height={13} style={{ marginTop: 8 }} />
              <Skeleton width="65%" height={13} style={{ marginTop: 8 }} />
            </View>
          ) : exercise ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {/* Two-column: image left, info right */}
              <View style={[styles.modalTopRow, narrow && styles.modalTopRowNarrow]}>
                {/* Image */}
                <View
                  style={[
                    styles.modalImage,
                    narrow && styles.modalImageNarrow,
                    { backgroundColor: darkMode ? "#222" : "#f3f4f6" },
                  ]}
                >
                  <WorkoutImage
                    uri={exercise.image}
                    fallbackUri={getWorkoutFallbackImage(
                      exercise.category,
                      exercise.name,
                    )}
                    style={[styles.modalImg, narrow && styles.modalImgNarrow]}
                  />
                </View>

                {/* Info */}
                <View style={styles.flex1}>
                  <Text style={[styles.modalTitle, textColor]}>
                    {exercise.name}
                  </Text>

                  <View style={styles.modalBadgeRow}>
                    <View
                      style={[
                        styles.modalBadge,
                        { backgroundColor: getChipTint("green", darkMode).backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalBadgeText,
                          { color: darkMode ? "#8fe06d" : colors.nearBlack },
                        ]}
                      >
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
                </View>
              </View>

              {/* Description */}
              {exercise.description ? (
                <View style={[styles.modalSection, { marginTop: 16 }]}>
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
                  {onDelete && <PlanButton variant="danger" label="Delete" onPress={onDelete} darkMode={darkMode} />}
                </View>
              )}
              {planned && (
                <Text style={[styles.plannedNote, { color: shellColors.primary }]}>
                  Scheduled session. Finishing it here marks it done.
                </Text>
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
                  <View style={styles.extraImagesRow}>
                    {exercise.images.slice(1, 5).map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.extraImage}
                        contentFit="cover"
                      />
                    ))}
                  </View>
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
// Styles (Web-optimized)
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  ...workoutsStyles,
  favSection: { gap: 10, marginBottom: 16 },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 13 },

  // Top row (search + stats)
  topRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  topRowNarrow: { flexDirection: "column", alignItems: "stretch" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0, outlineStyle: "none" },
  statsRow: { flexDirection: "row", gap: 10 },
  // Small screens: the cards sit centred under the search bar
  statsRowNarrow: { justifyContent: "center", flexWrap: "wrap" },

  lastPerformed: { marginTop: 16, borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.infoBg, borderRadius: radii.sm, padding: 11 },

  statCard: {
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
    // Fixed, so the value inside never changes a card's width
    width: 104,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },

  tabsRow: { marginBottom: 16 },
  cardHeart: { position: "absolute", top: 8, right: 8 },
  detailActions: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" },
  plannedNote: { fontSize: 12, fontWeight: "700", marginTop: 16 },

  // Results
  resultTitle: { fontSize: 18, fontWeight: "700" },
  resultCount: { fontSize: 12 },
  resultActions: { flexDirection: "row", alignItems: "center", gap: 10 },

  // Exercise Grid
  exerciseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  // Narrower cards and a taller image, so the photo carries the card:
  // four per row on wide screens, three narrow, two on phones
  exerciseCard: {
    width: "calc(25% - 11px)",
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: "hidden",
    cursor: "pointer",
    transitionDuration: "150ms",
  },
  exerciseCardNarrow: { width: "calc(33.333% - 10px)" },
  exerciseCardPhone: { width: "calc(50% - 7px)" },
  exerciseImage: {
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseImg: { width: "100%", height: 170 },
  exerciseBody: { padding: 12 },
  exerciseMeta: { flexDirection: "row", gap: 6, marginTop: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  equipmentText: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  viewBtnRow: { marginTop: 10 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: shellColors.primary,
    borderRadius: 6,
    paddingVertical: 7,
  },
  viewBtnText: { fontSize: 11, fontWeight: "600", color: colors.white },

  // Load more
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: 16,
    cursor: "pointer",
  },

  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 14 },
  emptySubtitle: { fontSize: 13, marginTop: 4 },

  // Modal (centered dialog for web)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    borderRadius: radii.lg,
    width: "65%",
    maxWidth: 780,
    maxHeight: "85%",
    padding: 28,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  modalContentNarrow: { width: "calc(100% - 24px)", maxHeight: "92%", padding: 18 },
  modalClose: {
    alignSelf: "flex-end",
    padding: 4,
    marginBottom: 8,
    cursor: "pointer",
  },

  modalTopRow: { flexDirection: "row", gap: 24 },
  modalTopRowNarrow: { flexDirection: "column", gap: 16 },
  modalImage: {
    width: 280,
    height: 240,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modalImg: { width: 280, height: 240 },
  modalImageNarrow: { width: "100%", height: 210 },
  modalImgNarrow: { width: "100%", height: 210 },

  modalTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
  modalBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  modalBadgeText: { fontSize: 12, fontWeight: "600" },
  modalSection: { marginBottom: 14 },
  modalSectionTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  modalDesc: { fontSize: 14, lineHeight: 22 },

  extraImagesRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  extraImage: { width: 140, height: 110, borderRadius: 8 },
});