import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { toLocalISODate } from "@/shared/utils/dates";
import { pickImageSafe, validateImageFile } from "@/shared/utils/imageValidators";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

// Inference plus upload can outlast the default 20s on a cold model server
const SCAN_TIMEOUT_MS = 45000;
// The scanner page's "Recent Scans" and "Recent Meals" cards
const RECENT_LIMIT = 3;
// Enough days to usually find RECENT_MEALS meals; only that many are shown
const RECENT_MEAL_DAYS = 4;
export const RECENT_MEALS = 4;
const HISTORY_PAGE = 15;

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

// Photos wider than this are scaled down before upload
const MAX_PHOTO_WIDTH = 1280;

// Camera shots get a dated name; picked photos keep theirs. The extension
// only changes when the format does (HEIC and the like become JPEG)
export function photoName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `IMG_${toLocalISODate(date).replace(/-/g, "")}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.jpg`;
}
const withExt = (name, ext) => `${(name || photoName()).replace(/\.[^./]+$/, "")}.${ext}`;

// Formats the server accepts without conversion
const KEEP_FORMATS = {
  "image/jpeg": { ext: "jpg", format: ImageManipulator.SaveFormat.JPEG },
  "image/png": { ext: "png", format: ImageManipulator.SaveFormat.PNG },
  "image/webp": { ext: "webp", format: ImageManipulator.SaveFormat.WEBP },
};

/**
 * Normalizes a taken or picked photo before preview or upload:
 * - Prefixes bare Android paths ("/data/...") with file:// so previews and uploads succeed.
 * - Scales down images wider than MAX_PHOTO_WIDTH and converts unsupported formats (e.g. HEIC) to JPEG.
 */
async function preparePhoto(asset) {
  const uri = asset.uri?.startsWith("/") ? `file://${asset.uri}` : asset.uri;
  try {
    const shrink = asset.width > MAX_PHOTO_WIDTH;
    // Unknown or unsupported types (HEIC...) fall back to JPEG
    const keep = KEEP_FORMATS[(asset.type || "").toLowerCase()];
    // Already fine and small enough: send it untouched
    if (keep && !shrink) return { ...asset, uri };

    const target = keep || KEEP_FORMATS["image/jpeg"];
    const save = { compress: 0.8, format: target.format };
    let out;
    // Newer SDKs: the context API. Older ones only have manipulateAsync
    if (ImageManipulator.ImageManipulator?.manipulate) {
      const context = ImageManipulator.ImageManipulator.manipulate(uri);
      if (shrink) context.resize({ width: MAX_PHOTO_WIDTH });
      const image = await context.renderAsync();
      out = await image.saveAsync(save);
    } else {
      out = await ImageManipulator.manipulateAsync(uri, shrink ? [{ resize: { width: MAX_PHOTO_WIDTH } }] : [], save);
    }
    const type = keep ? asset.type.toLowerCase() : "image/jpeg";
    return { uri: out.uri, name: withExt(asset.name, target.ext), type };
  } catch {
    // Not re-encoded: keep the original name and type
    return { ...asset, uri };
  }
}

// Pre-selected from the time of day, the user can still change it
function mealTypeForNow(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

function messageOf(err, fallback) {
  return err instanceof ApiClientError ? err.message : fallback;
}

// The same food detected more than once (two fish in one photo) becomes one
// row: the most confident detection, starting at that many typical portions
// in grams. Identical means same name, serving and nutrition, so different
// foods never merge. Logging sends that one item with its grams, so totals
// and the logged meal don't change
function mergeDuplicates(scan) {
  if (!scan?.items?.length) return scan;
  const groups = new Map();
  for (const item of scan.items) {
    const key = [item.foodName, item.serving, item.caloriesKcal, item.proteinG, item.carbsG, item.fatG].join("|");
    const group = groups.get(key);
    if (!group) groups.set(key, { ...item, count: 1 });
    else {
      group.count += 1;
      if ((item.confidence ?? 0) > (group.confidence ?? 0)) Object.assign(group, item, { count: group.count });
    }
  }
  return { ...scan, items: [...groups.values()] };
}

// Every detected food starts selected, at one typical portion (in grams) per
// time it was seen. Foods without nutrition data start at 100 g, with empty
// fields the user fills in (per 100 g)
function initialSelection(scan) {
  const next = {};
  for (const item of scan?.items || []) {
    next[item.itemId] = {
      selected: true,
      grams: Math.round((item.defaultGrams || 100) * (item.count || 1)),
      manual: item.hasNutrition ? null : { caloriesKcal: "", proteinG: "", carbsG: "", fatG: "" },
    };
  }
  return next;
}

// Per-100 g value for an item: the scan's own, else what the user typed
function per100(item, pick, key) {
  if (item.hasNutrition) return item.per100g?.[key] ?? 0;
  const typed = parseFloat(pick?.manual?.[key]);
  return Number.isFinite(typed) ? typed : 0;
}

/**
 * Backs both scanner screens. A photo is STAGED first (taken or picked, shown
 * locally, nothing sent) so it can be retaken or swapped, the same way
 * Profile stages an avatar. Only analyze() uploads it, which is also what
 * saves the scan. Then: review, adjust grams, log as a meal.
 * The server re-reads the scan when logging, so totals here are a preview
 */
function useScanner({ onMealLogged } = {}) {
  const [staged, setStaged] = useState(null); // { uri, name, type }
  const [scan, setScan] = useState(null);
  const [selection, setSelection] = useState({});
  const [mealType, setMealType] = useState(mealTypeForNow);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [busy, setBusy] = useState(null); // "scanning" | "logging" | null
  const [loggedMeal, setLoggedMeal] = useState(null);
  const [error, setError] = useState("");

  const refreshRecent = useCallback(async () => {
    try {
      const data = await apiClient.get(`/food/scans?limit=${RECENT_LIMIT}`, { auth: true });
      setRecent(data.scans);
    } catch {
      // The list is secondary, the scanner still works without it
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const showScan = useCallback((raw) => {
    const next = mergeDuplicates(raw);
    setScan(next);
    setSelection(initialSelection(next));
    setMealType(mealTypeForNow());
    setLoggedMeal(null);
  }, []);

  // A new photo replaces any staged one and any result on screen. `asset`
  // is { uri, name, type, width? } from the camera or the picker
  const stage = useCallback(async (asset) => {
    const errorMsg = validateImageFile(asset);
    if (errorMsg) {
      setError(errorMsg);
      return false;
    }
    try {
      const prepared = await preparePhoto(asset);
      const postError = validateImageFile(prepared);
      if (postError) {
        setError(postError);
        return false;
      }
      setStaged(prepared);
      setScan(null);
      setSelection({});
      setLoggedMeal(null);
      setError("");
      return true;
    } catch {
      setError("Unsupported file format. Please upload a JPEG, PNG, or WebP image.");
      return false;
    }
  }, []);

  /**
   * Uploads the staged photo. apiClient.uploadFile handles both platforms:
   * native uses expo-file-system's uploader (Android's FormData upload bug),
   * web turns its blob:/data: URL back into bytes
   */
  const analyze = useCallback(async () => {
    // Also the double-tap guard: the button itself stays enabled while it runs
    if (!staged || busy) return false;
    setBusy("scanning");
    setError("");
    try {
      const result = await apiClient.uploadFile("/food/scans", staged, { field: "image", auth: true, timeoutMs: SCAN_TIMEOUT_MS });
      // Saved: from here on the stored image is shown, not the local one
      setStaged(null);
      showScan(result);
      refreshRecent();
      return true;
    } catch (err) {
      // Keep the staged photo so the user can retry or swap it
      setError(err instanceof ApiClientError && err.code === "NETWORK_ERROR"
        ? `The photo couldn't be uploaded. Check your connection, or try another photo.${__DEV__ ? `\n${err.message}` : ""}`
        : messageOf(err, "Couldn't analyze that photo."));
      return false;
    } finally {
      setBusy(null);
    }
  }, [busy, refreshRecent, showScan, staged]);

  // Reopens a saved scan (recent list or history)
  const openScan = useCallback(async (id) => {
    setError("");
    setStaged(null);
    try {
      showScan(await apiClient.get(`/food/scans/${id}`, { auth: true }));
    } catch (err) {
      setError(messageOf(err, "Couldn't open that scan."));
    }
  }, [showScan]);

  // Throws with the server's message, for the confirm dialog. Deleting the
  // scan that's open clears the scanner too
  const removeScan = useCallback(async (id) => {
    await apiClient.delete(`/food/scans/${id}`, { auth: true });
    if (scan?.id === id) {
      setScan(null);
      setSelection({});
      setLoggedMeal(null);
    }
    await refreshRecent();
  }, [refreshRecent, scan]);

  const reset = useCallback(() => {
    setStaged(null);
    setScan(null);
    setSelection({});
    setLoggedMeal(null);
    setError("");
  }, []);

  const toggleItem = useCallback((itemId) => {
    setSelection((cur) => ({ ...cur, [itemId]: { ...cur[itemId], selected: !cur[itemId]?.selected } }));
  }, []);

  const setGrams = useCallback((itemId, grams) => {
    setSelection((cur) => ({ ...cur, [itemId]: { ...cur[itemId], grams } }));
  }, []);

  // Only for foods the nutrition table lacks. Kept as typed text, stopping at the server's 5,000 limit
  const setManual = useCallback((itemId, key, value) => {
    setSelection((cur) => ({
      ...cur,
      [itemId]: { ...cur[itemId], manual: { ...cur[itemId]?.manual, [key]: Number(value.replace(/[^0-9.]/g, "")) > 5000 ? "5000" : value.replace(/[^0-9.]/g, "") } },
    }));
  }, []);

  const chosen = useMemo(
    () => (scan?.items || []).filter((item) => selection[item.itemId]?.selected),
    [scan, selection],
  );

  // Preview of what the meal adds up to
  const totals = useMemo(() => {
    const sum = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const item of chosen) {
      const pick = selection[item.itemId];
      for (const key of Object.keys(sum)) sum[key] += (per100(item, pick, key) * pick.grams) / 100;
    }
    for (const key of Object.keys(sum)) sum[key] = Math.round(sum[key] * 10) / 10;
    return sum;
  }, [chosen, selection]);

  // A food without nutrition can't be logged until its calories are typed
  const needsCalories = chosen.filter(
    (item) => !item.hasNutrition && !(parseFloat(selection[item.itemId]?.manual?.caloriesKcal) >= 0),
  );

  const logMeal = useCallback(async () => {
    if (!scan || !chosen.length) return false;
    setBusy("logging");
    setError("");
    try {
      const items = chosen.map((item) => {
        const pick = selection[item.itemId];
        const typed = {};
        if (!item.hasNutrition) {
          for (const key of ["caloriesKcal", "proteinG", "carbsG", "fatG"]) {
            const v = parseFloat(pick.manual?.[key]);
            if (Number.isFinite(v)) typed[key] = v;
          }
        }
        return { scanItemId: item.itemId, grams: pick.grams, ...typed };
      });

      const meal = await apiClient.post("/food/meals", { scanId: scan.id, mealType, items }, { auth: true });
      setLoggedMeal(meal);
      onMealLogged?.(meal);
      return true;
    } catch (err) {
      setError(messageOf(err, "Couldn't log that meal."));
      return false;
    } finally {
      setBusy(null);
    }
  }, [chosen, mealType, onMealLogged, scan, selection]);

  usePullRefresh(() => {
    setRecent([]);
    setRecentLoading(true);
    return refreshRecent();
  });

  return {
    staged,
    stage,
    scan,
    recent,
    recentLoading,
    busy,
    error,
    setError,
    clearError: () => setError(""),
    selection,
    chosen,
    totals,
    needsCalories,
    mealType,
    setMealType,
    loggedMeal,
    analyze,
    openScan,
    removeScan,
    reset,
    toggleItem,
    setGrams,
    setManual,
    logMeal,
  };
}

/**
 * Cursor-paged list shared by both history screens. `load(cursor)` returns
 * { rows, next }; next is null once there's nothing older
 */
function usePaged(load, fallback) {
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (cursor, replace) => {
    setLoading(true);
    try {
      const page = await load(cursor);
      setRows((cur) => (replace ? page.rows : [...cur, ...page.rows]));
      setNext(page.next);
      setExtra(page.extra ?? null);
      setError("");
    } catch (err) {
      setError(messageOf(err, fallback));
    } finally {
      setLoading(false);
    }
  }, [fallback, load]);

  const refresh = useCallback(() => fetchPage(null, true), [fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  usePullRefresh(() => {
    setRows([]);
    return refresh();
  });

  return {
    rows,
    extra,
    loading,
    error,
    hasMore: Boolean(next),
    loadMore: () => next && !loading && fetchPage(next, false),
    refresh,
  };
}

// Every saved scan, newest first
export function useScanHistory() {
  const load = useCallback(async (before) => {
    const query = `limit=${HISTORY_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
    const data = await apiClient.get(`/food/scans?${query}`, { auth: true });
    return { rows: data.scans, next: data.nextBefore };
  }, []);
  const paged = usePaged(load, "Couldn't load your scans.");

  const remove = useCallback(async (id) => {
    await apiClient.delete(`/food/scans/${id}`, { auth: true });
    await paged.refresh();
  }, [paged]);

  return { ...paged, remove };
}

// Every day with logged meals, newest first. `extra` is the daily targets
// ({ dailyCaloriesKcal, dailyProteinG, dailyCarbsG, dailyFatG }, each null when unset).
// `days` per page: the full history uses the server's default, the scanner's
// "Recent Meals" card asks for RECENT_MEAL_DAYS and never loads more
export function useMealHistory({ days = null } = {}) {
  const load = useCallback(async (before) => {
    const query = [days && `days=${days}`, before && `before=${before}`].filter(Boolean).join("&");
    const data = await apiClient.get(`/food/meals/history${query ? `?${query}` : ""}`, { auth: true });
    return { rows: data.days, next: data.nextBefore, extra: data.goals };
  }, [days]);
  const paged = usePaged(load, "Couldn't load your meal history.");

  const remove = useCallback(async (id) => {
    await apiClient.delete(`/food/meals/${id}`, { auth: true });
    await paged.refresh();
  }, [paged]);

  return { ...paged, goals: paged.extra || NO_GOALS, goalKcal: paged.extra?.dailyCaloriesKcal ?? null, remove };
}

const NO_GOALS = { dailyCaloriesKcal: null, dailyProteinG: null, dailyCarbsG: null, dailyFatG: null };

// Saves the daily targets. `changes` holds any of the four; null clears one
export async function saveNutritionGoals(changes) {
  return apiClient.patch("/food/goals", changes, { auth: true });
}

// The Food Scanner, shared by web and phone: the scanner,
// recent meals, the camera, and staging a taken or picked photo
export function useFoodScanner() {
  const meals = useMealHistory({ days: RECENT_MEAL_DAYS });
  // Logging a meal refreshes Recent Meals
  const scanner = useScanner({ onMealLogged: meals.refresh });
  const [cameraOpen, setCameraOpen] = useState(false);

  // Opened from the scan history: /food-scanner?scan=<id>
  const { scan: scanParam } = useLocalSearchParams();
  const { openScan } = scanner;
  useEffect(() => {
    if (scanParam) openScan(String(scanParam));
  }, [scanParam, openScan]);

  // Taken or picked photos are only staged here. Nothing is sent until "Analyze"
  const takePhoto = (asset) => {
    setCameraOpen(false);
    scanner.stage(asset);
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
    } catch {
      // Permission request not supported on this platform
    }

    setCameraOpen(false);
    const { asset, error } = await pickImageSafe(ImagePicker, { mediaTypes: ["images"], quality: 0.8 });
    if (error) {
      scanner.setError(error);
      return;
    }
    if (!asset) return;

    scanner.stage({
      uri: asset.uri,
      name: asset.fileName || asset.uri.split("/").pop() || photoName(),
      type: asset.mimeType || "image/jpeg",
      width: asset.width,
    });
  };

  // Clears the photo and any result
  const newScan = () => {
    setCameraOpen(false);
    scanner.reset();
  };

  const openRecent = (id) => {
    setCameraOpen(false);
    scanner.openScan(id);
  };

  // First load: every card on the page shows its placeholder until both
  // recent lists are in, then they all fill in together
  const first = scanner.recentLoading || (meals.loading && !meals.rows.length);
  const scanning = scanner.busy === "scanning";
  // Staged photo (local) first, else the saved scan's stored photo
  const imageUri = scanner.staged?.uri || scanner.scan?.imageUrl || null;

  return { meals, scanner, cameraOpen, setCameraOpen, takePhoto, pickImage, newScan, openRecent, first, scanning, imageUri };
}
