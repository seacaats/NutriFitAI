import { apiClient } from "@/shared/api/apiClient";

/**
 * Workout catalog client.
 *
 * Thin client over the server's synced catalog. Unused legacy wrappers
 * (fetchExercises, searchExercises, fetchExerciseImages, fetchExerciseBatch)
 * were removed; everything left here is imported by the workouts screens
 */

const LANG = 2; // English. Kept for the helpers' legacy shape checks

/* ------------------------------------------------------------------ fetching */

/** Categories (Abs, Arms, Back, Chest, Legs, …). */
export async function fetchCategories() {
  return apiClient.get("/workouts/categories", { auth: true });
}

// Every piece of equipment the catalog uses, bodyweight excluded
export async function fetchEquipment() {
  return apiClient.get("/workouts/equipment", { auth: true });
}

/**
 * A page of exercises.
 *
 * Returns the wger-shaped envelope ({ count, next, results }) the screens were
 * written against, so their paging logic keeps working while it is simplified.
 */
export async function fetchExerciseInfoPage({
  category,
  limit = 20,
  offset = 0,
  search,
  equipment,
  ids,
  shuffle,
  includeImageless = false,
} = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  // With no filter the server shuffles the catalog, preferred exercises first
  // (suggested: true when there are any, for "Picked for you")
  // when no filter is set, and answers with suggested: true
  if (shuffle) params.set("shuffle", String(shuffle));
  if (category) params.set("category", String(category));
  if (search) params.set("search", search);
  // "none" | "any" | an equipment id
  if (equipment != null) params.set("equipment", String(equipment));
  // Only these exercises (the Favorites tab)
  if (ids) params.set("ids", ids.join(","));

  // The server defaults to illustrated exercises only. Opt out explicitly when
  // a screen genuinely wants the full catalog.
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
 * One exercise by wger id. For the details dialogs: while the server can't
 * be reached it gives back the saved copy or fails at once, never waits,
 * so a dialog can't open on its own when the connection comes back.
 * `signal` cancels it outright when the dialog closes
 */
export async function fetchExerciseInfo(id, { signal } = {}) {
  return apiClient.get(`/workouts/${id}`, { auth: true, wait: false, signal });
}

/* ------------------------------------------------- routines, favorites, schedule */

// Your routines plus built-ins
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

/**
 * Name and description for a record.
 *
 * The server stores the English translation directly, so this is now a read
 * rather than a search through a translations array. The legacy branch remains
 * for anything still holding a raw wger object.
 */
export function getEnglishTranslation(info) {
  if (info?.name) {
    return { name: info.name, description: info.description || "" };
  }

  // Legacy wger shape.
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

/**
 * Always true for a synced record: the sync drops anything without a usable
 * English name, so an untranslated entry can no longer reach the client.
 * Retained so the screens' filters keep compiling.
 */
export function hasEnglishTranslation(info) {
  if (info?.name) return Boolean(info.name.trim());
  return Boolean(info?.translations?.some((t) => t.language === LANG && t.name?.trim()));
}

/**
 * Localized titles wger mislabels as English are now dropped at sync time, so
 * this always returns false for synced records. Kept as a safety net for any
 * cached data written before the switch.
 */
export function isBlockedLocalizedExercise(name = "") {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("puente de gluteos");
}

/** First image, or the category's stable fallback. */
export function getExerciseImage(info) {
  return getExerciseImages(info)[0] || getWorkoutFallbackImage(info?.category?.name);
}

/**
 * All image URLs.
 *
 * Normalised and deduplicated at sync time, so this is now a read. The legacy
 * branch handles the several shapes wger returned across versions.
 */
export function getExerciseImages(info) {
  if (Array.isArray(info?.images) && info.images.every((i) => typeof i === "string")) {
    return info.images;
  }

  return [
    ...(Array.isArray(info?.images) ? info.images : []),
    info?.image,
    info?.image_url,
  ]
    .map(normalizeImageUrl)
    .filter(Boolean);
}

/**
 * Kept for legacy/cached data. Synced URLs are already absolute https.
 *
 * The http→https rewrite is the important line: a browser blocks an http image
 * on an https page as mixed content, so an un-normalised legacy URL renders as
 * nothing at all.
 */
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

/** Muscle display names, preferring the English label. */
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

/**
 * Stable, manually chosen artwork so a card stays useful when an exercise has
 * no uploaded image.
 *
 * Stays client-side deliberately: these are a presentation choice, not catalog
 * data, and storing them per exercise would put ~1,300 copies of a dozen URLs
 * into a 512 MB database.
 */
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