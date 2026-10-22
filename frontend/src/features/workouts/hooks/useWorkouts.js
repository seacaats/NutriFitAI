import {
  createWorkout,
  deleteWorkout,
  fetchCategories,
  fetchEquipment,
  fetchExerciseInfo,
  fetchExerciseInfoPage,
  fetchMuscles,
  getEnglishTranslation,
  getExerciseImage,
  getExerciseImages,
  getMuscleNames,
  getWorkoutFallbackImage,
  hasEnglishTranslation,
  isBlockedLocalizedExercise,
  uploadWorkoutPhoto,
} from "@/features/workouts/hooks/useWorkoutApi";
import { useWorkoutPlan, useWorkoutSessions } from "@/features/workouts/hooks/useWorkoutSessions";
import { useWorkoutTab } from "@/features/workouts/hooks/useWorkoutTab";
import { apiClient, requireOnline } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

// Everything the Workouts screen keeps, shared by web and phone: the exercise
// catalog and its filters, the plan (favorites, routines, schedule), and the
// detail, schedule, editor and player dialogs
// Exercises per catalog batch, also the number of loading placeholders
export const PAGE_SIZE = 20;

// A Modal's fade-in, so a failed load doesn't close it mid-animation
const MODAL_FADE_MS = 350;

// Shuffled Browse orders. Mirrors SHUFFLE_VARIANTS in the backend's
// workoutsController.js; kept small since each is its own offline cache entry
const SHUFFLE_VARIANTS = 8;

// A new order, never the one already showing
function rollShuffle(prev) {
  let next;
  do next = 1 + Math.floor(Math.random() * SHUFFLE_VARIANTS);
  while (next === prev);
  return next;
}

export function useWorkouts() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Opened from a recommendation: /workouts?search=<exercise name>, or
  // /workouts?rec=<id> for a routine card (below)
  const { search: linkedSearch, rec: linkedRec } = useLocalSearchParams();
  const linked = typeof linkedSearch === "string" ? linkedSearch : "";
  const [searchQuery, setSearchQuery] = useState(linked);
  // What is actually sent to the server, trailing the input so typing doesn't
  // fire a request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(linked.trim());
  const [selectedExercise, setSelectedExercise] = useState(null);
  // A ref, so a reload sees the new roll at once. Rolled again on every filter
  // or preference change (and on refresh); paging keeps the same one
  const shuffleRef = useRef(rollShuffle());
  // The grid leads with the user's preferred exercises ("Picked for you")
  const [suggested, setSuggested] = useState(false);
  // The "Preferences" dialog (WorkoutPrefsModal)
  const [prefsOpen, setPrefsOpen] = useState(false);
  // The "Add workout" dialog (AddWorkoutModal)
  const [addOpen, setAddOpen] = useState(false);

  // logSession never throws: the user has already done the exercise, so a
  // failed write must not surface as an error on their screen.
  const {
    logSession, summary, recent, fetchExerciseHistory, refresh: refreshSessions, loading: sessionsLoading,
  } = useWorkoutSessions({ recentLimit: 20 });

  // Favorites, routines and the 7-day schedule (useWorkoutPlan in useWorkoutSessions.js)
  const plan = useWorkoutPlan();
  const [tab, setTab] = useWorkoutTab();

  // Equipment filter: null (all) | "none" | "any" | an equipment id
  const [equipment, setEquipment] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [muscleList, setMuscleList] = useState([]);
  // Muscle filters, as muscle ids. A muscle is main or secondary, never both
  const [muscles, setMuscles] = useState([]);
  const [musclesSecondary, setMusclesSecondary] = useState([]);
  // Whose workouts: null (all) | "wger" (the catalog) | "user" (their own)
  const [workoutSource, setWorkoutSource] = useState(null);

  // Favorites reuses the Browse grid, limited to favorited exercises. Other
  // tabs keep whatever the grid last showed, so coming back doesn't reload it
  const favKey = plan.favorites.filter((f) => f.kind === "exercise").map((f) => f.refId).join(",");
  const lastSourceRef = useRef("all");
  if (tab === "browse") lastSourceRef.current = "all";
  else if (tab === "favorites") lastSourceRef.current = `fav:${favKey}`;
  const source = lastSourceRef.current;
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [editor, setEditor] = useState({ open: false, routine: null });
  const [player, setPlayerState] = useState({ routine: null, plannedId: null });
  // Opening the player starts a workout; closing it always works
  const setPlayer = useCallback((next) => {
    if (next?.routine && !requireOnline()) return;
    setPlayerState(next);
  }, []);
  // A routine recommendation: the editor opens pre-filled as a new routine,
  // saved only when the user saves it. A failure leaves the screen as it was
  const startedRec = useRef(null);
  useEffect(() => {
    if (typeof linkedRec !== "string" || startedRec.current === linkedRec) return;
    startedRec.current = linkedRec;
    apiClient
      .get(`/recommendations/${linkedRec}/draft`, { auth: true })
      .then((draft) => setEditor({ open: true, routine: draft }))
      .catch(() => {});
  }, [linkedRec]);
  // Set when the detail sheet was opened from a scheduled session
  const [detailPlan, setDetailPlan] = useState(null);

  // History for the exercise open in the detail modal. Fetched on open, not
  // with the grid: one request per visible card would be dozens of requests
  // for a line most of them never show.
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  // Bumped on every reset, so a slow response for an old search or filter
  // can't land on top of a newer one
  const loadGeneration = useRef(0);

  // Load categories on mount
  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {});
    fetchEquipment()
      .then((list) => setEquipmentList(list || []))
      .catch(() => {});
    fetchMuscles()
      .then((list) => setMuscleList(list || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Load exercises when a filter or the search changes, with a fresh shuffle
  useEffect(() => {
    shuffleRef.current = rollShuffle(shuffleRef.current);
    loadExercises(true);
  }, [activeCategory, equipment, muscles, musclesSecondary, workoutSource, source, debouncedSearch]);

  const loadExercises = useCallback(
    async (reset = false) => {
      if (reset) {
        loadGeneration.current += 1;
        offsetRef.current = 0;
        hasMoreRef.current = true;
        setLoading(true);
      } else {
        if (!hasMoreRef.current) return;
        setLoadingMore(true);
      }

      const generation = loadGeneration.current;
      try {
        let offset = offsetRef.current;
        const collected = [];
        let hasMore = true;
        // Favorites tab: only those ids, and nothing to fetch when there are none
        const favIds = source.startsWith("fav:") ? source.slice(4).split(",").filter(Boolean).map(Number) : null;
        if (favIds && !favIds.length) hasMore = false;
        // Browse is shuffled (preferred exercises first when unfiltered, for
        // "Picked for you"); Favorites keeps its own order
        let pageSuggested = false;

        // Many wger exercises have no uploaded photo, so keep paging through the
        // API until we have a full page of exercises that actually have a real
        // image (or we run out of pages entirely).
        while (collected.length < PAGE_SIZE && hasMore) {
          const infoPage = await fetchExerciseInfoPage({
            category: activeCategory,
            equipment,
            muscles,
            musclesSecondary,
            source: workoutSource || undefined,
            // Searched on the server, across the whole catalog and the user's
            // own workouts, not just the pages already loaded
            search: debouncedSearch || undefined,
            ids: favIds || undefined,
            shuffle: favIds || debouncedSearch ? undefined : shuffleRef.current,
            limit: PAGE_SIZE,
            offset,
          });
          if (generation !== loadGeneration.current) return; // superseded
          const results = infoPage.results || [];
          pageSuggested = infoPage.suggested;

          for (const info of results) {
            if (!hasEnglishTranslation(info)) continue;
            // The user's own workouts have no photo, they get the category's
            const realImage = getExerciseImages(info)[0]
              || (info.source === "user" ? getWorkoutFallbackImage(info.category?.name) : null);
            if (!realImage) continue; // skip exercises without a real image
            const { name, description } = getEnglishTranslation(info);
            if (isBlockedLocalizedExercise(name)) continue;
            collected.push({
              id: info.id,
              source: info.source,
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

        if (generation !== loadGeneration.current) return;
        const valid = collected.filter((e) => e && e.name);
        if (reset) {
          setExercises(valid);
          setSuggested(pageSuggested);
        } else {
          setExercises((prev) => [...prev, ...valid]);
        }

        offsetRef.current = offset;
        hasMoreRef.current = hasMore;
      } catch {
        // silently handle
      } finally {
        if (generation === loadGeneration.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeCategory, equipment, muscles, musclesSecondary, workoutSource, source, debouncedSearch],
  );

  // The server already applied the search; this only drops blocked listings
  const englishExercises = exercises.filter((exercise) => !isBlockedLocalizedExercise(exercise.name));
  const filtered = englishExercises;

  // Open detail modal. `planned` = { plannedId, targetSets, targetReps } when
  // started from the Upcoming tab, so logging completes that scheduled row
  // Bumped on every open and close: a load that finishes after its dialog
  // was closed (the server coming back much later, say) is dropped instead
  // of popping the dialog back open
  const detailRequest = useRef(0);
  // The load in flight, cancelled outright when the dialog closes
  const detailAbort = useRef(null);

  const closeDetail = useCallback(() => {
    detailRequest.current += 1;
    detailAbort.current?.abort();
    detailAbort.current = null;
    setSelectedExercise(null);
    setDetailLoading(false);
    setDetailPlan(null);
  }, []);

  const openDetail = async (exerciseId, cardImage, planned = null) => {
    // No details dialog while the server can't be reached
    if (!requireOnline()) return;
    const request = ++detailRequest.current;
    detailAbort.current?.abort();
    const abort = new AbortController();
    detailAbort.current = abort;
    setDetailPlan(planned);
    setDetailLoading(true);
    setSelectedExercise(null);
    setExerciseHistory(null);
    try {
      const info = await fetchExerciseInfo(exerciseId, { signal: abort.signal });
      if (request !== detailRequest.current) return;
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
        source: info.source,
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
      // Nothing saved and the server unreachable (or a server error): the
      // dialog closes and the screen alert under the title says why. Only
      // once its opening fade has finished: a native Modal shut mid-animation
      // can be left half-open and show again on a later render
      if (request === detailRequest.current) {
        setTimeout(() => request === detailRequest.current && closeDetail(), MODAL_FADE_MS);
      }
      return;
    }
    if (request === detailRequest.current) setDetailLoading(false);
  };

  // Logs a tracker run; a scheduled one completes its planned row instead
  const logFromDetail = async (payload) => {
    const plannedId = detailPlan?.plannedId;
    const data = await logSession(plannedId ? { ...payload, plannedId } : payload);
    if (plannedId && data) plan.markPlannedDone(plannedId);
    return data;
  };

  const logRoutineRun = async (payload) => {
    await plan.logRoutine(payload);
    refreshSessions();
  };

  const startScheduled = (session) => {
    if (session.kind === "routine") {
      const routine = plan.routines.find((r) => r.id === session.routineId);
      if (routine) setPlayer({ routine, plannedId: session.id });
      return;
    }
    openDetail(session.exerciseRef, null, {
      plannedId: session.id,
      targetSets: session.targetSets,
      targetReps: session.targetReps,
    });
  };

  // Also after saving preferences, so "Picked for you" follows them (and
  // reshuffles, like any other change)
  const reloadExercises = useCallback(() => {
    shuffleRef.current = rollShuffle(shuffleRef.current);
    setExercises([]);
    return loadExercises(true);
  }, [loadExercises]);

  usePullRefresh(reloadExercises);

  // Throws with the server's message, for the dialog to show inline. The grid
  // reloads so the new workout is in it. The photo goes up after the workout
  // exists: if it fails the workout stays, and the dialog is told
  const addWorkout = useCallback(async (body, photo) => {
    if (!requireOnline()) throw new Error("You're offline. Connect to add a workout.");
    const created = await createWorkout(body);
    let photoFailed = false;
    if (photo) {
      try {
        await uploadWorkoutPhoto(created.id, photo);
      } catch {
        photoFailed = true;
      }
    }
    reloadExercises();
    return { photoFailed };
  }, [reloadExercises]);

  // Deletes one of the user's own workouts. The server removes every trace, so
  // what showed it is reloaded: the grid, favorites/routines/schedule, history.
  // Throws with the server's message, for the confirmation dialog
  const removeWorkout = useCallback(async (id) => {
    if (!requireOnline()) throw new Error("You're offline. Connect to delete a workout.");
    await deleteWorkout(id);
    closeDetail();
    reloadExercises();
    plan.refresh();
    refreshSessions();
  }, [closeDetail, reloadExercises, plan.refresh, refreshSessions]);

  return {
    activeCategory,
    addOpen,
    addWorkout,
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
    muscleList,
    muscles,
    musclesSecondary,
    hasMoreRef,
    logFromDetail,
    logRoutineRun,
    openDetail,
    plan,
    player,
    prefsOpen,
    recent,
    reloadExercises,
    removeWorkout,
    refreshSessions,
    scheduleTarget,
    searchQuery,
    selectedExercise,
    sessionsLoading,
    setActiveCategory,
    setAddOpen,
    setDetailLoading,
    setDetailPlan,
    setEditor,
    setEquipment,
    setMuscles,
    setMusclesSecondary,
    setPlayer,
    setPrefsOpen,
    setScheduleTarget,
    setSearchQuery,
    setSelectedExercise,
    setTab,
    setWorkoutSource,
    startScheduled,
    suggested,
    summary,
    tab,
    workoutSource,
  };
}