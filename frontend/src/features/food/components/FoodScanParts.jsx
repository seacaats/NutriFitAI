import Skeleton from "@/shared/components/Skeleton";
import AvatarImage from "@/shared/components/ui/AvatarImage";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import PlanButton from "@/shared/components/ui/PlanButton";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { colors, radii, shellColors } from "@/shared/theme/nutrifitai";
import { toLocalISODate } from "@/shared/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Food scanner pieces shared by the native and web screens: styles, rows and
// loading placeholders

// Detected Food keeps this height in every state, so the page doesn't
// reshuffle when a result arrives
export const RESULT_CARD_MIN_HEIGHT = 470;

/**
 * Saved scan photos come from our own API host, so they load through
 * AvatarImage for the same ngrok header reason avatars do (see that file).
 * The server sends a root-relative "/uploads/..." path. Only that prefix
 * counts as ours: a bare local Android path also starts with "/"
 *
 * Local previews (file:, content:, ph:, blob:, data:) go straight to
 * expo-image instead: AvatarImage always attaches a request header, and on
 * Android a header on a local file uri makes the load fail, which is why the
 * just-taken photo showed blank on mobile
 */
export function ScanImage({ uri, style, contentFit = "cover", onError }) {
  if (!uri) return null;
  const ours = uri.startsWith("/uploads/");
  if (ours || /^https?:\/\//i.test(uri)) {
    const src = ours ? resolveMediaUrl(uri) : uri;
    return <AvatarImage uri={src} style={style} contentFit={contentFit} onError={onError} />;
  }
  return <Image source={{ uri }} style={style} contentFit={contentFit} onError={onError} />;
}

/**
 * Opens the AI Coach on a new thread about this scan or logged meal. Only the
 * id travels: the server reads the foods and nutrition itself on every turn.
 * A logged meal is preferred, it has the servings the user actually set
 */
export function AskCoachButton({ scanId, mealId, tone, compact = false }) {
  const router = useRouter();
  const go = () => router.push(mealId ? `/ai-coach?meal=${mealId}` : `/ai-coach?scan=${scanId}`);

  if (compact) {
    return (
      <Pressable onPress={go} hitSlop={8} accessibilityLabel="Ask AI Coach about this meal">
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={shellColors.primary} />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={go} style={[styles.ghostBtn, styles.fullBtnTight, styles.askBtn, { borderColor: tone.border }]}>
      <Ionicons name="chatbubble-ellipses-outline" size={16} color={shellColors.primary} />
      <Text style={styles.askBtnText}>Ask AI Coach about this meal</Text>
    </Pressable>
  );
}

// Title plus the same "Full history" button the steps, water and workouts pages use
export function CardHeader({ title, tone, darkMode, onViewAll }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.cardTitle, { color: tone.text }]}>{title}</Text>
      <PlanButton compact variant="secondary" label="Full history" onPress={onViewAll} darkMode={darkMode} />
    </View>
  );
}

export const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  disabled: { opacity: 0.5 },

  // Camera
  // No overflow:hidden. With borderRadius it kept the Android preview from
  // drawing on first open, see imageWrap in the native food-scanner screen
  cameraBox: { width: "100%", borderRadius: radii.sm, borderWidth: 1, backgroundColor: "#000" },
  cameraMessage: { fontSize: 13, textAlign: "center", maxWidth: 300 },
  cameraActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  cameraBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  roundBtnSpacer: { width: 40 },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white },

  // Buttons
  primaryBtn: { borderRadius: radii.sm, backgroundColor: shellColors.primary, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center" },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  fullBtn: { alignSelf: "stretch", marginTop: 16 },
  fullBtnTight: { alignSelf: "stretch", marginTop: 8 },
  askBtn: { flexDirection: "row", justifyContent: "center", gap: 8 },
  askBtnText: { fontSize: 14, fontWeight: "600", color: shellColors.primary },
  ghostBtn: { borderRadius: radii.sm, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center" },
  ghostBtnText: { fontSize: 14, fontWeight: "600" },

  // Result card
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16, alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  muted: { fontSize: 12, marginTop: 4 },
  doneIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: shellColors.primary, alignItems: "center", justifyContent: "center" },

  itemList: { gap: 8 },
  itemRow: { borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  unselected: { opacity: 0.55 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  itemCheck: { flex: 1, minWidth: 160, flexDirection: "row", alignItems: "center", gap: 10 },
  itemName: { fontSize: 14, fontWeight: "700" },
  itemMeta: { fontSize: 11, marginTop: 2 },

  manualWrap: { marginTop: 10, gap: 6 },
  manualRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  manualInput: { flexGrow: 1, flexBasis: 70, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },

  sectionLabel: { marginTop: 16, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: shellColors.primary },
  chipText: { fontSize: 12, fontWeight: "600" },

  totals: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  total: { flexGrow: 1, flexBasis: "22%", minWidth: 70, borderRadius: 8, backgroundColor: "rgba(127,127,127,0.07)", padding: 10 },
  totalLine: { width: 22, height: 3, borderRadius: 2, marginBottom: 6 },
  totalLabel: { fontSize: 10 },
  totalValue: { marginTop: 2, fontSize: 15, fontWeight: "800" },
  totalSuffix: { fontSize: 10, fontWeight: "500" },
  disclaimer: { marginTop: 8, fontSize: 10 },
  alert: { alignSelf: "stretch", marginTop: 12 },

  // Fixed footprint, see RESULT_CARD_MIN_HEIGHT
  resultShell: { minHeight: RESULT_CARD_MIN_HEIGHT },
  itemScroll: { alignSelf: "stretch", maxHeight: 230, marginTop: 14 },
  flexFill: { flex: 1 },

  skeletonGap: { marginTop: 12 },
  lineGap: { marginTop: 4 },
  rowIconsSpacer: { width: 46 },

  // Pre-rendered (empty) states
  placeholder: { alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 28 },
  centerText: { textAlign: "center", maxWidth: 300 },

  // Meals
  cardStretch: { alignItems: "stretch" },
  fullWidth: { alignSelf: "stretch" },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, alignSelf: "stretch" },
  goalField: { flexGrow: 1, flexBasis: 130, gap: 6 },
  goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalLabel: { fontSize: 12, fontWeight: "700" },
  goalBox: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12 },
  goalInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600", paddingVertical: 0 },
  goalUnit: { fontSize: 12, fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recentDayTitle: { fontSize: 13, fontWeight: "800", marginTop: 12 },
  recentScans: { marginTop: 12, gap: 8 },
  dayTotals: { alignSelf: "stretch", marginTop: 12, marginBottom: 6, gap: 8 },
  dayKcal: { fontSize: 20, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: shellColors.primary },
  mealRow: { paddingVertical: 10, gap: 3 },
  mealRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  mealKcal: { fontSize: 12, fontWeight: "700" },

  // History
  historyList: { gap: 12 },
  dayGroup: { gap: 8 },
  dayHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  dayTitle: { fontSize: 15, fontWeight: "800" },
  daySummary: { fontSize: 12, marginLeft: "auto", flexShrink: 1 },
  scanRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.sm, borderWidth: 1, padding: 8 },
  scanThumb: { width: 64, height: 64, borderRadius: 6 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  more: { alignSelf: "center", borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 10 },
  moreText: { fontSize: 13, fontWeight: "700", color: shellColors.primary },
});

// ---- Meals -----------------------------------------------------------------------

const capitalizeType = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Meal");

// "7:42 AM", from the instant it was logged
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "");

// "Today" / "Yesterday" / "Mon, Sep 28". Days are read as local dates,
// never Date.parse, which treats "YYYY-MM-DD" as UTC midnight
export function dayLabel(day) {
  if (day === toLocalISODate()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === toLocalISODate(y)) return "Yesterday";
  const [yy, mm, dd] = day.split("-").map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Calories against the goal, or just the total when no goal is set
// "40g", or "40/120g" when that macro has a target
const macro = (value, goal) => (goal ? `${value}/${goal}g` : `${value}g`);

export function DayTotals({ totals, goals, tone }) {
  const goalKcal = goals?.dailyCaloriesKcal;
  const pct = goalKcal ? Math.min(totals.caloriesKcal / goalKcal, 1) : 0;
  return (
    <View style={styles.dayTotals}>
      <View style={styles.rowBetween}>
        <Text style={[styles.dayKcal, { color: tone.text }]}>
          {Math.round(totals.caloriesKcal)}
          <Text style={[styles.totalSuffix, { color: tone.muted }]}>{goalKcal ? ` / ${goalKcal} kcal` : " kcal"}</Text>
        </Text>
        <Text style={[styles.itemMeta, { color: tone.muted }]}>
          P {macro(totals.proteinG, goals?.dailyProteinG)} · C {macro(totals.carbsG, goals?.dailyCarbsG)} · F {macro(totals.fatG, goals?.dailyFatG)}
        </Text>
      </View>
      {!!goalKcal && (
        <View style={[styles.track, { backgroundColor: tone.border }]}>
          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

// One logged meal: type, time, its foods, and a delete button
export function MealRow({ meal, tone, onDelete, first, showDay = false }) {
  return (
    <View style={[styles.mealRow, !first && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.itemName, { color: tone.text }]}>
          {capitalizeType(meal.mealType)}
          <Text style={[styles.itemMeta, { color: tone.muted }]}>
            {"  "}{showDay ? `${dayLabel(meal.mealDate)}, ` : ""}{timeOf(meal.consumedAt)}
          </Text>
        </Text>
        <View style={styles.mealRight}>
          <Text style={[styles.mealKcal, { color: shellColors.primary }]}>{Math.round(meal.totals.caloriesKcal)} kcal</Text>
          <AskCoachButton mealId={meal.id} tone={tone} compact />
          {onDelete && (
            <Pressable onPress={() => onDelete(meal)} hitSlop={8} accessibilityLabel={`Delete ${meal.mealType}`}>
              <Ionicons name="trash-outline" size={16} color={tone.muted} />
            </Pressable>
          )}
        </View>
      </View>
      {meal.items.map((item) => (
        <Text key={String(item.itemId)} style={[styles.itemMeta, { color: tone.muted }]}>
          {item.foodName}
          {item.serving ? ` · ${item.servings} × ${item.serving}` : item.servings !== 1 ? ` · ${item.servings} servings` : ""}
          {` · ${Math.round(item.caloriesKcal || 0)} kcal`}
        </Text>
      ))}
    </View>
  );
}

/**
 * Delete confirmation for meals and scans. `describe(target)` gives the
 * dialog's title and message; `remove(id)` throws on failure
 */
export function useConfirmDelete(remove, describe) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    try {
      await remove(target.id);
      setTarget(null);
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't delete that. Please try again.");
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <ConfirmModal
      visible={Boolean(target)}
      tone="danger"
      title={target ? describe(target).title : ""}
      message={target ? describe(target).message : ""}
      onConfirm={confirm}
      onCancel={() => setTarget(null)}
      loading={busy}
    />
  );
  return { ask: setTarget, modal, error, clearError: () => setError("") };
}

export const describeMeal = (meal) => ({
  title: "Delete this meal?",
  message: `${capitalizeType(meal.mealType)}, ${Math.round(meal.totals.caloriesKcal)} kcal. This can't be undone.`,
});

// Logged meals keep their own copy of the nutrition, so they stay
export const describeScan = (scan) => ({
  title: "Delete this scan?",
  message: `${scanTitle(scan)} and its photo. Meals you logged from it stay. This can't be undone.`,
});

// Calendar day of an instant, on this device
export const dayOfInstant = (iso) => toLocalISODate(new Date(iso));

// "Adobong Manok, White Rice" or "Adobong Manok +2 more"
function scanTitle(scan) {
  const names = [...new Set(scan.items.map((i) => i.foodName))];
  if (!names.length) return "No food recognised";
  return names.length > 2 ? `${names[0]} +${names.length - 1} more` : names.join(", ");
}

// Also the row of the scanner page's "Recent Scans" card
// of the scanner page's "Recent Scans" card, where `showDay` adds the day
export function ScanHistoryRow({ scan, tone, onPress, onDelete, showDay = false }) {
  const title = scanTitle(scan);
  const kcal = scan.items.reduce((sum, i) => sum + (i.caloriesKcal || 0), 0);
  const [failed, setFailed] = useState(false);

  return (
    <Pressable onPress={onPress} style={[styles.scanRow, { borderColor: tone.border, backgroundColor: tone.card }]}>
      {scan.imageUrl && !failed ? (
        <ScanImage uri={scan.imageUrl} style={styles.scanThumb} contentFit="cover" onError={() => setFailed(true)} />
      ) : (
        // Purged on retention (or unreachable); the scan's nutrition is still there
        <View style={[styles.scanThumb, styles.thumbPlaceholder, { backgroundColor: tone.border }]}>
          <Ionicons name="image-outline" size={20} color={tone.muted} />
        </View>
      )}
      <View style={styles.flex1}>
        <Text style={[styles.itemName, { color: tone.text }]} numberOfLines={1}>{title}</Text>
        {/* One serving of each food found, before any adjusting */}
        <Text style={[styles.mealKcal, { color: shellColors.primary }]}>{Math.round(kcal)} kcal</Text>
        <Text style={[styles.itemMeta, { color: tone.muted }]}>
          {showDay ? `${dayLabel(dayOfInstant(scan.scannedAt))}, ` : ""}{timeOf(scan.scannedAt)}
        </Text>
      </View>
      {onDelete && (
        <Pressable onPress={() => onDelete(scan)} hitSlop={8} accessibilityLabel="Delete scan">
          <Ionicons name="trash-outline" size={16} color={tone.muted} />
        </Pressable>
      )}
      <Ionicons name="chevron-forward" size={18} color={tone.muted} />
    </Pressable>
  );
}

// ---- History ---------------------------------------------------------------------

// Spinner only for older pages; the first load shows row placeholders
// ---- First-load placeholders ------------------------------------------------------
// Each mirrors one real row or block (same container style, same line
// heights), so content swaps in without anything moving

export function MealRowSkeleton({ tone, first }) {
  return (
    <View style={[styles.mealRow, !first && { borderTopColor: tone.border, borderTopWidth: 1 }]}>
      <View style={styles.rowBetween}>
        <Skeleton width={150} height={18} />
        <Skeleton width={60} height={15} />
      </View>
      <Skeleton width={190} height={14} />
    </View>
  );
}

export function DayTotalsSkeleton({ tone }) {
  return (
    <View style={styles.dayTotals}>
      <View style={styles.rowBetween}>
        <Skeleton width={120} height={26} />
        <Skeleton width={130} height={14} />
      </View>
      <View style={[styles.track, { backgroundColor: tone.border }]} />
    </View>
  );
}

export function ScanRowSkeleton({ tone }) {
  return (
    <View style={[styles.scanRow, { borderColor: tone.border, backgroundColor: tone.card }]}>
      <Skeleton width={64} height={64} borderRadius={6} />
      <View style={styles.flex1}>
        <Skeleton width="70%" height={18} />
        <Skeleton width={60} height={15} style={styles.lineGap} />
        <Skeleton width={110} height={13} style={styles.lineGap} />
      </View>
      <View style={styles.rowIconsSpacer} />
    </View>
  );
}

export function DayHeadingSkeleton() {
  return (
    <View style={styles.dayHead}>
      <Skeleton width={16} height={16} />
      <Skeleton width={110} height={19} />
    </View>
  );
}
