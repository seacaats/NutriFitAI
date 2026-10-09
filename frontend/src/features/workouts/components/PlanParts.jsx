import { useAuth } from "@/shared/context/AuthContext";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { toLocalISODate } from "@/shared/utils/dates";
import { getRemembered, setRemembered } from "@/shared/utils/rememberedState";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Small parts shared by the Workouts plan: chips, modal shell, tabs and day grouping

// Small building blocks shared by the plan panels and dialogs

// Selectable chip (days, times)
export function Chip({ label, sublabel, active, onPress, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <Pressable
      onPress={onPress}
      style={[
        uiStyles.chip,
        { borderColor: active ? shellColors.primary : tone.border },
        active && { backgroundColor: tone.soft },
      ]}
    >
      <Text style={[uiStyles.chipText, { color: active ? shellColors.primary : tone.text }]}>{label}</Text>
      {!!sublabel && <Text style={[uiStyles.chipSub, { color: tone.muted }]}>{sublabel}</Text>}
    </Pressable>
  );
}

// Centered icon + text for empty tabs
export function EmptyState({ icon, title, body, action, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={uiStyles.empty}>
      <View style={[uiStyles.emptyIcon, { backgroundColor: tone.soft }]}>
        <Ionicons name={icon} size={26} color={shellColors.primary} />
      </View>
      <Text style={[uiStyles.emptyTitle, { color: tone.text }]}>{title}</Text>
      <Text style={[uiStyles.emptyBody, { color: tone.muted }]}>{body}</Text>
      {action}
    </View>
  );
}

export function SectionLabel({ children, darkMode }) {
  const tone = getScreenTones(darkMode);
  return <Text style={[uiStyles.section, { color: tone.muted }]}>{children}</Text>;
}

const uiStyles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 58 },
  chipText: { fontSize: 13, fontWeight: "700" },
  chipSub: { fontSize: 10, marginTop: 1 },

  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyBody: { fontSize: 13, textAlign: "center", maxWidth: 360, lineHeight: 19, marginBottom: 6 },

  section: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
});

// ♥ toggle used on exercise cards, the detail sheet and plan rows

const HEART = "#e5484d";

export function FavoriteButton({ active, onPress, size = 18, style, filledBackground = false }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? "Remove from favorites" : "Add to favorites"}
      style={[filledBackground && heartStyles.bubble, style]}
    >
      <Ionicons name={active ? "heart" : "heart-outline"} size={size} color={active ? HEART : filledBackground ? "#ffffff" : "#9aa2b1"} />
    </Pressable>
  );
}

const heartStyles = StyleSheet.create({
  // Readable over photos: a dark translucent circle
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});

// Shared shell for the schedule, routine editor and routine player dialogs:
// a centered card on web, a bottom sheet on phones

export function PlanModal({ visible, title, subtitle, onClose, footer, children, darkMode, wide = false }) {
  const tone = getScreenTones(darkMode);
  const web = Platform.OS === "web";
  // Each caller clears its routine or session as it closes; the last open
  // content stays up while the dialog leaves (like ConfirmModal)
  const shown = useHeldWhileClosing(visible, { title, subtitle, footer, children });
  // Phone sheets reach the screen edge: keep the last row clear of the
  // gesture bar, with the same breathing room as Browse's details
  const insets = useSafeAreaInsets();
  const sheetPad = web ? null : { paddingBottom: insets.bottom + (shown.footer ? 14 : 40) };

  return (
    // Never over another screen: hidden once you've navigated away
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[modalStyles.overlay, !web && modalStyles.overlaySheet]}>
        {/* Tapping the dim background closes, like most modern dialogs */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[
            modalStyles.card,
            web ? [modalStyles.cardWeb, wide && modalStyles.cardWide] : modalStyles.cardSheet,
            { backgroundColor: tone.card, borderColor: tone.border },
          ]}
        >
          <View style={modalStyles.header}>
            <View style={modalStyles.flex1}>
              <Text style={[modalStyles.title, { color: tone.text }]}>{shown.title}</Text>
              {!!shown.subtitle && <Text style={[modalStyles.subtitle, { color: tone.muted }]}>{shown.subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close dialog">
              <Ionicons name="close" size={22} color={tone.muted} />
            </Pressable>
          </View>

          <ScrollView style={modalStyles.body} contentContainerStyle={[modalStyles.bodyContent, !shown.footer && sheetPad]} keyboardShouldPersistTaps="handled">
            {shown.children}
          </ScrollView>

          {!!shown.footer && <View style={[modalStyles.footer, { borderTopColor: tone.border }, sheetPad]}>{shown.footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 12 },
  overlaySheet: { justifyContent: "flex-end", padding: 0 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardWeb: { width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: radii.lg },
  cardWide: { maxWidth: 720 },
  cardSheet: { width: "100%", maxHeight: "92%", borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  flex1: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
});

// Segmented tabs for the Workouts page. Counts show only when non-zero

const WORKOUT_TABS = [
  { key: "browse", label: "Browse", icon: "search" },
  { key: "routines", label: "Routines", icon: "list" },
  { key: "favorites", label: "Favorites", icon: "heart" },
  { key: "upcoming", label: "Upcoming", icon: "calendar" },
  { key: "recent", label: "Recent", icon: "time" },
];

// A tab is remembered for a few hours. After that the page opens on Browse
// ("Picked for you"), the more useful start to a new session
const TAB_MEMORY_MS = 4 * 60 * 60 * 1000;
const isTab = (key) => WORKOUT_TABS.some((t) => t.key === key);

// The open tab. A link's ?tab= (a workout reminder, the dashboard's plan)
// opens that tab without being remembered; otherwise the last tab this
// account picked recently, else Browse. Unknown values are ignored
export function useWorkoutTab() {
  const userId = useAuth().user?.id;
  const { tab: linked } = useLocalSearchParams();
  const [tab, setTabState] = useState(isTab(linked) ? linked : "browse");

  useEffect(() => {
    if (isTab(linked)) {
      setTabState(linked);
      return;
    }
    getRemembered("workouts-tab", userId, TAB_MEMORY_MS).then((saved) => {
      if (isTab(saved)) setTabState(saved);
    });
  }, [linked, userId]);

  const setTab = useCallback((next) => {
    setTabState(next);
    setRemembered("workouts-tab", userId, next);
  }, [userId]);

  return [tab, setTab];
}

export function WorkoutTabs({ value, onChange, counts = {}, darkMode }) {
  const tone = getScreenTones(darkMode);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tabStyles.row}>
      <View style={[tabStyles.track, { backgroundColor: tone.surfaceMuted }]}>
        {WORKOUT_TABS.map((tab) => {
          const active = tab.key === value;
          const count = counts[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[tabStyles.tab, active && [tabStyles.tabActive, { backgroundColor: tone.card }]]}
            >
              <Ionicons
                name={active ? tab.icon : `${tab.icon}-outline`}
                size={15}
                color={active ? shellColors.primary : tone.muted}
              />
              <Text style={[tabStyles.label, { color: active ? tone.text : tone.muted }]}>{tab.label}</Text>
              {!!count && (
                <View style={[tabStyles.badge, { backgroundColor: active ? shellColors.primary : tone.border }]}>
                  <Text style={[tabStyles.badgeText, { color: active ? "#ffffff" : tone.text }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  row: { paddingVertical: 2 },
  track: { flexDirection: "row", borderRadius: radii.md, padding: 4, gap: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  tabActive: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: "700" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

// ---- Day grouping ----------------------------------------------------------------

/**
 * Groups sessions under day headings
 *
 * Done client-side on an already-fetched page rather than with a $group in the
 * aggregation: grouping server-side would have to pick a timezone and would
 * break paging, since a group can straddle a page boundary. The list arrives
 * sorted newest-first, so a single pass is enough
 */
export function groupByDay(sessions) {
  const groups = [];
  let current = null;

  for (const session of sessions) {
    const key = dayKey(session.completedAt);
    if (!current || current.key !== key) {
      current = { key, date: toLocalISODate(new Date(session.completedAt)), label: sessionDayLabel(session.completedAt), sessions: [] };
      groups.push(current);
    }
    current.sessions.push(session);
  }

  return groups;
}

/** Local calendar day, so sessions group the way the user experienced them */
function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sessionDayLabel(iso) {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });

  // The year is included only when it is not the current one — "12 Mar" reads
  // better than "12 Mar 2026" until the distinction actually matters
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
