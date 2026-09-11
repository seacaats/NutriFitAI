import DashboardLayout from "@components/nutrifit/DashboardLayout";
import ExerciseWorkoutTracker from "@components/nutrifit/ExerciseWorkoutTracker";
import { useTheme } from "@context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
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
} from "@hooks/useWorkoutApi";
import { radii } from "@theme/nutrifit";
import { Image } from "expo-image";
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

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb",
  };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };
  const mutedText = { color: "#6a7282" };

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);
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
    try {
      const info = await fetchExerciseInfo(exerciseId);
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
          <Ionicons name="search" size={18} color="#6a7282" />
          <TextInput
            style={[styles.searchInput, textColor]}
            placeholder="Search exercises, muscles…"
            placeholderTextColor="#6a7282"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#6a7282" />
            </Pressable>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: darkMode ? "#1a2e14" : "#e7f9df" },
            ]}
          >
            <Ionicons name="barbell" size={18} color="#4CAF2F" />
            <Text style={[styles.statValue, textColor]}>
              {exercises.length}+
            </Text>
            <Text style={[styles.statLabel, mutedText]}>Exercises</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: darkMode ? "#1a2440" : "#e5f0ff" },
            ]}
          >
            <Ionicons name="layers" size={18} color="#2b7fff" />
            <Text style={[styles.statValue, textColor]}>
              {categories.length}
            </Text>
            <Text style={[styles.statLabel, mutedText]}>Categories</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: darkMode ? "#2e1a34" : "#fbe7fb" },
            ]}
          >
            <Ionicons name="body" size={18} color="#c86ee0" />
            <Text style={[styles.statValue, textColor]}>All</Text>
            <Text style={[styles.statLabel, mutedText]}>Muscles</Text>
          </View>
        </View>
      </View>

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
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#4CAF2F" />
          <Text style={[styles.loaderText, mutedText]}>Loading exercises…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="search"
            size={56}
            color={darkMode ? "#364153" : "#d1d5dc"}
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
                <ActivityIndicator size="small" color="#4CAF2F" />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color="#4CAF2F"
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
      <Ionicons name={icon} size={14} color={active ? "#fff" : "#6a7282"} />
      <Text
        style={[
          styles.catPillText,
          active ? styles.catPillTextActive : { color: "#6a7282" },
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
          { backgroundColor: darkMode ? "#333333" : "#f3f4f6" },
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
              { backgroundColor: darkMode ? "#1a2e14" : "#e7f9df" },
            ]}
          >
            <Ionicons name="folder-outline" size={11} color="#4CAF2F" />
            <Text style={styles.metaPillText}>{exercise.category}</Text>
          </View>
          {exercise.muscles.length > 0 && (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: darkMode ? "#1a2440" : "#e5f0ff" },
              ]}
            >
              <Ionicons name="body-outline" size={11} color="#2b7fff" />
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
            <Ionicons name="play" size={13} color="#fff" />
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
  darkMode,
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 720;
  const bg = darkMode ? "#1a1a1a" : "#ffffff";
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };

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
              color={darkMode ? "#fff" : "#111"}
            />
          </Pressable>

          {loading ? (
            <View style={styles.modalLoader}>
              <ActivityIndicator size="large" color="#4CAF2F" />
              <Text style={[styles.loaderText, { marginTop: 12 }]}>
                Loading details…
              </Text>
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
                <View style={styles.modalInfoCol}>
                  <Text style={[styles.modalTitle, textColor]}>
                    {exercise.name}
                  </Text>

                  <View style={styles.modalBadgeRow}>
                    <View
                      style={[
                        styles.modalBadge,
                        { backgroundColor: darkMode ? "#1a2e14" : "#e7f9df" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalBadgeText,
                          { color: darkMode ? "#8fe06d" : "#1a1a1a" },
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
                                backgroundColor: darkMode
                                  ? "#1a2440"
                                  : "#e5f0ff",
                              },
                            ]}
                          >
                            <Ionicons name="body" size={12} color="#2b7fff" />
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#93c5fd" : "#1a1a1a" },
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
                                backgroundColor: darkMode
                                  ? "#2e1a34"
                                  : "#fbe7fb",
                              },
                            ]}
                          >
                            <Ionicons
                              name="body-outline"
                              size={12}
                              color="#c86ee0"
                            />
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#e9b8f6" : "#1a1a1a" },
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
                                backgroundColor: darkMode
                                  ? "#33261a"
                                  : "#fdeee0",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.musclePillText,
                                { color: darkMode ? "#fbbf6a" : "#1a1a1a" },
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
                      { color: darkMode ? "#ccc" : "#4a5565" },
                    ]}
                  >
                    {exercise.description.replace(/<[^>]*>/g, "")}
                  </Text>
                </View>
              ) : null}

              <ExerciseWorkoutTracker exerciseName={exercise.name} darkMode={darkMode} />

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
  catPillActive: { backgroundColor: "#4CAF2F" },
  catPillText: { fontSize: 12, fontWeight: "700" },
  catPillTextActive: { color: "#ffffff" },

  // Results
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
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
  exerciseName: { fontSize: 14, fontWeight: "700" },
  exerciseMeta: { flexDirection: "row", gap: 6, marginTop: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  metaPillText: { fontSize: 10, fontWeight: "600", color: "#6a7282" },
  equipmentText: { fontSize: 10, color: "#6a7282", marginTop: 4 },
  viewBtnRow: { marginTop: 10 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#4CAF2F",
    borderRadius: 6,
    paddingVertical: 7,
  },
  viewBtnText: { fontSize: 11, fontWeight: "600", color: "#fff" },

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
  loadMoreText: { fontSize: 13, fontWeight: "700", color: "#4CAF2F" },

  // Loader / Empty
  loaderWrap: { alignItems: "center", paddingVertical: 60 },
  loaderText: { fontSize: 13, color: "#6a7282", marginTop: 8 },
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
  modalLoader: { alignItems: "center", paddingVertical: 60 },

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
  modalInfoCol: { flex: 1 },

  modalTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
  modalBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  modalBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  modalBadgeText: { fontSize: 12, fontWeight: "600" },
  modalSection: { marginBottom: 14 },
  modalSectionTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  musclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  musclePillText: { fontSize: 11, fontWeight: "600" },
  modalDesc: { fontSize: 14, lineHeight: 22 },

  extraImagesRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  extraImage: { width: 140, height: 110, borderRadius: 8 },
});
