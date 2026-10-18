import { MEAL_TYPES, photoName, RECENT_MEALS, saveNutritionGoals } from "@/features/food/hooks/useFoodScanner";
import { ApiClientError } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ActionButton from "@/shared/components/ui/ActionButton";
import { RingField, RingInput } from "@/shared/components/ui/FormInput";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import Stepper from "@/shared/components/ui/Stepper";
import { NUTRITION_GOAL_FIELDS as GOAL_FIELDS, nutritionGoalProblem as goalProblem, MAX_SERVINGS, MIN_SERVINGS } from "@/shared/constants/goalOptions";
import { chipTints, colors, getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { toLocalISODate } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AskCoachButton, CardHeader, DayTotals, DayTotalsSkeleton, describeMeal, describeScan, MealRow, MealRowSkeleton, ScanHistoryRow, ScanRowSkeleton, styles, useConfirmDelete } from "./FoodScanParts";

// The food scanner page: live camera, result card, recent cards and goals

// ---- Camera ----------------------------------------------------------------------

/**
 * Live camera for phones and desktop webcams alike. On web expo-camera uses
 * the browser camera, which needs HTTPS (or localhost) and a granted
 * permission. Anything that stops it shows a message, the screen keeps
 * "Upload Image" as the fallback
 */
export function FoodCamera({ onCapture, onCancel, darkMode, height = 320 }) {
  const tone = getScreenTones(darkMode);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [failure, setFailure] = useState("");
  // Guards a double tap without disabling the shutter: a button that disables
  // or unmounts in the middle of its own press strands its touch record, and
  // react-native-web then logs "Cannot find single active touch"
  const capturingRef = useRef(false);
  // Runs after the current press has fully ended
  const afterPress = (fn) => setTimeout(fn, 0);

  const capture = async () => {
    if (!ready || capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      // jpg explicitly, web would otherwise hand back a much larger png
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, imageType: "jpg" });
      // Handing over closes the camera, so no state is reset on success
      afterPress(() => onCapture({ uri: photo.uri, name: photoName(), type: "image/jpeg", width: photo.width }));
    } catch {
      capturingRef.current = false;
      setCapturing(false);
      setFailure("Couldn't take the photo. Try again or upload one instead.");
    }
  };

  // Still asking the OS or browser
  if (!permission) {
    return <Skeleton width="100%" height={height} />;
  }

  if (!permission.granted || failure) {
    const blocked = !permission.granted && !permission.canAskAgain;
    const message = failure
      || (blocked
        ? Platform.OS === "web"
          ? "Camera access is blocked. Allow it from the address bar, or upload a photo instead."
          : "Camera access is off. Turn it on in Settings, or upload a photo instead."
        : "NutriFitAI needs your camera to scan food.");

    return (
      <View style={[styles.cameraBox, styles.center, { height, borderColor: tone.border, backgroundColor: tone.card }]}>
        <Ionicons name="videocam-off-outline" size={28} color={tone.muted} />
        <Text style={[styles.cameraMessage, { color: tone.text }]}>{message}</Text>
        <View style={styles.cameraActions}>
          {!permission.granted && !blocked && !failure && (
            <Pressable onPress={requestPermission} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </Pressable>
          )}
          <Pressable onPress={onCancel} style={[styles.ghostBtn, { borderColor: tone.border }]}>
            <Text style={[styles.ghostBtnText, { color: tone.text }]}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.cameraBox, { height, borderColor: tone.border }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setReady(true)}
        // No webcam, or it's in use by another app/tab
        onMountError={() => setFailure("No camera could be started on this device. Upload a photo instead.")}
      />

      <View style={styles.cameraBar}>
        <Pressable onPress={() => afterPress(onCancel)} hitSlop={8} style={styles.roundBtn} accessibilityLabel="Close camera">
          <Ionicons name="close" size={20} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={capture}
          style={[styles.shutter, (!ready || capturing) && styles.disabled]}
          accessibilityLabel="Take photo"
        >
          {capturing ? <ActivityIndicator color={shellColors.primary} /> : <View style={styles.shutterInner} />}
        </Pressable>

        {/* Laptops usually have one camera, so flipping is phone-only */}
        {Platform.OS !== "web" ? (
          <Pressable
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
            hitSlop={8}
            style={styles.roundBtn}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={20} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.roundBtnSpacer} />
        )}
      </View>
    </View>
  );
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---- Result ----------------------------------------------------------------------

const MANUAL_FIELDS = [
  { key: "caloriesKcal", label: "kcal" },
  { key: "proteinG", label: "Protein g" },
  { key: "carbsG", label: "Carbs g" },
  { key: "fatG", label: "Fat g" },
];

/**
 * What the model found, with a checkbox and servings per food, the meal
 * type, a running total, and "Log meal". `onScanAnother` clears the screen
 */
export function ScanResultCard({ scanner, darkMode, onScanAnother, style, loading = false }) {
  const tone = getScreenTones(darkMode);
  // Every state of the card keeps the same footprint
  const shell = [styles.card, styles.resultShell, { backgroundColor: tone.card, borderColor: tone.border }, style];
  const { scan, staged, selection, chosen, totals, needsCalories, mealType, loggedMeal, busy, error } = scanner;

  // Page still loading: same footprint, placeholder body, so every card on
  // the scanner page fills in together
  if (loading) {
    return (
      <View style={shell}>
        <Text style={[styles.cardTitle, { color: tone.text }]}>Detected Food</Text>
        <Skeleton width="70%" height={15} style={styles.skeletonGap} />
        <Skeleton width="100%" height={260} style={styles.skeletonGap} />
        <Skeleton width="100%" height={44} style={styles.skeletonGap} />
      </View>
    );
  }

  // Always rendered, so the page layout doesn't jump when a result arrives
  if (!scan) {
    return (
      <View style={shell}>
        <Text style={[styles.cardTitle, { color: tone.text }]}>Detected Food</Text>
        <View style={[styles.placeholder, styles.flexFill]}>
          {busy === "scanning" ? (
            <ActivityIndicator color={shellColors.primary} />
          ) : (
            <Ionicons name="restaurant-outline" size={26} color={tone.muted} />
          )}
          <Text style={[styles.muted, styles.centerText, { color: tone.muted }]}>
            {busy === "scanning"
              ? "Analyzing your food..."
              : staged
                ? "Analyze the photo to see what's in it."
                : "Take or upload a photo of your meal. The foods found and their nutrition show up here."}
          </Text>
        </View>
      </View>
    );
  }

  if (!scan.items.length) {
    return (
      <View style={shell}>
        <Ionicons name="help-circle-outline" size={26} color={tone.muted} />
        <Text style={[styles.cardTitle, { color: tone.text }]}>No food recognised</Text>
        <Text style={[styles.muted, { color: tone.muted }]}>
          Try again with the food centred, well lit and filling most of the photo.
        </Text>
        <Pressable onPress={onScanAnother} style={[styles.primaryBtn, styles.fullBtn]}>
          <Text style={styles.primaryBtnText}>Scan again</Text>
        </Pressable>
      </View>
    );
  }

  // Logged: the meal is saved, nothing left to edit
  if (loggedMeal) {
    return (
      <View style={shell}>
        <View style={styles.doneIcon}><Ionicons name="checkmark" size={20} color={colors.white} /></View>
        <Text style={[styles.cardTitle, { color: tone.text }]}>Logged as {loggedMeal.mealType}</Text>
        <Text style={[styles.muted, { color: tone.muted }]}>
          {loggedMeal.items.length} food{loggedMeal.items.length === 1 ? "" : "s"} · {loggedMeal.totals.caloriesKcal} kcal
        </Text>
        <Pressable onPress={onScanAnother} style={[styles.primaryBtn, styles.fullBtn]}>
          <Text style={styles.primaryBtnText}>Scan another</Text>
        </Pressable>
        <AskCoachButton mealId={loggedMeal.id} tone={tone} />
      </View>
    );
  }

  const blocked = !chosen.length || needsCalories.length > 0 || busy === "logging";

  return (
    <View style={shell}>
      <Text style={[styles.cardTitle, { color: tone.text }]}>Detected Food</Text>
      <Text style={[styles.muted, { color: tone.muted }]}>Untick anything that's wrong and set how much you had.</Text>

      {/* Many foods scroll here instead of stretching the card */}
      <ScrollView style={styles.itemScroll} contentContainerStyle={styles.itemList} nestedScrollEnabled>
        {scan.items.map((item) => {
          const pick = selection[item.itemId] || {};
          return (
            <View key={item.itemId} style={[styles.itemRow, { borderColor: tone.border }, !pick.selected && styles.unselected]}>
              <View style={styles.itemHead}>
                <Pressable onPress={() => scanner.toggleItem(item.itemId)} hitSlop={8} style={styles.itemCheck}>
                  <Ionicons
                    name={pick.selected ? "checkbox" : "square-outline"}
                    size={20}
                    color={pick.selected ? shellColors.primary : tone.muted}
                  />
                  <View style={styles.flex1}>
                    <Text style={[styles.itemName, { color: tone.text }]}>{capitalize(item.foodName)}</Text>
                    <Text style={[styles.itemMeta, { color: tone.muted }]}>
                      {[item.serving && `per ${item.serving}`, item.confidence !== null && `${Math.round(item.confidence * 100)}% match`]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </Pressable>
                {/* Tap − / + in halves, or type any amount from a quarter up */}
                {pick.selected && (
                  <Stepper
                    label="Servings"
                    value={pick.servings}
                    onChange={(v) => scanner.setServings(item.itemId, v)}
                    min={MIN_SERVINGS}
                    max={MAX_SERVINGS}
                    step={0.5}
                    editable
                    darkMode={darkMode}
                  />
                )}
              </View>

              {/* Model knows the food, the nutrition table doesn't */}
              {pick.selected && !item.hasNutrition && (
                <View style={styles.manualWrap}>
                  <Text style={[styles.itemMeta, { color: colors.orange400 }]}>
                    No nutrition data for this food yet. Enter it per serving:
                  </Text>
                  <View style={styles.manualRow}>
                    {MANUAL_FIELDS.map((f) => (
                      <RingInput
                        key={f.key}
                        value={pick.manual?.[f.key] ?? ""}
                        onChangeText={(v) => scanner.setManual(item.itemId, f.key, v)}
                        placeholder={f.label}
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        style={[styles.manualInput, { color: tone.text, borderColor: tone.border }]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: tone.muted }]}>MEAL</Text>
      <View style={styles.chips}>
        {MEAL_TYPES.map((type) => {
          const active = type === mealType;
          return (
            <Pressable
              key={type}
              onPress={() => scanner.setMealType(type)}
              style={[styles.chip, { borderColor: active ? shellColors.primary : tone.border }, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, { color: active ? colors.white : tone.text }]}>{capitalize(type)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.totals}>
        <Total label="Calories" value={totals.caloriesKcal} suffix="kcal" color={colors.orange400} tone={tone} />
        <Total label="Protein" value={totals.proteinG} suffix="g" color={shellColors.primary} tone={tone} />
        <Total label="Carbs" value={totals.carbsG} suffix="g" color={chipTints.blue.icon} tone={tone} />
        <Total label="Fat" value={totals.fatG} suffix="g" color={chipTints.orange.icon} tone={tone} />
      </View>
      <Text style={[styles.disclaimer, { color: tone.muted }]}>Estimates from a photo. Adjust servings for accuracy.</Text>

      <ScreenError message={error} onDismiss={scanner.clearError} />

      <Pressable onPress={scanner.logMeal} disabled={blocked} style={[styles.primaryBtn, styles.fullBtn, blocked && styles.disabled]}>
        {busy === "logging"
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.primaryBtnText}>Log {mealType}</Text>}
      </Pressable>
      {/* Not logged yet, so the coach sees the foods at one serving each */}
      <AskCoachButton scanId={scan.id} tone={tone} />
    </View>
  );
}

function Total({ label, value, suffix, color, tone }) {
  return (
    <View style={styles.total}>
      <View style={[styles.totalLine, { backgroundColor: color }]} />
      <Text style={[styles.totalLabel, { color: tone.muted }]}>{label}</Text>
      <Text style={[styles.totalValue, { color: tone.text }]}>
        {value}<Text style={[styles.totalSuffix, { color: tone.muted }]}> {suffix}</Text>
      </Text>
    </View>
  );
}

/**
 * Today's totals, then the latest RECENT_MEALS meals across the last few days,
 * newest first. Everything older is on "Full history". `meals` is
 * useMealHistory({ days: RECENT_MEAL_DAYS }), owned by the screen so logging
 * a meal can refresh it
 */
export function RecentMealsCard({ meals, darkMode, onViewAll, style, loading = false }) {
  const tone = getScreenTones(darkMode);
  const del = useConfirmDelete(meals.remove, describeMeal);

  const todays = meals.rows[0]?.date === toLocalISODate() ? meals.rows[0] : null;
  // Days come newest first, a day's meals oldest first, so each day is reversed
  const latest = meals.rows.flatMap((d) => [...d.meals].reverse()).slice(0, RECENT_MEALS);

  return (
    <View style={[styles.card, styles.cardStretch, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <CardHeader title="Recent Meals" tone={tone} darkMode={darkMode} onViewAll={onViewAll} />

      {loading ? (
        // The loaded card's own parts: Today, its totals, then the meal rows
        <>
          <Text style={[styles.recentDayTitle, { color: tone.text }]}>Today</Text>
          <DayTotalsSkeleton tone={tone} />
          {Array.from({ length: RECENT_MEALS }, (_, i) => <MealRowSkeleton key={i} tone={tone} first={i === 0} />)}
        </>
      ) : (
        <>
          <Text style={[styles.recentDayTitle, { color: tone.text }]}>Today</Text>
          <DayTotals totals={todays?.totals || { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }} goals={meals.goals} tone={tone} />
          {latest.length ? (
            latest.map((meal, i) => <MealRow key={meal.id} meal={meal} tone={tone} first={i === 0} showDay onDelete={del.ask} />)
          ) : (
            <Text style={[styles.muted, { color: tone.muted }]}>No meals logged yet. Scan a meal and log it.</Text>
          )}
        </>
      )}

      <ScreenError message={del.error || meals.error} onDismiss={del.clearError} />
      {del.modal}
    </View>
  );
}

/**
 * The latest few scans, each reopening on the scanner. Full list on "Full
 * history". `onDelete(id)` is useFoodScanner's removeScan, which also clears the
 * scanner when the open scan is the one deleted
 */
export function RecentScansCard({ scans, loading = false, darkMode, onOpen, onViewAll, onDelete, style }) {
  const tone = getScreenTones(darkMode);
  const del = useConfirmDelete(onDelete, describeScan);
  return (
    <View style={[styles.card, styles.cardStretch, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <CardHeader title="Recent Scans" tone={tone} darkMode={darkMode} onViewAll={onViewAll} />
      <View style={styles.recentScans}>
        {loading && [0, 1, 2].map((i) => <ScanRowSkeleton key={i} tone={tone} />)}
        {!loading && scans.length === 0 && <Text style={[styles.muted, { color: tone.muted }]}>Your scans will show up here.</Text>}
        {scans.map((scan) => (
          <ScanHistoryRow key={scan.id} scan={scan} tone={tone} showDay onPress={() => onOpen(scan.id)} onDelete={del.ask} />
        ))}
      </View>
      <ScreenError message={del.error} onDismiss={del.clearError} />
      {del.modal}
    </View>
  );
}

// ---- Daily goals -------------------------------------------------------------

const asText = (goals) => Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, goals?.[f.key] ? String(goals[f.key]) : ""]));

/**
 * The daily calorie and macro targets, set right where meals are logged.
 * `meals` is the scanner's useMealHistory: its goals fill the fields, and it
 * reloads after a save so Today's totals show the new targets. An empty field
 * clears that target
 */
export function NutritionGoalsCard({ meals, darkMode, style, loading = false }) {
  const tone = getScreenTones(darkMode);
  const saved = asText(meals.goals);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const values = draft || saved;
  const changed = GOAL_FIELDS.some((f) => values[f.key] !== saved[f.key]);

  const edit = (key, text) => {
    setDone(false);
    setDraft({ ...values, [key]: text.replace(/[^0-9]/g, "") });
  };

  const save = async () => {
    // Checked here first, with the same limits the server uses
    const problem = goalProblem(values);
    if (problem) {
      setError(problem);
      return;
    }
    const changes = {};
    for (const f of GOAL_FIELDS) {
      if (values[f.key] !== saved[f.key]) changes[f.key] = values[f.key] ? Number(values[f.key]) : null;
    }
    setSaving(true);
    setError("");
    try {
      await saveNutritionGoals(changes);
      await meals.refresh();
      setDraft(null);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your goals.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, styles.cardStretch, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <View style={styles.rowBetween}>
        <View style={styles.flex1}>
          <Text style={[styles.cardTitle, { color: tone.text }]}>Daily Goals</Text>
          <Text style={[styles.muted, { color: tone.muted }]}>Targets for each day. Leave one empty for none.</Text>
        </View>
        <ActionButton
          compact
          label={done && !changed ? "Saved" : "Save"}
          onPress={save}
          loading={saving}
          disabled={!changed || loading}
          darkMode={darkMode}
        />
      </View>

      <View style={styles.goalGrid}>
        {GOAL_FIELDS.map((f) => {
          const tint = chipTints[f.tint];
          return (
            <View key={f.key} style={styles.goalField}>
              <View style={styles.goalLabelRow}>
                <Ionicons name={f.icon} size={14} color={tint.icon} />
                <Text style={[styles.goalLabel, { color: tone.text }]}>{f.label}</Text>
              </View>
              {loading ? (
                <Skeleton width="100%" height={40} />
              ) : (
                // One box like the app's other inputs: the focus ring goes
                // around it, with the unit inside on the right
                <RingField style={[styles.goalBox, { borderColor: tone.border, backgroundColor: tone.card }]}>
                  {(ring) => (
                    <>
                      <TextInput
                        {...ring.handlers}
                        value={values[f.key]}
                        onChangeText={(t) => edit(f.key, t)}
                        placeholder="Not set"
                        placeholderTextColor={tone.muted}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={[styles.goalInput, ring.input, { color: tone.text }]}
                        accessibilityLabel={`Daily ${f.label.toLowerCase()} goal`}
                      />
                      <Text style={[styles.goalUnit, { color: tone.muted }]}>{f.unit}</Text>
                    </>
                  )}
                </RingField>
              )}
            </View>
          );
        })}
      </View>

      <ScreenError message={error} onDismiss={() => setError("")} />
    </View>
  );
}