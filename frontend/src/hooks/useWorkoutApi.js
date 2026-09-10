// Workout API service using wger.de public REST API (no API key needed)
// Docs: https://wger.de/api/v2/

const BASE = "https://wger.de/api/v2";
const LANG = 2; // English

/**
 * Fetch all exercise categories (Abs, Arms, Back, Chest, Legs, …)
 */
export async function fetchCategories() {
  const res = await fetch(`${BASE}/exercisecategory/?format=json`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = await res.json();
  return data.results; // [{ id, name }]
}

/**
 * Fetch paginated exercises, optionally filtered by category.
 * Returns { results, next, count }.
 */
export async function fetchExercises({
  category,
  limit = 20,
  offset = 0,
} = {}) {
  let url = `${BASE}/exercise/?format=json&language=${LANG}&limit=${limit}&offset=${offset}&ordering=-id`;
  if (category) url += `&category=${category}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch exercises");
  return res.json(); // { count, next, previous, results }
}

/**
 * Fetch full exercise info (name, description, muscles, images, category).
 */
export async function fetchExerciseInfo(id) {
  const res = await fetch(`${BASE}/exerciseinfo/${id}/?format=json`);
  if (!res.ok) throw new Error(`Failed to fetch exercise #${id}`);
  return res.json();
}

/**
 * Fetch a paginated page of full exercise records in one request.
 * Keep the filters/order in sync with fetchExercises so records can be
 * matched by ID without making one detail request per exercise.
 */
export async function fetchExerciseInfoPage({
  category,
  limit = 20,
  offset = 0,
} = {}) {
  let url = `${BASE}/exerciseinfo/?format=json&language=${LANG}&limit=${limit}&offset=${offset}&ordering=-id`;
  if (category) url += `&category=${category}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch exercise info page");
  return res.json();
}

/**
 * Search exercises by term (uses the exercise list filtered client-side
 * since the search endpoint can be unreliable).
 */
export async function searchExercises(term, limit = 30) {
  // wger has a search endpoint but it's inconsistent across versions,
  // so we fetch a large batch and filter on the client instead.
  const res = await fetch(
    `${BASE}/exercise/?format=json&language=${LANG}&limit=200&ordering=-id`,
  );
  if (!res.ok) throw new Error("Failed to search exercises");
  const data = await res.json();

  const lower = term.toLowerCase();
  // The exercise object from /exercise/ does NOT contain the name/description;
  // those are in the translation. So we use exerciseinfo for search.
  // Instead, use the exercise/search endpoint:
  const searchRes = await fetch(
    `${BASE}/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`,
  );
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.suggestions) {
      return searchData.suggestions.slice(0, limit);
    }
  }

  // fallback: return raw exercise IDs (caller can hydrate with exerciseinfo)
  return data.results.slice(0, limit);
}

/**
 * Fetch exercise images for a given exercise base ID.
 */
export async function fetchExerciseImages(exerciseId) {
  const res = await fetch(
    `${BASE}/exerciseimage/?format=json&exercise_base=${exerciseId}&limit=4`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || [])
    .map((item) => normalizeImageUrl(item?.image || item?.url))
    .filter(Boolean);
}

/**
 * Convenience: fetch a batch of exercise info objects for a list of IDs.
 */
export async function fetchExerciseBatch(ids) {
  const results = await Promise.allSettled(ids.map(fetchExerciseInfo));
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

/**
 * Helper: extract English translation from exerciseinfo response.
 */
export function getEnglishTranslation(info) {
  if (!info.translations?.length) {
    return {
      name: info.name || `Exercise #${info.id}`,
      description: info.description || "",
    };
  }
  const en = info.translations.find((t) => t.language === LANG);
  return {
    name: en?.name || info.translations[0]?.name || `Exercise #${info.id}`,
    description: en?.description || info.translations[0]?.description || "",
  };
}

/**
 * Helper: get the first image URL from exerciseinfo response.
 */
export function getExerciseImage(info) {
  return getExerciseImages(info)[0] || getWorkoutFallbackImage(info?.category?.name);
}

/**
 * Extract every image URL from an exercise and normalize it for both web and
 * native clients. The API can return strings, image objects, relative paths,
 * or legacy http URLs depending on the endpoint/version.
 */
export function getExerciseImages(info) {
  const images = [
    ...(Array.isArray(info?.images) ? info.images : []),
    info?.image,
    info?.image_url,
  ];

  return images
    .map((image) => normalizeImageUrl(image))
    .filter(Boolean);
}

/**
 * Keep API image URLs usable when the API returns an old http URL. Browsers
 * block those requests on an https app as mixed content.
 */
export function normalizeImageUrl(url) {
  if (!url) return null;

  // The API has returned strings, image objects, and occasionally nested
  // objects across different versions.
  if (typeof url === "object") {
    return normalizeImageUrl(url.image || url.url || url.src);
  }
  if (typeof url !== "string") return null;

  const value = url.trim();
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://wger.de${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

// Stable, manually assigned artwork keeps cards useful when an exercise has
// no uploaded image (or the API image is temporarily unavailable).
const WORKOUT_FALLBACK_IMAGES = {
  Abs: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
  Arms: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80",
  Back: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
  Calves: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80",
  Cardio: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=80",
  Chest: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80",
  Legs: "https://images.unsplash.com/photo-1434608519344-49d77a699ded?auto=format&fit=crop&w=900&q=80",
  Shoulders: "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&w=900&q=80",
  Other: "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=900&q=80",
};

// A small rotated pool per category so image-less exercises don't all show the
// exact same photo. The first entry in each pool is the reliable default above.
const WORKOUT_IMAGE_POOLS = {
  Abs: [
    WORKOUT_FALLBACK_IMAGES.Abs,
    "https://images.unsplash.com/photo-1571019614241-c0c9b7a6c6e0?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?auto=format&fit=crop&w=900&q=80",
  ],
  Arms: [
    WORKOUT_FALLBACK_IMAGES.Arms,
    "https://images.unsplash.com/photo-1581009137042-c552e485697a?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1521805103424-d8f8430e8933?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=900&q=80",
  ],
  Back: [
    WORKOUT_FALLBACK_IMAGES.Back,
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=80",
  ],
  Calves: [
    WORKOUT_FALLBACK_IMAGES.Calves,
    "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1571019614241-c0c9b7a6c6e0?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=900&q=80",
  ],
  Cardio: [
    WORKOUT_FALLBACK_IMAGES.Cardio,
    "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=80",
  ],
  Chest: [
    WORKOUT_FALLBACK_IMAGES.Chest,
    "https://images.unsplash.com/photo-1571019614241-c0c9b7a6c6e0?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=900&q=80",
  ],
  Legs: [
    WORKOUT_FALLBACK_IMAGES.Legs,
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80",
  ],
  Shoulders: [
    WORKOUT_FALLBACK_IMAGES.Shoulders,
    "https://images.unsplash.com/photo-1581009137042-c552e485697a?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80",
  ],
  Other: [
    WORKOUT_FALLBACK_IMAGES.Other,
    "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80",
  ],
};

function hashString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Return a reliable single fallback image for a category (used as the on-error
 * fallback so a broken image always resolves to something known-good).
 */
export function getWorkoutFallbackImage(category) {
  return WORKOUT_FALLBACK_IMAGES[category] || WORKOUT_FALLBACK_IMAGES.Other;
}

/**
 * Return a category-appropriate image that varies per exercise (keyed by the
 * given seed, usually the exercise id or name) so image-less cards don't all
 * show the exact same stock photo.
 */
export function getWorkoutVariationImage(category, seed = "") {
  const pool =
    WORKOUT_IMAGE_POOLS[category] ||
    WORKOUT_IMAGE_POOLS.Other ||
    WORKOUT_FALLBACK_IMAGES;
  if (!seed) return pool[0];
  return pool[hashString(String(seed)) % pool.length];
}

/**
 * Helper: get muscle names from exerciseinfo response.
 */
export function getMuscleNames(info) {
  if (!info.muscles) return [];
  return info.muscles.map((m) => m.name_en || m.name);
}
