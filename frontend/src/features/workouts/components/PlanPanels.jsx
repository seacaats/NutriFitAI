import { deleteSession, deleteSessionsOnDay, fetchExerciseInfo, getEnglishTranslation, getExerciseImages, getMuscleNames } from "@/features/workouts/hooks/useWorkoutApi";
import { useExerciseImages } from "@/features/workouts/hooks/useWorkoutSessions";
import { requireOnline } from "@/shared/api/apiClient";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import PlanButton from "@/shared/components/ui/PlanButton";
import { useTheme } from "@/shared/context/ThemeContext";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { estimateMinutes } from "./PlanModals";
import { EmptyState, FavoriteButton, groupByDay, PlanModal, SectionLabel } from "./PlanParts";
import { Cover, COVER_HEIGHT, coverImagesFor, Tile, TileBody, TileGrid, tileStyles } from "./PlanTiles";

// The Workouts page panels: favorites, recent sessions, routines and upcoming

// The Favorites, Routines and Upcoming tabs of the Workouts page.
// Data and actions come from useWorkoutPlan via the `plan` prop

// First load of a tab: real tiles (same grid, size and cover height) with
// placeholder content, so the loaded tiles land exactly where these were.
// Enough tiles to fill the screen, like Browse's first load
const LOADING_TILES = 12;

function Loading() {
  const { darkMode } = useTheme();
  return (
    <TileGrid>
      {Array.from({ length: LOADING_TILES }, (_, i) => i).map((i) => (
        <Tile key={i} darkMode={darkMode}>
          <Skeleton width="100%" height={COVER_HEIGHT} borderRadius={0} />
          <View style={tileStyles.body}>
            <Skeleton width="65%" height={18} />
            <Skeleton width="45%" height={14} style={{ marginTop: 6 }} />
          </View>
        </Tile>
      ))}
    </TileGrid>
  );
}

// Section heading used inside a tab, with an optional count
export function PanelHeading({ icon, title, count, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={panelStyles.heading}>
      <Ionicons name={icon} size={16} color={shellColors.primary} />
      <Text style={[panelStyles.headingText, { color: tone.text }]}>{title}</Text>
      {count != null && <Text style={[panelStyles.headingCount, { color: tone.muted }]}>{count}</Text>}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  loading: { paddingVertical: 48, alignItems: "center" },
  list: { gap: 10 },
  group: { gap: 8, marginBottom: 6 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kindIcon: { width: 36, height: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 140 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 14, fontWeight: "800", flexShrink: 1 },
  meta: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  timeCol: { minWidth: 64 },
  time: { fontSize: 13, fontWeight: "800" },
  column: { flexDirection: "column", alignItems: "stretch", gap: 0 },
  rowInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  subList: { marginTop: 6, gap: 6 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subName: { flex: 1, fontSize: 13, fontWeight: "600" },
  heading: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dayHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  dayDelete: { marginLeft: "auto", padding: 4 },
  expand: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start" },
  expandText: { fontSize: 12, fontWeight: "700" },
  headingText: { fontSize: 15, fontWeight: "800" },
  headingCount: { fontSize: 13, fontWeight: "700" },
});

// ---- Favorites ----------------------------------------------------------------

// Favorited routines, shown above the favorite exercises grid on the
// Favorites tab (the exercises reuse the Browse cards)
export function FavoriteRoutines({ plan, onStartRoutine, onSchedule, onEdit, darkMode }) {
  const favs = plan.favorites.filter((f) => f.kind === "routine");
  // Routine open in the details dialog, same as the Routines tab
  const [viewing, setViewing] = useState(null);
  const routinesOf = favs.map((f) => plan.routines.find((r) => r.id === f.refId)).filter(Boolean);
  const imageOf = useExerciseImages(routinesOf.flatMap((r) => r.exercises.map((e) => e.exerciseRef)));
  if (!favs.length) return null;

  return (
    <>
    <TileGrid>
      {favs.map((fav) => {
        const routine = plan.routines.find((r) => r.id === fav.refId);
        const target = { kind: "routine", refId: fav.refId, name: fav.name };

        return (
          <Tile key={fav.refId} darkMode={darkMode} onPress={routine ? () => requireOnline() && setViewing(routine) : undefined}>
            <Cover
              kind="routine"
              badge="Routine"
              images={routine ? coverImagesFor(routine, imageOf) : []}
              heart={<FavoriteButton active filledBackground onPress={() => plan.toggleFavorite(target)} />}
              darkMode={darkMode}
            />
            <TileBody
              title={fav.name}
              meta={routine ? `${routine.exercises.length} exercises` : "Routine no longer available"}
              darkMode={darkMode}
            >
              {routine && (
                <>
                  <PlanButton compact label="Start" onPress={() => onStartRoutine(routine)} darkMode={darkMode} />
                  <PlanButton compact variant="secondary" label="Schedule" onPress={() => onSchedule(target)} darkMode={darkMode} />
                </>
              )}
            </TileBody>
          </Tile>
        );
      })}
    </TileGrid>

    <RoutineDetailsModal
      visible={viewing !== null}
      routine={viewing}
      imageOf={imageOf}
      onClose={() => setViewing(null)}
      onStart={(r) => { setViewing(null); onStartRoutine(r); }}
      onSchedule={(r) => { setViewing(null); onSchedule({ kind: "routine", refId: r.id, name: r.title }); }}
      onEdit={onEdit && ((r) => { setViewing(null); onEdit(r); })}
      darkMode={darkMode}
    />
    </>
  );
}

// ---- Recent ------------------------------------------------------------------------

// "Today" / "Yesterday" / "Mon" / "21 Sep", from local calendar days, so a
// session at 11pm yesterday is "Yesterday" rather than "9 hours ago"
export function relativeDay(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "short" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// One logged session. Skipped ones are shown, in amber rather than red:
// an abandoned set isn't an error. Routine tiles expand to their exercises.
// `timeOnly` shows the time instead of the day, for lists already grouped by day
export function SessionTile({ session, imageOf, darkMode, timeOnly = false, onDelete, onOpen }) {
  const tone = getScreenTones(darkMode);
  const [open, setOpen] = useState(false);
  const routine = session.kind === "routine";
  const skipped = session.status === "skipped";
  const minutes = session.actualDurationSeconds ? Math.round(session.actualDurationSeconds / 60) : null;
  const items = routine ? session.exercises || [] : [];

  const meta = [
    routine
      ? `${session.completedSets} of ${session.targetSets} exercises`
      : skipped
        ? `${session.completedSets} of ${session.targetSets} sets`
        : `${session.completedSets} × ${session.targetReps}`,
    minutes ? `${minutes} min` : null,
    timeOnly && session.completedAt
      ? new Date(session.completedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : relativeDay(session.completedAt),
  ].filter(Boolean).join(" · ");

  return (
    <Tile darkMode={darkMode} onPress={onOpen && (() => onOpen(session))}>
      <Cover
        kind={session.kind}
        badge={session.origin === "scheduled" ? "Planned" : routine ? "Routine" : "Exercise"}
        images={coverImagesFor(session, imageOf)}
        heart={onDelete && (
          <Pressable onPress={() => onDelete(session)} style={tileStyles.iconBtn} hitSlop={6} accessibilityLabel="Delete session">
            <Ionicons name="trash-outline" size={16} color="#ffffff" />
          </Pressable>
        )}
        darkMode={darkMode}
      />
      <TileBody
        title={routine ? session.routineName : session.exerciseName}
        meta={meta}
        metaColor={skipped ? "#b7791f" : undefined}
        darkMode={darkMode}
        extra={items.length > 0 && (
          <>
            <Pressable onPress={() => setOpen((o) => !o)} style={panelStyles.expand} hitSlop={6}>
              <Text style={[panelStyles.expandText, { color: shellColors.primary }]}>
                {open ? "Hide exercises" : "Show exercises"}
              </Text>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={shellColors.primary} />
            </Pressable>
            {open && (
              <View style={panelStyles.subList}>
                {items.map((e) => (
                  <View key={`${e.position}-${e.exerciseRef}`} style={panelStyles.subRow}>
                    <Ionicons
                      name={e.done ? "checkmark-circle" : "ellipse-outline"}
                      size={15}
                      color={e.done ? shellColors.primary : tone.muted}
                    />
                    <Text numberOfLines={1} style={[panelStyles.subName, { color: tone.text }]}>{e.exerciseName}</Text>
                    <Text style={[panelStyles.meta, { color: tone.muted }]}>{e.completedSets}/{e.targetSets ?? "?"}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      />
    </Tile>
  );
}

// Delete one logged session or a whole day, behind the shared confirm dialog.
// Returns the ask functions and the dialog to render; `onDeleted` refreshes
export function useSessionDeletes(onDeleted) {
  const [pending, setPending] = useState(null); // { session } | { day }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setPending(null);
    setError("");
  };

  async function confirm() {
    setBusy(true);
    try {
      if (pending.session) await deleteSession(pending.session.id);
      else await deleteSessionsOnDay(pending.day.date);
      close();
      onDeleted?.();
    } catch (err) {
      setError(err?.message || "Couldn't delete that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const s = pending?.session;
  const name = s ? (s.kind === "routine" ? s.routineName : s.exerciseName) : "";
  const count = pending?.day?.sessions?.length || 0;

  const modal = (
    <ConfirmModal
      visible={Boolean(pending)}
      tone="danger"
      title={s ? "Delete this session?" : `Delete ${pending?.day?.label || "this day"}'s workouts?`}
      message={error || (s
        ? `${name} will be removed from your history and weekly totals.`
        : `All ${count} session${count === 1 ? "" : "s"} from that day will be removed from your history and weekly totals.`)}
      confirmLabel="Delete"
      onConfirm={confirm}
      onCancel={close}
      loading={busy}
    />
  );

  return {
    askSession: (session) => setPending({ session }),
    askDay: (day) => setPending({ day }),
    modal,
  };
}

// Day heading with a delete-the-day button, for Recent and Full history
function DayHeading({ label, count, onDelete, darkMode, children }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={panelStyles.dayHeading}>
      {children}
      <Text style={[panelStyles.headingText, { color: tone.text }]}>{label}</Text>
      <Text style={[panelStyles.headingCount, { color: tone.muted }]}>
        {count} session{count === 1 ? "" : "s"}
      </Text>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={panelStyles.dayDelete} accessibilityLabel={`Delete ${label}'s sessions`}>
          <Ionicons name="trash-outline" size={16} color={tone.muted} />
        </Pressable>
      )}
    </View>
  );
}

// Recent tab: grouped by day, routine runs first within a day
// A logged or planned routine session as the details dialog shows it: the
// saved routine when it still exists, else the exercises the session kept
// (Edit hidden then, there's nothing left to edit)
export function routineForSession(session, routines = []) {
  return routines.find((r) => r.id === session.routineId) || {
    id: session.routineId,
    title: session.routineName,
    builtIn: true,
    // Deleted since: Start and Schedule have nothing to run
    missing: true,
    exercises: (session.exercises || []).map((e) => ({
      exerciseRef: e.exerciseRef,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
    })),
  };
}

// `routines`, `onOpenExercise`, `onStartRoutine`, `onSchedule`: tapping a
// tile opens its details, like Browse and Routines
export function RecentPanel({ sessions, loading, onSeeAll, onGoBrowse, onChanged, darkMode }) {
  // Same read-only details as History: a routine as it was done, an exercise with its catalog details
  const [viewing, setViewing] = useState(null);
  const [viewingExercise, setViewingExercise] = useState(null);
  // No details dialogs while the server can't be reached
  const open = (s) => requireOnline() && (s.kind === "routine" ? setViewing(routineForSession(s)) : setViewingExercise(s));
  const imageOf = useExerciseImages(
    sessions.flatMap((s) => (s.kind === "routine" ? (s.exercises || []).map((e) => e.exerciseRef) : [s.exerciseRef])),
  );
  const deletes = useSessionDeletes(onChanged);

  const header = (
    <View style={panelStyles.panelHeader}>
      <SectionLabel darkMode={darkMode}>Latest workouts</SectionLabel>
      <PlanButton compact variant="secondary" label="Full history" onPress={onSeeAll} darkMode={darkMode} />
    </View>
  );

  // Header is static, so it shows while the tiles load
  if (loading && !sessions.length) return <View style={panelStyles.list}>{header}<Loading /></View>;

  if (!sessions.length) {
    return (
      <EmptyState
        icon="time-outline"
        title="No workouts yet"
        body="Finished and partly finished workouts show up here."
        action={<PlanButton variant="secondary" label="Browse exercises" onPress={onGoBrowse} darkMode={darkMode} />}
        darkMode={darkMode}
      />
    );
  }

  const byKind = (a, b) => (a.kind === b.kind ? 0 : a.kind === "routine" ? -1 : 1);

  return (
    <View style={panelStyles.list}>
      {header}

      {groupByDay(sessions).map((day) => (
        <View key={day.key} style={panelStyles.group}>
          <DayHeading label={day.label} count={day.sessions.length} onDelete={() => deletes.askDay(day)} darkMode={darkMode} />
          <TileGrid>
            {[...day.sessions].sort(byKind).map((s) => (
              <SessionTile key={s.id} session={s} imageOf={imageOf} onDelete={deletes.askSession} onOpen={open} darkMode={darkMode} />
            ))}
          </TileGrid>
        </View>
      ))}

      {deletes.modal}

      <RoutineDetailsModal
        visible={viewing !== null}
        routine={viewing}
        imageOf={imageOf}
        onClose={() => setViewing(null)}
        darkMode={darkMode}
      />

      <ExerciseSessionModal
        visible={viewingExercise !== null}
        session={viewingExercise}
        onClose={() => setViewingExercise(null)}
        darkMode={darkMode}
      />
    </View>
  );
}

// ---- Routines -------------------------------------------------------------------

export function RoutinesPanel({ plan, onNew, onEdit, onStart, onSchedule, darkMode }) {
  const tone = getScreenTones(darkMode);
  // Routine waiting on the delete confirmation
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Routine open in the details dialog (tapping a tile)
  const [viewing, setViewing] = useState(null);
  const imageOf = useExerciseImages(plan.routines.flatMap((r) => r.exercises.map((e) => e.exerciseRef)));

  const newButton = <PlanButton label="New routine" onPress={onNew} darkMode={darkMode} />;

  // The New routine button works before the list arrives; only the count waits
  if (plan.loading && !plan.routines.length) {
    return (
      <View style={panelStyles.list}>
        <View style={panelStyles.panelHeader}>
          <Skeleton width={90} height={14} />
          {newButton}
        </View>
        <Loading />
      </View>
    );
  }

  if (!plan.routines.length) {
    return (
      <EmptyState
        icon="list-outline"
        title="No routines yet"
        body="Group the exercises you do together, like a Push Day or a Morning Core set, and start them in one tap."
        action={newButton}
        darkMode={darkMode}
      />
    );
  }

  return (
    <View style={panelStyles.list}>
      <View style={panelStyles.panelHeader}>
        <SectionLabel darkMode={darkMode}>{`${plan.routines.length} routines`}</SectionLabel>
        {newButton}
      </View>

      <TileGrid>
        {plan.routines.map((routine) => {
          const target = { kind: "routine", refId: routine.id, name: routine.title };
          const meta = [
            `${routine.exercises.length} exercises`,
            routine.estimatedDurationMinutes ? `about ${routine.estimatedDurationMinutes} min` : null,
          ].filter(Boolean).join(" · ");

          return (
            <Tile key={routine.id} darkMode={darkMode} onPress={() => requireOnline() && setViewing(routine)}>
              <Cover
                kind="routine"
                badge={routine.builtIn ? "Built-in" : "Routine"}
                images={coverImagesFor(routine, imageOf)}
                heart={(
                  <FavoriteButton
                    filledBackground
                    active={plan.isFavorite("routine", routine.id)}
                    onPress={() => plan.toggleFavorite(target)}
                  />
                )}
                darkMode={darkMode}
              />
              <TileBody
                title={routine.title}
                meta={meta}
                darkMode={darkMode}
                extra={!!routine.description && (
                  <Text numberOfLines={2} style={[panelStyles.meta, { color: tone.muted }]}>{routine.description}</Text>
                )}
              >
                <PlanButton compact label="Start" onPress={() => onStart(routine)} darkMode={darkMode} />
                <PlanButton compact variant="secondary" label="Schedule" onPress={() => onSchedule(target)} darkMode={darkMode} />
                {!routine.builtIn && (
                  <>
                    <PlanButton compact variant="secondary" label="Edit" onPress={() => onEdit(routine)} darkMode={darkMode} />
                    <PlanButton compact variant="danger" label="Delete" onPress={() => setPendingDelete(routine)} darkMode={darkMode} />
                  </>
                )}
              </TileBody>
            </Tile>
          );
        })}
      </TileGrid>

      {/* Each action closes the details first, so only one dialog is up */}
      <RoutineDetailsModal
        visible={viewing !== null}
        routine={viewing}
        imageOf={imageOf}
        onClose={() => setViewing(null)}
        onStart={(r) => { setViewing(null); onStart(r); }}
        onSchedule={(r) => { setViewing(null); onSchedule({ kind: "routine", refId: r.id, name: r.title }); }}
        onEdit={(r) => { setViewing(null); onEdit(r); }}
        darkMode={darkMode}
      />

      <ConfirmModal
        visible={Boolean(pendingDelete)}
        tone="danger"
        title="Delete this routine?"
        message={`"${pendingDelete?.title || ""}" will be deleted, along with its favorites and upcoming plans. Past runs stay in your history.`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await plan.removeRoutine(pendingDelete.id);
            setPendingDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </View>
  );
}

// What's in a routine, read-only: every exercise with its sets and reps, in
// order. Opened by tapping a routine tile; editing stays behind Edit. Each
// action shows only when its handler is passed
export function RoutineDetailsModal({ visible, routine: routineProp, imageOf, onClose, onStart, onSchedule, onEdit, darkMode }) {
  const tone = getScreenTones(darkMode);
  // Kept while the dialog closes, like PlanModal's own content
  const routine = useHeldWhileClosing(visible, routineProp);
  if (!routine) return null;

  const minutes = routine.estimatedDurationMinutes || estimateMinutes(routine.exercises);
  const meta = [`${routine.exercises.length} exercises`, minutes ? `about ${minutes} min` : null].filter(Boolean).join(" · ");

  return (
    <PlanModal
      visible={visible}
      onClose={onClose}
      darkMode={darkMode}
      title={routine.title}
      subtitle={meta}
      footer={(
        <>
          {!routine.builtIn && onEdit && (
            <PlanButton label="Edit" variant="secondary" onPress={() => onEdit(routine)} darkMode={darkMode} />
          )}
          {onSchedule && (
            <PlanButton label="Schedule" variant="secondary" onPress={() => onSchedule(routine)} darkMode={darkMode} />
          )}
          {onStart && <PlanButton label="Start" onPress={() => onStart(routine)} darkMode={darkMode} />}
        </>
      )}
    >
      {!!routine.description && (
        <Text style={[detailStyles.description, { color: tone.muted }]}>{routine.description}</Text>
      )}

      <SectionLabel darkMode={darkMode}>Exercises</SectionLabel>
      {routine.exercises.map((e, i) => (
        <View key={`${e.exerciseRef}-${i}`} style={[detailStyles.row, { borderColor: tone.border }]}>
          <Text style={[detailStyles.index, { color: shellColors.primary }]}>{i + 1}</Text>
          {imageOf?.(e.exerciseRef) ? (
            <Image source={{ uri: imageOf(e.exerciseRef) }} style={detailStyles.thumb} contentFit="cover" />
          ) : (
            <View style={[detailStyles.thumb, { backgroundColor: tone.soft }]}>
              <Ionicons name="barbell-outline" size={16} color={tone.muted} />
            </View>
          )}
          <Text numberOfLines={2} style={[detailStyles.name, { color: tone.text }]}>{e.exerciseName}</Text>
          <Text style={[detailStyles.sets, { color: tone.muted }]}>{`${e.targetSets} × ${e.targetReps}`}</Text>
        </View>
      ))}
    </PlanModal>
  );
}

// One logged exercise, read-only: what the exercise is (from the catalog)
// and what was done that time. Workout History's version of Browse's
// details; nothing to start or log from a past session
export function ExerciseSessionModal({ visible, session: sessionProp, onClose, darkMode }) {
  const tone = getScreenTones(darkMode);
  const session = useHeldWhileClosing(visible, sessionProp);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !sessionProp?.exerciseRef) return undefined;
    let live = true;
    // Cancelled outright when the dialog closes
    const abort = new AbortController();
    setLoading(true);
    setInfo(null);
    fetchExerciseInfo(sessionProp.exerciseRef, { signal: abort.signal })
      .then((data) => live && setInfo(data))
      .catch(() => live && setInfo(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
      abort.abort();
    };
  }, [visible, sessionProp?.exerciseRef]);

  if (!session) return null;
  const minutes = session.actualDurationSeconds ? Math.round(session.actualDurationSeconds / 60) : null;
  const done = [`${session.completedSets} of ${session.targetSets ?? "?"} sets`, `${session.targetReps ?? "?"} reps`, minutes ? `${minutes} min` : null]
    .filter(Boolean).join(" · ");
  const image = info ? getExerciseImages(info)[0] : null;
  const muscles = info ? getMuscleNames(info) : [];
  const description = info ? getEnglishTranslation(info).description.replace(/<[^>]*>/g, "").trim() : "";

  return (
    <PlanModal visible={visible} onClose={onClose} darkMode={darkMode} title={session.exerciseName} subtitle={done}>
      {/* Same shape as what loads: photo, category, muscles, how-to */}
      {loading ? (
        <>
          <Skeleton width="100%" height={180} borderRadius={radii.md} />
          <Skeleton width="30%" height={13} />
          <Skeleton width={70} height={11} />
          <Skeleton width="60%" height={13} />
          <Skeleton width={60} height={11} />
          <Skeleton width="100%" height={13} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="70%" height={13} />
        </>
      ) : image ? <Image source={{ uri: image }} style={detailStyles.hero} contentFit="cover" /> : null}
      {!!info?.category?.name && <Text style={[detailStyles.description, { color: tone.muted }]}>{info.category.name}</Text>}
      {muscles.length > 0 && (
        <>
          <SectionLabel darkMode={darkMode}>Muscles</SectionLabel>
          <Text style={[detailStyles.description, { color: tone.text }]}>{muscles.join(", ")}</Text>
        </>
      )}
      {!!description && (
        <>
          <SectionLabel darkMode={darkMode}>How to</SectionLabel>
          <Text style={[detailStyles.description, { color: tone.muted }]}>{description}</Text>
        </>
      )}
    </PlanModal>
  );
}

const detailStyles = StyleSheet.create({
  hero: { width: "100%", height: 180, borderRadius: radii.md },
  description: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  index: { fontSize: 13, fontWeight: "800", width: 18 },
  thumb: { width: 40, height: 40, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { flex: 1, fontSize: 14, fontWeight: "700" },
  sets: { fontSize: 13, fontWeight: "700" },
});

// ---- Upcoming ---------------------------------------------------------------------

// "Today" / "Tomorrow" / "Wednesday, Sep 30" from a scheduled instant
function dayHeading(iso) {
  const d = new Date(iso);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(new Date())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// Missed plans stay startable (or reschedulable) for this long, then the
// server's TTL removes them. Mirrors GRACE_MS in WorkoutSession.js
const GRACE_MS = 24 * 60 * 60 * 1000;
const MISSED = "#b7791f";

// "3h" / "45m" left before a missed plan is removed
function timeLeft(scheduledFor) {
  const ms = new Date(scheduledFor).getTime() + GRACE_MS - Date.now();
  const hours = Math.floor(ms / 3600000);
  return hours >= 1 ? `${hours}h` : `${Math.max(1, Math.ceil(ms / 60000))}m`;
}

export function UpcomingPanel({ plan, onStart, onReschedule, onGoBrowse, onOpenExercise, darkMode }) {
  // Planned routine open in the details dialog: { session, routine }
  const [viewing, setViewing] = useState(null);
  const imageOf = useExerciseImages(
    plan.schedule.flatMap((s) => (s.kind === "routine" ? (s.exercises || []).map((e) => e.exerciseRef) : [s.exerciseRef])),
  );

  if (plan.loading && !plan.schedule.length) return <Loading />;

  if (!plan.schedule.length) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="Nothing scheduled"
        body="Schedule an exercise or routine for any time in the next 7 days and it will show up here."
        action={<PlanButton variant="secondary" label="Browse exercises" onPress={onGoBrowse} darkMode={darkMode} />}
        darkMode={darkMode}
      />
    );
  }

  const now = Date.now();
  const missed = plan.schedule.filter((s) => new Date(s.scheduledFor).getTime() < now);
  const ahead = plan.schedule.filter((s) => new Date(s.scheduledFor).getTime() >= now);

  // Ahead: grouped by local day, already sorted soonest first by the server
  const groups = [];
  for (const session of ahead) {
    const heading = dayHeading(session.scheduledFor);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(session);
    else groups.push({ heading, items: [session] });
  }

  const renderTile = (session, isMissed) => {
    const routine = session.kind === "routine";
    const time = new Date(session.scheduledFor).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    // Plans made before exercise snapshots fall back to the routine itself
    const source = routine && !session.exercises?.length
      ? plan.routines.find((r) => r.id === session.routineId) || session
      : session;
    const what = routine
      ? `Routine · ${session.targetSets || 0} exercises`
      : `Exercise · ${session.targetSets || 3} × ${session.targetReps || 10}`;

    return (
      <Tile
        key={session.id}
        darkMode={darkMode}
        accent={isMissed ? MISSED : null}
        onPress={() => requireOnline() && (routine
          ? setViewing({ session, routine: routineForSession(session, plan.routines) })
          : onOpenExercise?.(session.exerciseRef))}
      >
        <Cover
          kind={session.kind}
          badge={isMissed ? `Missed · ${dayHeading(session.scheduledFor)} ${time}` : time}
          images={coverImagesFor(source, imageOf)}
          darkMode={darkMode}
        />
        <TileBody
          title={routine ? session.routineName : session.exerciseName}
          meta={what}
          darkMode={darkMode}
          extra={isMissed && (
            <Text style={[panelStyles.meta, { color: MISSED }]}>
              Start it late or reschedule. Removed in {timeLeft(session.scheduledFor)}.
            </Text>
          )}
        >
          <PlanButton compact label={isMissed ? "Start late" : "Start"} onPress={() => onStart(session)} darkMode={darkMode} />
          {isMissed && (
            <PlanButton compact variant="secondary" label="Reschedule" onPress={() => onReschedule(session)} darkMode={darkMode} />
          )}
          <PlanButton compact variant="secondary" label="Remove" onPress={() => plan.unschedule(session.id)} darkMode={darkMode} />
        </TileBody>
      </Tile>
    );
  };

  return (
    <View style={panelStyles.list}>
      {missed.length > 0 && (
        <View style={panelStyles.group}>
          <View style={panelStyles.heading}>
            <Ionicons name="alert-circle" size={16} color={MISSED} />
            <Text style={[panelStyles.headingText, { color: MISSED }]}>Missed</Text>
            <Text style={[panelStyles.headingCount, { color: MISSED }]}>{missed.length}</Text>
          </View>
          <TileGrid>{missed.map((s) => renderTile(s, true))}</TileGrid>
        </View>
      )}

      {groups.map((group) => (
        <View key={group.heading} style={panelStyles.group}>
          <SectionLabel darkMode={darkMode}>{group.heading}</SectionLabel>
          <TileGrid>{group.items.map((s) => renderTile(s, false))}</TileGrid>
        </View>
      ))}

      {/* Start runs the planned session itself, so it's marked done */}
      <RoutineDetailsModal
        visible={viewing !== null}
        routine={viewing?.routine}
        imageOf={imageOf}
        onClose={() => setViewing(null)}
        onStart={viewing && (() => { const { session } = viewing; setViewing(null); onStart(session); })}
        darkMode={darkMode}
      />
    </View>
  );
}
