import {
  fetchCategories,
  fetchExerciseInfo,
  fetchExerciseInfoPage,
  getEnglishTranslation,
  getExerciseImage,
  getExerciseImages,
  getMuscleNames,
} from "@/features/workouts/hooks/useWorkoutApi";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

const CATEGORY_ICONS = {
  Abs: "body",
  Arms: "fitness",
  Back: "swap-horizontal",
  Calves: "footsteps",
  Cardio: "heart",
  Chest: "shield",
  Legs: "walk",
  Shoulders: "resize",
};

/**
 * State + data loading for the Workouts screen, shared by workouts/index.jsx and
 * workouts.web.jsx (which differ only in presentation)
 */
export function useExerciseBrowser() {
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
        // image (or we run out of pages entirely)
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

  return {
    categories,
    activeCategory,
    setActiveCategory,
    exercises,
    filtered,
    loading,
    loadingMore,
    hasMore: hasMoreRef.current,
    loadExercises,
    searchQuery,
    setSearchQuery,
    selectedExercise,
    setSelectedExercise,
    detailLoading,
    setDetailLoading,
    openDetail,
    catIcon: CATEGORY_ICONS,
  };
}
