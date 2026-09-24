import ExerciseWorkoutTracker from "@/features/workouts/components/ExerciseWorkoutTracker";
import {
  fetchCategories,
  fetchExerciseInfo,
  fetchExerciseInfoPage,
  getEnglishTranslation,
  getExerciseImage,
  getExerciseImages,
  getMuscleNames,
  getWorkoutFallbackImage,
  hasEnglishTranslation,
  isBlockedLocalizedExercise,
} from "@/features/workouts/hooks/useWorkoutApi";
import { useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getChipTint, getScreenPalette, getScreenTones, radii, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { workoutsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const { darkMode } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 980;
  const phone = width < 620;

  const { card, textColor, mutedText } = getScreenPalette(darkMode);

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);

  // logSession never throws: the user has already done the exercise, so a
  // failed write must not surface as an error on their screen.
  const router = useRouter();
  const { logSession, summary, recent, fetchExerciseHistory } = useWorkoutSessions();

  // History for the exercise open in the detail modal. Fetched on open, not
  // with the grid: one request per visible card would be dozens of requests
  // for a line most of them never show.
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const PAGE_SIZE = 20;

  // Load categories on mount
  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  // Load exercises when category changes
  useEffect(() => {
    loadExercises(true);
  }, [activeCategory]);

  const loadExercises = useCallback(
    async (reset = false) => {
      if (reset) {
        offsetRef.current = 0;
        hasMoreRef.current = true;
        setLoading(true);
      } else {
        if (!hasMoreRef.current) return;
        setLoadingMore(true);
      }

      try {
        let offset = offsetRef.current;
        const collected = [];
        let hasMore = true;

        // Many wger exercises have no uploaded photo, so keep paging through the
        // API until we have a full page of exercises that actually have a real
        // image (or we run out of pages entirely).
        while (collected.length < PAGE_SIZE && hasMore) {
          const infoPage = await fetchExerciseInfoPage({
            category: activeCategory,
            limit: PAGE_SIZE,
            offset,
          });
          const results = infoPage.results || [];

          for (const info of results) {
            if (!hasEnglishTranslation(info)) continue;
            const realImage = getExerciseImages(info)[0];
            if (!realImage) continue; // skip exercises without a real image
            const { name, description } = getEnglishTranslation(info);
            if (isBlockedLocalizedExercise(name)) continue;
            collected.push({
              id: info.id,
              name,
              description,
              image: realImage,
              muscles: getMuscleNames(info),
              category: info.category?.name || "Other",
              equipment: info.equipment?.map((e) => e.name) || [],
            });
          }

          offset += results.length;
          hasMore = infoPage.next !== null;
        }

        const valid = collected.filter((e) => e && e.name);
        if (reset) {
          setExercises(valid);
        } else {
          setExercises((prev) => [...prev, ...valid]);
        }

        offsetRef.current = offset;
        hasMoreRef.current = hasMore;
      } catch {
        // silently handle
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory],
  );

  // Client-side search
  const englishExercises = exercises.filter((exercise) => !isBlockedLocalizedExercise(exercise.name));
  const filtered = searchQuery
    ? englishExercises.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.muscles.some((m) =>
            m.toLowerCase().includes(searchQuery.toLowerCase()),
          ) ||
          e.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : englishExercises;

  // Open detail modal
  const openDetail = async (exerciseId, cardImage) => {
    setDetailLoading(true);
    setSelectedExercise(null);
    setExerciseHistory(null);
    try {
      const info = await fetchExerciseInfo(exerciseId);
      // Fired alongside the detail load rather than awaited with it: the
      // history line is supplementary, and making the sheet wait on it would
      // delay the whole modal for a line that may not exist.
      fetchExerciseHistory(exerciseId).then((history) =>
        setExerciseHistory(history?.last || null),
      );
      const { name, description } = getEnglishTranslation(info);
      const image = cardImage || getExerciseImage(info);
      const muscles = getMuscleNames(info);
      setSelectedExercise({
        id: info.id,
        name,
        description,
        image,
        muscles,
        musclesSecondary:
          info.muscles_secondary?.map((m) => m.name_en || m.name) || [],
        category: info.category?.name || "Other",
        equipment: info.equipment?.map((e) => e.name) || [],
        images: getExerciseImages(info),
      });
    } catch {
      setSelectedExercise(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const catIcon = {
    Abs: "body",
    Arms: "fitness",
    Back: "swap-horizontal",
    Calves: "footsteps",
    Cardio: "heart",
    Chest: "shield",
    Legs: "walk",
    Shoulders: "resize",
  };

  return (
    <DashboardLayout>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.pageTitle, textColor]}>Workouts</Text>
          <Text style={[styles.pageSubtitle, mutedText]}>
            Browse workouts with photos from the wger.de database
          </Text>
        </View>
      </View>

      {/* Search + Stats Row */}
      <View style={[styles.topRow, narrow && styles.topRowNarrow]}>
        {/* Search Bar */}
        <View style={[styles.searchBar, card]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, textColor]}
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
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: getChipTint("green", darkMode).backgroundColor },
            ]}
          >
            <Ionicons name="barbell" size={18} color={shellColors.primary} />
            <Text style={[styles.statValue, textColor]}>
              {summary
                ? summary.target
                  ? `${summary.completed}/${summary.target}`
                  : `${summary.completed}`
                : "\u2014"}
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

      {/*
        Recent workouts. Hidden entirely when empty rather than shown as an
        empty state: a new user has not failed at anything, and a "Recent"
        heading with nothing under it reads as a broken screen. It appears the
        moment they finish their first workout.
      */}
      {recent.length > 0 && (
        <View style={styles.recentBlock}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, textColor]}>Recent</Text>
            {/*
              Shown only when there is more than this list holds — a "See all"
              leading to the same five rows is a dead end.
            */}
            {/*
              Always shown once there is any history. Gating this on
              "more than the five listed" made the history page unreachable
              for anyone with five or fewer sessions — an unreachable screen is
              worse than a slightly redundant link.
            */}
            <Pressable onPress={() => router.push("/workouts/history")}>
              <Text style={styles.recentSeeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {recent.map((session) => (
              <RecentSessionRow
                key={session.id}
                session={session}
                textColor={textColor}
                borderColor={card.borderColor}
              />
            ))}
          </View>
        </View>
      )}

      {/* Category Pills */}
      <View style={styles.catRow}>
        <CategoryPill
          label="All"
          icon="grid"
          active={activeCategory === null}
          onPress={() => setActiveCategory(null)}
          darkMode={darkMode}
        />
        {categories.map((cat) => (
          <CategoryPill
            key={cat.id}
            label={cat.name}
            icon={catIcon[cat.name] || "barbell"}
            active={activeCategory === cat.id}
            onPress={() => setActiveCategory(cat.id)}
            darkMode={darkMode}
          />
        ))}
      </View>

      {/* Results Header */}
      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, textColor]}>
          {activeCategory
            ? categories.find((c) => c.id === activeCategory)?.name ||
              "Exercises"
            : "All Exercises"}
        </Text>
        <Text style={[styles.resultCount, mutedText]}>
          {filtered.length} loaded
        </Text>
      </View>

      {/* Exercise Grid / List */}
      {loading ? (
        <View style={styles.exerciseGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[styles.exerciseCard, narrow && styles.exerciseCardNarrow, phone && styles.exerciseCardPhone, card]}
            >
              <Skeleton width="100%" height={140} borderRadius={0} />
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

      {/* Detail Modal */}
      <ExerciseDetailModal
        visible={detailLoading || selectedExercise !== null}
        exercise={selectedExercise}
        loading={detailLoading}
        onClose={() => {
          setSelectedExercise(null);
          setDetailLoading(false);
        }}
        onLogSession={logSession}
        lastSession={exerciseHistory}
        darkMode={darkMode}
      />
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────
// Category Pill
// ──────────────────────────────────────────────
function CategoryPill({ label, icon, active, onPress, darkMode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.catPill,
        active
          ? styles.catPillActive
          : {
              backgroundColor: hovered
                ? darkMode
                  ? "#333"
                  : "#e5e7eb"
                : darkMode
                  ? "#222"
                  : "#f3f4f6",
            },
      ]}
    >
      <Ionicons name={icon} size={14} color={active ? colors.white : colors.textMuted} />
      <Text
        style={[
          styles.catPillText,
          active ? styles.catPillTextActive : { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Exercise Card (grid tile for web)
// ──────────────────────────────────────────────
function ExerciseCard({ exercise, card, textColor, darkMode, onPress, narrow, phone }) {
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

function WorkoutImage({ uri, fallbackUri, style }) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: failed ? fallbackUri : uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="low"
      transition={150}
      onError={() => {
        if (!failed && fallbackUri && uri !== fallbackUri) setFailed(true);
      }}
    />
  );
}

// ──────────────────────────────────────────────
// Exercise Detail Modal (centered for web)
// ──────────────────────────────────────────────
function ExerciseDetailModal({
  visible,
  exercise,
  loading,
  onClose,
  onLogSession,
  lastSession,
  darkMode,
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 720;
  const bg = darkMode ? "#1a1a1a" : colors.white;
  const { textColor } = getScreenPalette(darkMode);

  return (
    <Modal
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

                  {/* Primary Muscles */}
                  {exercise.muscles.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionTitle, textColor]}>
                        Primary Muscles
                      </Text>
                      <View style={styles.muscleRow}>
                        {exercise.muscles.map((m) => (
                          <View
                            key={m}
                            style={[
                              styles.musclePill,
                              {
                                backgroundColor: getChipTint("blue", darkMode).backgroundColor,
                              },
                            ]}
                          >
                            <Ionicons name="body" size={12} color={chipTints.blue.icon} />
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#93c5fd" : colors.nearBlack },
                              ]}
                            >
                              {m}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Secondary Muscles */}
                  {exercise.musclesSecondary?.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionTitle, textColor]}>
                        Secondary Muscles
                      </Text>
                      <View style={styles.muscleRow}>
                        {exercise.musclesSecondary.map((m) => (
                          <View
                            key={m}
                            style={[
                              styles.musclePill,
                              {
                                backgroundColor: getChipTint("purple", darkMode).backgroundColor,
                              },
                            ]}
                          >
                            <Ionicons
                              name="body-outline"
                              size={12}
                              color={chipTints.purple.icon}
                            />
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#e9b8f6" : colors.nearBlack },
                              ]}
                            >
                              {m}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Equipment */}
                  {exercise.equipment.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionTitle, textColor]}>
                        Equipment
                      </Text>
                      <View style={styles.muscleRow}>
                        {exercise.equipment.map((e) => (
                          <View
                            key={e}
                            style={[
                              styles.musclePill,
                              {
                                backgroundColor: getChipTint("orange", darkMode).backgroundColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#fbbf6a" : colors.nearBlack },
                              ]}
                            >
                              🏋️ {e}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
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

              <ExerciseWorkoutTracker
                exerciseName={exercise.name}
                exerciseRef={exercise.id}
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

/**
 * "Today" / "Tue" / "12 Mar".
 *
 * completedAt is an INSTANT, so new Date() is right here. The comparison is on
 * local calendar days rather than a 24-hour subtraction: a session finished at
 * 11pm yesterday is "Yesterday", not "today, 9 hours ago".
 */
function relativeDay(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "short" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * One row of workout history.
 *
 * Skipped sessions are shown, not hidden — the user did that work — but marked
 * differently so the list stays honest about what was finished. Amber rather
 * than red: an abandoned set is not an error, and colouring it like one would
 * scold someone for training.
 */
function RecentSessionRow({ session, textColor, borderColor }) {
  const skipped = session.status === "skipped";
  const minutes = session.actualDurationSeconds
    ? Math.round(session.actualDurationSeconds / 60)
    : null;

  return (
    <View style={[styles.recentRow, { borderBottomColor: borderColor }]}>
      <View
        style={[
          styles.recentIcon,
          { backgroundColor: skipped ? chipTints.orange.light : chipTints.green.light },
        ]}
      >
        <Ionicons
          name={skipped ? "pause" : "barbell"}
          size={16}
          color={skipped ? colors.skippedAmber : shellColors.primary}
        />
      </View>

      <View style={styles.recentBody}>
        <Text style={[styles.recentName, textColor]} numberOfLines={1}>
          {session.exerciseName}
        </Text>
        <Text style={styles.recentMeta}>
          {skipped
            ? `${session.completedSets} of ${session.targetSets} sets`
            : `${session.completedSets} x ${session.targetReps}`}
          {minutes ? ` \u00b7 ${minutes} min` : ""}
        </Text>
      </View>

      <Text style={styles.recentWhen}>{relativeDay(session.completedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ...workoutsStyles,

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { fontSize: 13, marginTop: 4 },

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

  recentBlock: { marginBottom: 16 },
  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  recentTitle: { fontSize: 15, fontWeight: "800" },
  recentSeeAll: { fontSize: 12, fontWeight: "700", color: shellColors.primary, cursor: "pointer" },
  recentList: { gap: 0 },
  recentIcon: { width: 32, height: 32, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },

  lastPerformed: { marginTop: 16, borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.infoBg, borderRadius: radii.sm, padding: 11 },

  statCard: {
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
    minWidth: 90,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },

  // Categories
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    cursor: "pointer",
  },

  // Results
  resultTitle: { fontSize: 18, fontWeight: "700" },
  resultCount: { fontSize: 12 },

  // Exercise Grid
  exerciseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  exerciseCard: {
    width: "calc(33.333% - 10px)",
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: "hidden",
    cursor: "pointer",
    transitionDuration: "150ms",
  },
  exerciseCardNarrow: { width: "calc(50% - 7px)" },
  exerciseCardPhone: { width: "100%" },
  exerciseImage: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseImg: { width: "100%", height: 140 },
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

  // Loader / Empty
  loaderWrap: { alignItems: "center", paddingVertical: 60 },
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
  musclePillText: { fontSize: 11, fontWeight: "600" },
  modalDesc: { fontSize: 14, lineHeight: 22 },

  extraImagesRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  extraImage: { width: 140, height: 110, borderRadius: 8 },
});