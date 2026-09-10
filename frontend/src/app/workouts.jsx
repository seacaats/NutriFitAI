import DashboardLayout from "@components/nutrifit/DashboardLayout";
import ExerciseWorkoutTracker from "@components/nutrifit/ExerciseWorkoutTracker";
import { useTheme } from "@context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  fetchCategories,
  fetchExerciseInfo,
  fetchExerciseInfoPage,
  getEnglishTranslation,
  getExerciseImage,
  getExerciseImages,
  getMuscleNames,
  getWorkoutFallbackImage,
} from "@hooks/useWorkoutApi";
import { radii } from "@theme/nutrifit";
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
  const { shell: c } = useTheme();
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
            const realImage = getExerciseImages(info)[0];
            if (!realImage) continue; // skip exercises without a real image
            const { name, description } = getEnglishTranslation(info);
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
  const filtered = searchQuery
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.muscles.some((m) =>
            m.toLowerCase().includes(searchQuery.toLowerCase()),
          ) ||
          e.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : exercises;

  // Open exercise detail modal
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
            color={activeCategory === null ? "#fff" : c.inactiveNavText}
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
              color={activeCategory === cat.id ? "#fff" : c.inactiveNavText}
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
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#e7f9df" }]}>
          <Ionicons name="barbell" size={18} color="#4CAF2F" />
          <Text style={styles.statValue}>{exercises.length}+</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#e5f0ff" }]}>
          <Ionicons name="layers" size={18} color="#2b7fff" />
          <Text style={styles.statValue}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fbe7fb" }]}>
          <Ionicons name="body" size={18} color="#c86ee0" />
          <Text style={styles.statValue}>All</Text>
          <Text style={styles.statLabel}>Muscles</Text>
        </View>
      </View>

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
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#4CAF2F" />
          <Text style={styles.loaderText}>Loading exercises…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="search" size={48} color="#d1d5dc" />
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
      <View style={styles.exerciseInfo}>
        <Text style={[styles.exerciseName, textColor]} numberOfLines={1}>
          {exercise.name}
        </Text>

        <View style={styles.exerciseMeta}>
          <View style={styles.metaPill}>
            <Ionicons name="folder-outline" size={11} color="#4CAF2F" />
            <Text style={styles.metaPillText}>{exercise.category}</Text>
          </View>
          {exercise.muscles.length > 0 && (
            <View style={styles.metaPill}>
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
      </View>

      <View style={styles.cardStartButton}>
        <Ionicons name="play" size={12} color="#ffffff" />
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
}) {
  const { darkMode } = useTheme();
  const bg = darkMode ? "#111111" : "#ffffff";
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };

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
                  style={[styles.modalBadge, { backgroundColor: "#e7f9df" }]}
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
                          { backgroundColor: "#e5f0ff" },
                        ]}
                      >
                        <Ionicons name="body" size={12} color="#2b7fff" />
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
                          { backgroundColor: "#fbe7fb" },
                        ]}
                      >
                        <Ionicons
                          name="body-outline"
                          size={12}
                          color="#c86ee0"
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
                          { backgroundColor: "#fdeee0" },
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
    color: "#6a7282",
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
  catPillActive: { backgroundColor: "#4CAF2F" },
  catPillText: { fontSize: 12, fontWeight: "700" },
  catPillTextActive: { color: "#ffffff" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: radii.sm,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#6a7282" },

  // Results
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultTitle: { fontSize: 16, fontWeight: "700" },
  resultCount: { fontSize: 12, color: "#6a7282" },

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
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 14, fontWeight: "700" },
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
  metaPillText: { fontSize: 10, fontWeight: "600", color: "#6a7282" },
  equipmentText: { fontSize: 10, color: "#6a7282", marginTop: 3 },

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
  loadMoreText: { fontSize: 13, fontWeight: "700", color: "#4CAF2F" },

  // Loader / Empty
  loaderWrap: { alignItems: "center", paddingVertical: 48 },
  loaderText: { fontSize: 13, color: "#6a7282", marginTop: 8 },
  emptyWrap: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: "#6a7282", marginTop: 4 },

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
  modalLoader: { alignItems: "center", paddingVertical: 60 },
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
  modalBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  modalBadgeText: { fontSize: 12, fontWeight: "600", color: "#1a1a1a" },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  musclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  musclePillText: { fontSize: 11, fontWeight: "600", color: "#1a1a1a" },
  modalDesc: { fontSize: 13, lineHeight: 20 },
  extraImage: {
    width: 120,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
  },
  cardStartButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 14, backgroundColor: "#4CAF2F", paddingHorizontal: 9, paddingVertical: 7 },
  cardStartText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
});
