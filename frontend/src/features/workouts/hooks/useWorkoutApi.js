import { apiClient } from "@/shared/api/apiClient";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";

/**
 * Workout catalog client.
 */

const LANG = 2; // English

/* ------------------------------------------------------------------ fetching */

/** Categories (Abs, Arms, Back, Chest, Legs, …). */
export async function fetchCategories() {
  return apiClient.get("/workouts/categories", { auth: true });
}

// Every muscle the catalog lists, for the Add workout dialog
export async function fetchMuscles() {
  return apiClient.get("/workouts/muscles", { auth: true });
}

// Every piece of equipment the catalog uses, bodyweight excluded
export async function fetchEquipment() {
  return apiClient.get("/workouts/equipment", { auth: true });
}

/**
 * A page of exercises.
 *
 * Returns envelope ({ count, next, previous, results, suggested }) for pagination.
 */
export async function fetchExerciseInfoPage({
  category,
  limit = 20,
  offset = 0,
  search,
  equipment,
  muscles,
  musclesSecondary,
  source,
  ids,
  shuffle,
  includeImageless = false,
} = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  // With no filter the server shuffles the catalog, preferred exercises first
  // (suggested: true when there are any, for "Picked for you")
  if (shuffle) params.set("shuffle", String(shuffle));
  if (category) params.set("category", String(category));
  if (search) params.set("search", search);
  // "none" | "any" | an equipment id
  if (equipment != null) params.set("equipment", String(equipment));
  // Muscle ids, main and secondary (a workout matching any of them)
  if (muscles?.length) params.set("muscles", muscles.join(","));
  if (musclesSecondary?.length) params.set("musclesSecondary", musclesSecondary.join(","));
  // "wger" | "user": the catalog, or only the user's own workouts
  if (source) params.set("source", source);
  // Only these exercises (the Favorites tab)
  if (ids) params.set("ids", ids.join(","));

  // The server defaults to illustrated exercises only unless opted out explicitly
  if (includeImageless) params.set("hasImage", "false");

  const data = await apiClient.get(`/workouts?${params.toString()}`, { auth: true });

  return {
    count: data.total,
    next: data.hasMore ? offset + limit : null,
    previous: offset > 0 ? Math.max(0, offset - limit) : null,
    results: data.items,
    suggested: Boolean(data.suggested),
  };
}

/**
 * One exercise by id. Non-blocking when offline so dialogs do not delay.
 * `signal` cancels it when the dialog closes.
 */
export async function fetchExerciseInfo(id, { signal } = {}) {
  return apiClient.get(`/workouts/${id}`, { auth: true, wait: false, signal });
}

// Checks for existing workouts with this name (wger or personal)
export async function findWorkoutByName(name, { excludeId, signal } = {}) {
  const params = new URLSearchParams({ name });
  if (excludeId != null) params.set("excludeId", String(excludeId));
  const data = await apiClient.get(`/workouts/match?${params.toString()}`, { auth: true, wait: false, signal });
  return data.match || null;
}

// Adds a personal workout
export function createWorkout(body) {
  return apiClient.post("/workouts", body, { auth: true });
}

// Updates a personal workout
export function updateWorkout(id, body) {
  return apiClient.patch(`/workouts/${id}`, body, { auth: true });
}

// Deletes a personal workout
export function deleteWorkout(id) {
  return apiClient.delete(`/workouts/${id}`, { auth: true });
}

// Uploads a photo for a personal workout
export function uploadWorkoutPhoto(id, file) {
  return apiClient.uploadFile(`/workouts/${id}/photo`, file, { field: "photo", auth: true });
}

/* ------------------------------------------------- routines, favorites, schedule */

// User routines plus built-ins
export async function fetchRoutines() {
  const data = await apiClient.get("/workouts/routines", { auth: true });
  return data.routines || [];
}

export function createRoutine(body) {
  return apiClient.post("/workouts/routines", body, { auth: true });
}

export function updateRoutine(id, body) {
  return apiClient.patch(`/workouts/routines/${id}`, body, { auth: true });
}

export function deleteRoutine(id) {
  return apiClient.delete(`/workouts/routines/${id}`, { auth: true });
}

// One routine run. completedSets/targetSets count exercises, not sets
export function logRoutineSession(body) {
  return apiClient.post("/workouts/routines/sessions", body, { auth: true });
}

export async function fetchFavorites() {
  const data = await apiClient.get("/workouts/favorites", { auth: true });
  return data.favorites || [];
}

export function addFavorite({ kind, refId, name }) {
  return apiClient.put("/workouts/favorites", { kind, refId: String(refId), name }, { auth: true });
}

export function removeFavorite(kind, refId) {
  return apiClient.delete(`/workouts/favorites/${kind}/${encodeURIComponent(String(refId))}`, { auth: true });
}

// Planned sessions for the next 7 days, soonest first
export async function fetchSchedule() {
  const data = await apiClient.get("/workouts/schedule", { auth: true });
  return data.sessions || [];
}

export function scheduleWorkout(body) {
  return apiClient.post("/workouts/schedule", body, { auth: true });
}

// A logged session, or every logged session on one local day ("YYYY-MM-DD")
export function deleteSession(id) {
  return apiClient.delete(`/workouts/sessions/${id}`, { auth: true });
}

export function deleteSessionsOnDay(date) {
  return apiClient.delete(`/workouts/sessions/day/${date}`, { auth: true });
}

// New time for a planned or missed session
export function rescheduleWorkout(id, scheduledFor) {
  return apiClient.patch(`/workouts/schedule/${id}`, { scheduledFor }, { auth: true });
}

export function unscheduleWorkout(id) {
  return apiClient.delete(`/workouts/schedule/${id}`, { auth: true });
}

/* ------------------------------------------------------------------- helpers */

/** Returns the display name and description for an exercise record. */
export function getEnglishTranslation(info) {
  if (info?.name) {
    return { name: info.name, description: info.description || "" };
  }

  // Legacy wger shape fallback
  if (!info?.translations?.length) {
    return {
      name: info?.name || `Exercise #${info?.id}`,
      description: info?.description || "",
    };
  }
  const en = info.translations.find((t) => t.language === LANG);
  return {
    name: en?.name || info.translations[0]?.name || `Exercise #${info.id}`,
    description: en?.description || info.translations[0]?.description || "",
  };
}

/** Checks whether the exercise has a valid English name. */
export function hasEnglishTranslation(info) {
  if (info?.name) return Boolean(info.name.trim());
  return Boolean(info?.translations?.some((t) => t.language === LANG && t.name?.trim()));
}

/** Checks for untranslated localized exercise titles. */
export function isBlockedLocalizedExercise(name = "") {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("puente de gluteos");
}

/** First image, or the category's fallback. */
export function getExerciseImage(info) {
  return getExerciseImages(info)[0] || getWorkoutFallbackImage(info?.category?.name);
}

/** All normalized image URLs for an exercise. */
export function getExerciseImages(info) {
  if (Array.isArray(info?.images) && info.images.every((i) => typeof i === "string")) {
    return info.images.map(resolveMediaUrl);
  }

  return [
    ...(Array.isArray(info?.images) ? info.images : []),
    info?.image,
    info?.image_url,
  ]
    .map(normalizeImageUrl)
    .filter(Boolean);
}

/** Normalizes image URLs to secure absolute paths. */
function normalizeImageUrl(url) {
  if (!url) return null;
  if (typeof url === "object") return normalizeImageUrl(url.image || url.url || url.src);
  if (typeof url !== "string") return null;

  const value = url.trim();
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://wger.de${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

/** Muscle display names, preferring English labels. */
export function getMuscleNames(info) {
  const muscles = [
    ...(info?.muscles || []),
    ...(info?.musclesSecondary || info?.muscles_secondary || []),
  ];

  return muscles
    .map((m) => m?.nameEn || m?.name_en || m?.name)
    .filter(Boolean);
}

/* ---------------------------------------------------------------- fallbacks */

/** Category fallback artwork when an exercise lacks an uploaded photo. */
const WORKOUT_FALLBACK_IMAGES = {
  Abs: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
  Arms: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80",
  Back: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
  Calves: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80",
  Cardio: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=80",
  Chest: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80",
  Legs: "https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=900&q=80",
  Shoulders: "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&w=900&q=80",
};

const DEFAULT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80";

export function getWorkoutFallbackImage(category) {
  return WORKOUT_FALLBACK_IMAGES[category] || DEFAULT_FALLBACK_IMAGE;
}
