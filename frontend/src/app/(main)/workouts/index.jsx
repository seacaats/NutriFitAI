import ExerciseWorkoutTracker from "@/features/workouts/components/ExerciseWorkoutTracker";
import {
  fetchCategories,
  fetchExerciseInfo,
  fetchExerciseInfoPage,
  getEnglishTranslation,
  hasEnglishTranslation,
  isBlockedLocalizedExercise,
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
import { chipTints, colors, radii, screenTones, shellColors } from "@/shared/theme/nutrifit";
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
  View,
} from "react-native";

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────
export default function WorkoutsScreen() {
  // darkMode is read here (not just `shell`) because it's threaded down to
  // RecentSessionRow below, which needs the raw boolean for its own
  // light/dark text color -- not the resolved shell palette.
  const { shell: c, darkMode } = useTheme();
  const router = useRouter();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null); // null = "All"
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);

  // logSession never throws: the user has already done the exercise, so a
  // failed write must not surface as an error on their screen.
  const { logSession, summary, recent, fetchExerciseHistory } = useWorkoutSessions();

  // History for the exercise currently open in the detail modal. Fetched on
  // open rather than with the grid: one request per visible card would be
  // twenty requests for a line most of them never show.
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
        // silently handle error
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory],
  );

  // Search filtering (client-side on loaded exercises)
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

  // Open exercise detail modal
  const openDetail = async (exerciseId, cardImage) => {
    setDetailLoading(true);
    setSelectedExercise(null);
    setExerciseHistory(null);
    try {
      const info = await fetchExerciseInfo(exerciseId);
      // Fired alongside the detail load, not awaited with it: the history line
      // is supplementary, and making the modal wait on it would delay the
      // whole sheet for a line that may not exist.
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

  // ── Category icon map ──
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
    <DashboardLayout hideTabBar>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.sidebarText} />
        </Pressable>
        <Text style={[styles.pageTitle, textColor]}>Workouts</Text>
        {/* Spacer to keep title centered */}
        <View style={styles.backBtn} />
      </View>
      <Text style={styles.pageSubtitle}>Browse workouts with photos</Text>

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

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        <Pressable
          onPress={() => setActiveCategory(null)}
          style={[
            styles.catPill,
            activeCategory === null
              ? styles.catPillActive
              : { backgroundColor: c.inactiveNavHoverBg },
          ]}
        >
          <Ionicons
            name="grid"
            size={14}
            color={activeCategory === null ? colors.white : c.inactiveNavText}
          />
          <Text
            style={[
              styles.catPillText,
              activeCategory === null
                ? styles.catPillTextActive
                : { color: c.inactiveNavText },
            ]}
          >
            All
          </Text>
        </Pressable>

        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setActiveCategory(cat.id)}
            style={[
              styles.catPill,
              activeCategory === cat.id
                ? styles.catPillActive
                : { backgroundColor: c.inactiveNavHoverBg },
            ]}
          >
            <Ionicons
              name={catIcon[cat.name] || "barbell"}
              size={14}
              color={activeCategory === cat.id ? colors.white : c.inactiveNavText}
            />
            <Text
              style={[
                styles.catPillText,
                activeCategory === cat.id
                  ? styles.catPillTextActive
                  : { color: c.inactiveNavText },
              ]}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Quick Stats */}
      {/*
        Was "1,400+ Exercises / 15 Categories / All Muscles" — facts about the
        catalog. Nothing on this screen told the user anything about themselves.
        Same component and position, the user's own week instead.
      */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: chipTints.green.light }]}>
          <Ionicons name="barbell" size={18} color={shellColors.primary} />
          <Text style={styles.statValue}>
            {summary
              ? summary.target
                ? `${summary.completed}/${summary.target}`
                : `${summary.completed}`
              : "\u2014"}
          </Text>
          <Text style={styles.statLabel}>This week</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: chipTints.blue.light }]}>
          <Ionicons name="time" size={18} color={chipTints.blue.icon} />
          <Text style={styles.statValue}>{summary ? summary.totalMinutes : "\u2014"}</Text>
          <Text style={styles.statLabel}>Minutes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: chipTints.purple.light }]}>
          <Ionicons name="layers" size={18} color={chipTints.purple.icon} />
          <Text style={styles.statValue}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
      </View>

      {/*
        Recent workouts. Hidden entirely when empty rather than shown with an
        empty-state card: a new user has not failed at anything, and a section
        headed "Recent" with nothing under it reads as a broken screen. It
        appears the moment they finish their first workout.
      */}
      {recent.length > 0 && (
        <View style={styles.recentBlock}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, textColor]}>Recent</Text>
            {/*
              Shown only when there is more than this list holds. A "See all"
              that leads to the same five rows is a dead end the user has to
              learn to ignore.
            */}
            {/*
              Always shown once there is any history. Gating this on
              "more than the five listed" made the history page unreachable
              for anyone with five or fewer sessions — an unreachable screen is
              worse than a slightly redundant link.
            */}
            <Pressable onPress={() => router.push("/workouts/history")} hitSlop={8}>
              <Text style={styles.recentSeeAll}>See all</Text>
            </Pressable>
          </View>
          {recent.map((session) => (
            <RecentSessionRow
              key={session.id}
              session={session}
              darkMode={darkMode}
              borderColor={c.dropdownBorder}
            />
          ))}
        </View>
      )}

      {/* Results Header */}
      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, textColor]}>
          {activeCategory
            ? categories.find((c) => c.id === activeCategory)?.name ||
              "Exercises"
            : "All Exercises"}
        </Text>
        <Text style={styles.resultCount}>{filtered.length} loaded</Text>
      </View>

      {/* Exercise List */}
      {loading ? (
        <View>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.exerciseCard, card]}>
              <Skeleton width={56} height={56} borderRadius={8} />
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

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        visible={detailLoading || selectedExercise !== null}
        exercise={selectedExercise}
        loading={detailLoading}
        onClose={() => {
          setSelectedExercise(null);
          setDetailLoading(false);
        }}
        shellColors={c}
        onLogSession={logSession}
        lastSession={exerciseHistory}
      />
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────
// Exercise Card Component
// ──────────────────────────────────────────────
function ExerciseCard({ exercise, card, textColor, shellColors, onPress }) {
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

      <View style={styles.cardStartButton}>
        <Ionicons name="play" size={12} color={colors.white} />
        <Text style={styles.cardStartText}>Start</Text>
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
// Exercise Detail Modal
// ──────────────────────────────────────────────
function ExerciseDetailModal({
  visible,
  exercise,
  loading,
  onClose,
  shellColors,
  onLogSession,
  lastSession,
}) {
  const { darkMode } = useTheme();
  // Note: `shellColors` here is the resolved-per-theme prop (see call site),
  // not the theme module's raw shellColors export, so the dark literal below
  // can't be swapped for `shellColors.dark.shellBg` without breaking on this
  // shadowed name -- left as a literal rather than threading another prop
  // through for one modal background.
  const bg = darkMode ? "#111111" : colors.white;
  const textColor = { color: darkMode ? colors.white : screenTones.light.text };

  return (
    <Modal
      visible={visible}
      animationType="slide"
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
                  style={[styles.modalBadge, { backgroundColor: chipTints.green.light }]}
                >
                  <Text style={styles.modalBadgeText}>
                    📂 {exercise.category}
                  </Text>
                </View>
              </View>

              {/* Muscles */}
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
                          { backgroundColor: chipTints.blue.light },
                        ]}
                      >
                        <Ionicons name="body" size={12} color={chipTints.blue.icon} />
                        <Text style={styles.musclePillText}>{m}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

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
                          { backgroundColor: chipTints.purple.light },
                        ]}
                      >
                        <Ionicons
                          name="body-outline"
                          size={12}
                          color={chipTints.purple.icon}
                        />
                        <Text style={styles.musclePillText}>{m}</Text>
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
                          { backgroundColor: chipTints.orange.light },
                        ]}
                      >
                        <Text style={styles.musclePillText}>🏋️ {e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

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

/**
 * "Today" / "Tue" / "12 Mar" — the shape a person actually reads.
 *
 * completedAt is an INSTANT, so new Date() is correct here. The day-boundary
 * comparison uses local calendar days rather than a 24-hour subtraction: a
 * session finished at 11pm yesterday is "Yesterday", not "today, 9 hours ago".
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
 * A skipped session is shown, not hidden — the user did that work — but marked
 * differently so the list stays honest about what was finished. Amber rather
 * than red: an abandoned set is not an error, and colouring it like one would
 * scold someone for training.
 */
function RecentSessionRow({ session, darkMode, borderColor }) {
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
        <Text
          style={[styles.recentName, { color: darkMode ? colors.white : screenTones.light.text }]}
          numberOfLines={1}
        >
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

  recentBlock: { marginTop: 18 },
  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  recentTitle: { fontSize: 15, fontWeight: "700" },
  recentSeeAll: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  recentIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },

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

  // Categories
  catScroll: { marginBottom: 14 },
  catContent: { gap: 8 },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: radii.sm,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.nearBlack },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.textMuted },

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
  exerciseImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseImg: { width: 56, height: 56 },
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

  // Loader / Empty
  loaderWrap: { alignItems: "center", paddingVertical: 48 },
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
  modalBadgeText: { fontSize: 12, fontWeight: "600", color: colors.nearBlack },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  musclePillText: { fontSize: 11, fontWeight: "600", color: colors.nearBlack },
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