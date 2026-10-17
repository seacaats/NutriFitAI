import { SeverityBadge } from "@/features/admin/components/Badges";
import DataTable, { DetailGrid, FilterRow, Pager } from "@/features/admin/components/DataTable";
import { BY_USER, HELD, useAuditLogs, useUserSearch } from "@/features/admin/hooks/useAuditLogs";
import Skeleton from "@/shared/components/Skeleton";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

// Server decides which rows and fields each role sees, and words them
// (message + fields). audit_logs.createdAt is an instant, a separate concern
// from the CALENDAR DAYS rule established and followed

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Rows this close to their TTL get a badge, so a superadmin can hold them in time
const EXPIRY_WARNING_DAYS = 30;

// Skeleton gray for blocks on the page background in light mode (the default
// one is meant for cards and barely shows against the page)
const LIGHT_SKELETON_ON_PAGE = "#dfe3e8";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

/**
 * The drawer's notes thread and hold control for one row. Its own component
 * so each open drawer keeps its own draft and status.
 *
 * Notes: admins and superadmins, append-only (a correction is a new note).
 * Hold: superadmin only, needs a reason, and is itself audited
 */
function RowNotesAndHold({ row, log, isSuper, tone }) {
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // listNotes is stable (useCallback), so this refetches only when the row
  // or its note count changes, not on every parent render
  const { listNotes } = log;
  useEffect(() => {
    let cancelled = false;
    listNotes(row.id)
      .then((data) => { if (!cancelled) setNotes(data); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [row.id, row.noteCount, listNotes]);

  const submit = async (action) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setNotice(result);
    if (result.ok) { setDraft(""); setReason(""); }
  };

  return (
    <View style={[styles.notesBox, { borderColor: tone.border }]}>
      <Text style={[styles.changesTitle, { color: tone.muted }]}>NOTES</Text>
      {notes === null ? (
        <View style={styles.noteSkeleton}>
          <Skeleton width="40%" height={11} />
          <Skeleton width="85%" height={12} />
        </View>
      ) : notes.length === 0 ? (
        <Text style={[styles.noteMeta, { color: tone.muted }]}>No notes yet.</Text>
      ) : (
        notes.map((note) => (
          <View key={note.id} style={styles.note}>
            <Text style={[styles.noteMeta, { color: tone.muted }]}>
              {note.author || "Unknown"} · {formatTimestamp(note.createdAt)}
            </Text>
            <Text selectable style={[styles.noteBody, { color: tone.text }]}>{note.body}</Text>
          </View>
        ))
      )}
      <View style={styles.noteForm}>
        <RingInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a note for other admins"
          placeholderTextColor={tone.muted}
          multiline
          maxLength={1000}
          style={[styles.noteInput, { backgroundColor: tone.card, borderColor: tone.border, color: tone.text }]}
        />
        <Pressable
          onPress={() => submit(() => log.addNote(row.id, draft.trim()))}
          disabled={busy || !draft.trim()}
          style={[styles.smallBtn, { borderColor: tone.border }, (busy || !draft.trim()) && styles.btnDisabled]}
        >
          <Text style={[styles.smallBtnText, { color: tone.text }]}>Add note</Text>
        </Pressable>
      </View>

      {isSuper && (
        <View style={[styles.holdRow, { borderTopColor: tone.border }]}>
          <Text style={[styles.noteMeta, { color: tone.muted }]}>
            {row.held
              ? "Held: this entry is kept after it expires."
              : "Hold this entry to keep it after it expires."}
          </Text>
          <View style={styles.noteForm}>
            <RingInput
              value={reason}
              onChangeText={setReason}
              placeholder={row.held ? "Reason for releasing (required)" : "Reason for holding (required)"}
              placeholderTextColor={tone.muted}
              // Same box as the note above: wraps, then scrolls
              multiline
              maxLength={300}
              style={[styles.noteInput, { backgroundColor: tone.card, borderColor: tone.border, color: tone.text }]}
            />
            <Pressable
              onPress={() => submit(() => (row.held ? log.release(row.id, reason.trim()) : log.hold(row.id, reason.trim())))}
              disabled={busy || reason.trim().length < 3}
              style={[styles.smallBtn, { borderColor: tone.border }, (busy || reason.trim().length < 3) && styles.btnDisabled]}
            >
              <Text style={[styles.smallBtnText, { color: tone.text }]}>{row.held ? "Release hold" : "Hold"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {notice && (
        <Text style={[styles.noteMeta, { color: notice.ok ? tone.muted : colors.danger }]}>{notice.message}</Text>
      )}
    </View>
  );
}

const CATEGORY_LABELS = {
  auth: "Auth",
  account: "Account",
  activity: "Activity",
  nutrition: "Nutrition",
  workout: "Workouts",
  coach: "AI Coach",
  notification: "Notifications",
  administration: "Administration",
  system: "System",
};

// "By User" side filter. "Self" = the user acted on their own account
const SUBJECT_MODES = [
  { value: "all", label: "All" },
  { value: "actor", label: "As Actor" },
  { value: "target", label: "As Target" },
  { value: "self", label: "Self" },
];

const ROLE_LABELS = { user: "User", admin: "Admin", superadmin: "Superadmin" };

// A full user id (UUID), searchable only when no name or email matches
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "User (Unverified)" when the actor hadn't verified their email at the time
function actorRoleLabel(row) {
  if (!row.actorRole) return null;
  const base = ROLE_LABELS[row.actorRole] || row.actorRole;
  return row.actorVerified === false ? `${base} (Unverified)` : base;
}

export default function AuditLogsScreen() {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const log = useAuditLogs();
  const [expandedId, setExpandedId] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { role } = useAuth();
  // These sit on the page background, where the default skeleton gray is
  // nearly invisible in light mode: a step darker there
  const skeletonTint = darkMode ? null : { backgroundColor: LIGHT_SKELETON_ON_PAGE };

  const runExport = async () => {
    setExporting(true);
    setExportNotice(await log.exportCsv());
    setExporting(false);
  };
  const [searchTerm, setSearchTerm] = useState("");
  const search = useUserSearch(log.byUser && !log.subject ? searchTerm : "");

  /**
   * Built from the server's meta response, not hardcoded. An admin is never
   * offered a category whose actions they cannot see -- an empty "System"
   * filter that can only ever return nothing is worse than no filter.
   */
  const categoryFilters = useMemo(() => {
    const categories = log.meta?.categories || [];
    return [
      { value: null, label: "All activity" },
      ...categories.map((category) => ({
        value: category,
        label: CATEGORY_LABELS[category] || category,
      })),
      { value: BY_USER, label: "By User" },
      // Held copies, superadmin only
      ...(log.viewerRole === "superadmin" ? [{ value: HELD, label: "Held" }] : []),
    ];
  }, [log.meta, log.viewerRole]);

  /** Actions within the chosen category, for the second-level drill-in. Only
   *  shown once a category narrows it to a readable handful. */
  const actionFilters = useMemo(() => {
    if (!log.category || !log.meta?.actions) return [];
    const inCategory = log.meta.actions.filter((entry) => entry.category === log.category);
    if (inCategory.length <= 1) return [];
    return [
      { value: null, label: "All" },
      ...inCategory.map((entry) => ({ value: entry.action, label: entry.label })),
    ];
  }, [log.category, log.meta]);

  const columns = [
    {
      key: "createdAt",
      title: "When",
      width: 132,
      render: (row) => (
        <View>
          <Text style={[styles.whenDate, { color: tone.text }]}>{formatDateOnly(row.createdAt)}</Text>
          <Text style={[styles.whenTime, { color: tone.muted }]}>{formatTimeOnly(row.createdAt)}</Text>
          {/* A held row is kept regardless, so it needs no warning */}
          {!row.held && daysLeft(row.expiresAt) !== null && daysLeft(row.expiresAt) <= EXPIRY_WARNING_DAYS && (
            <Text style={[styles.whenTime, { color: colors.danger }]}>
              Expires in {Math.max(daysLeft(row.expiresAt), 0)}d
            </Text>
          )}
        </View>
      ),
    },
    {
      key: "severity",
      title: "Severity",
      width: 104,
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: "label",
      title: "Action",
      width: 170,
      priority: 2,
      render: (row) => (
        <View>
          <Text numberOfLines={1} style={[styles.actionLabel, { color: tone.text }]}>{row.label}</Text>
          <Text numberOfLines={1} style={[styles.actionKey, { color: tone.muted }]}>{row.action}</Text>
          {(row.held || row.noteCount > 0) && (
            <Text numberOfLines={1} style={[styles.actionKey, { color: tone.text }]}>
              {[row.heldCopy ? "Held copy" : row.held ? "Held" : null, row.noteCount ? `${row.noteCount} note${row.noteCount === 1 ? "" : "s"}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>
      ),
    },
    {
      key: "message",
      title: "What happened",
      flex: 3,
      render: (row) => (
        // Two lines, so a long name doesn't cut the sentence off. The full
        // text and its values are in the drawer
        <Text numberOfLines={2} style={[styles.message, { color: tone.text }]}>{row.message}</Text>
      ),
    },
    {
      key: "ipAddress",
      title: "IP address",
      width: 130,
      priority: 3,
      render: (row) => (
        <Text numberOfLines={1} style={[styles.mono, { color: tone.muted }]}>{row.ipAddress || "—"}</Text>
      ),
    },
  ];

  /**
   * The IP column is dropped entirely for an admin rather than rendered as a
   * column of dashes. A column that is structurally always empty reads as a
   * bug in the table; the banner below says why it is missing instead.
   */
  const visibleColumns = log.redacted
    ? columns.filter((column) => column.key !== "ipAddress")
    : columns;

  const renderExpanded = (row) => (
    <View style={styles.expandedWrap}>
      <Text selectable style={[styles.fullMessage, { color: tone.text }]}>{row.message}</Text>

      {/* The action's own values (reason, counts, filters...), already
          worded by the server. Instants come as type "datetime" and are
          shown in the reader's time zone */}
      {row.fields?.length > 0 && (
        <DetailGrid
          items={row.fields.map((field) => ({
            label: field.label,
            value: field.type === "datetime" ? formatTimestamp(field.value) : field.value,
          }))}
        />
      )}

      <DetailGrid
        items={[
          { label: "Action", value: row.action },
          { label: "Category", value: CATEGORY_LABELS[row.category] || row.category },
          { label: "Severity", value: row.severity },
          { label: "When", value: formatTimestamp(row.createdAt) },
          { label: "Actor", value: row.actor },
          { label: "Actor role", value: actorRoleLabel(row) },
          { label: "Subject", value: row.target },
          { label: "Subject role", value: row.targetRole ? ROLE_LABELS[row.targetRole] || row.targetRole : null },
          { label: "Subject type", value: row.targetType },
          // Present only for a superadmin; DetailGrid drops null entries, so
          // an admin's drawer simply has fewer cells rather than empty ones.
          { label: "Actor ID", value: row.actorId },
          { label: "Subject ID", value: row.targetId },
          { label: "IP address", value: row.ipAddress },
          { label: "Client", value: row.userAgent },
          // The admin fallback: which fields moved, without their values.
          { label: "Fields changed", value: row.changeFields },
        ]}
      />

      {/* Before/after values, superadmin only. A small table rather than a
          sentence, because comparing two values is a scanning task. */}
      {Array.isArray(row.changes) && row.changes.length > 0 && (
        <View style={[styles.changesBox, { borderColor: tone.border }]}>
          <Text style={[styles.changesTitle, { color: tone.muted }]}>CHANGES</Text>
          {row.changes.map((change) => (
            <View key={change.field} style={styles.changeRow}>
              <Text style={[styles.changeField, { color: tone.text }]}>{change.label}</Text>
              {/* Health fields are recorded without values on purpose (HEALTH_FIELDS) */}
              {change.hidden ? (
                <Text style={[styles.changeFrom, styles.changeHidden, { color: tone.muted }]}>Not recorded (health data)</Text>
              ) : (
                <>
                  <Text selectable style={[styles.changeFrom, { color: tone.muted }]}>
                    {String(change.from ?? "empty")}
                  </Text>
                  <Ionicons name="arrow-forward" size={12} color={tone.muted} />
                  <Text selectable style={[styles.changeTo, { color: tone.text }]}>
                    {String(change.to ?? "empty")}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <RowNotesAndHold row={row} log={log} isSuper={log.viewerRole === "superadmin"} tone={tone} />
    </View>
  );

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: tone.muted }]}>ADMINISTRATION</Text>
          <Text style={[styles.pageTitle, { color: tone.text }]}>Audit Logs</Text>
          <Text style={[styles.pageSubtitle, { color: tone.muted }]}>
            An append-only record of what happened, who did it, and when. Open a row for the
            full entry.
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* The session already says who may export; the button waits for the filter menu */}
          {log.firstLoad && role === "superadmin" && <Skeleton width={128} height={38} borderRadius={radii.sm} style={skeletonTint} />}
          {!log.firstLoad && log.viewerRole === "superadmin" && (
            <Pressable
              onPress={runExport}
              disabled={exporting}
              style={[styles.exportBtn, { borderColor: tone.border, backgroundColor: tone.card }, exporting && styles.btnDisabled]}
            >
              <Ionicons name="download-outline" size={16} color={tone.text} />
              <Text style={[styles.exportText, { color: tone.text }]}>{exporting ? "Exporting…" : "Export CSV"}</Text>
            </Pressable>
          )}
          <Pressable onPress={log.refresh} disabled={log.loading} style={[styles.refreshBtn, log.loading && { opacity: 0.6 }]}>
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.refreshText}>{log.loading ? "Loading" : "Refresh"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Exports are recorded in the log too (admin.audit_log.exported) */}
      {exportNotice && (
        <Text style={[styles.exportNotice, { color: exportNotice.ok ? tone.muted : colors.danger }]}>
          {exportNotice.message}
        </Text>
      )}

      {/*Says what is being withheld and why.*/}
      {!log.firstLoad && log.redacted && (
        <View style={[styles.banner, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Ionicons name="eye-off-outline" size={16} color={tone.muted} />
          <Text style={[styles.bannerText, { color: tone.muted }]}>
            Standard Admin View. Extended session data and full audit differentials 
            are restricted to Superadmins.
          </Text>
        </View>
      )}

      <View style={styles.filters}>
        {/* The categories come with the filter menu; until then, pills in their place */}
        {!log.firstLoad ? (
          <FilterRow options={categoryFilters} value={log.category} onChange={log.setCategory} />
        ) : (
          <View style={styles.filterSkeleton}>
            {[88, 52, 70, 62, 78, 84, 70].map((w, i) => <Skeleton key={i} width={w} height={30} borderRadius={radii.pill} style={skeletonTint} />)}
          </View>
        )}
        {log.byUser && (
          <View style={styles.byUserWrap}>
            {log.subject ? (
              <View style={[styles.subjectChip, { borderColor: tone.border, backgroundColor: tone.soft }]}>
                <Ionicons name="person-circle-outline" size={16} color={shellColors.primary} />
                <Text numberOfLines={1} style={[styles.subjectText, { color: tone.text }]}>{log.subject.label}</Text>
                <Pressable
                  hitSlop={8}
                  accessibilityLabel="Clear selected user"
                  onPress={() => {
                    log.setSubject(null);
                    setSearchTerm("");
                  }}
                >
                  <Ionicons name="close" size={16} color={tone.muted} />
                </Pressable>
              </View>
            ) : (
              <View>
                <View style={[styles.searchBox, { borderColor: tone.border }, ring.style]}>
                  <Ionicons name="search" size={15} color={tone.muted} />
                  <TextInput
                    {...ring.handlers}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Search a user by name or email (e.g. juan@example.com)"
                    placeholderTextColor={tone.muted}
                    autoCapitalize="none"
                    style={[ring.input, styles.searchInput, { color: tone.text }]}
                  />
                  {search.searching && <ActivityIndicator size="small" color={shellColors.primary} />}
                </View>
                {/* No name/email match but it's a full user id: search the logs by it
                    anyway, which also covers accounts that have since been deleted */}
                {!search.searching && !search.results.length && USER_ID_RE.test(searchTerm.trim()) && (
                  <View style={[styles.results, { borderColor: tone.border }]}>
                    <Pressable
                      style={[styles.resultRow, { borderBottomColor: tone.border }]}
                      onPress={() => log.setSubject({ id: searchTerm.trim().toLowerCase(), label: searchTerm.trim() })}
                    >
                      <Text numberOfLines={1} style={[styles.resultName, { color: tone.text }]}>
                        User ID {searchTerm.trim()}
                      </Text>
                      <Text numberOfLines={1} style={[styles.resultMeta, { color: tone.muted }]}>
                        No account matches this ID. Show its log entries anyway
                      </Text>
                    </Pressable>
                  </View>
                )}
                {search.results.length > 0 && (
                  <View style={[styles.results, { borderColor: tone.border }]}>
                    {search.results.map((user) => (
                      <Pressable
                        key={user.id}
                        style={[styles.resultRow, { borderBottomColor: tone.border }]}
                        onPress={() => log.setSubject({ id: user.id, label: user.fullName || user.email })}
                      >
                        <Text numberOfLines={1} style={[styles.resultName, { color: tone.text }]}>
                          {user.fullName || user.email}
                        </Text>
                        <Text numberOfLines={1} style={[styles.resultMeta, { color: tone.muted }]}>
                          {user.email} · {ROLE_LABELS[user.role] || user.role}
                          {user.emailVerified ? "" : " (Unverified)"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            <FilterRow options={SUBJECT_MODES} value={log.subjectMode} onChange={log.setSubjectMode} />
          </View>
        )}
        {!log.byUser && actionFilters.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFilterRow}>
            {actionFilters.map((option) => {
              const active = log.action === option.value;
              return (
                <Pressable
                  key={option.value ?? "__all"}
                  onPress={() => log.setAction(option.value)}
                  style={[styles.subFilter, active && { backgroundColor: tone.soft }]}
                >
                  <Text style={[styles.subFilterText, { color: active ? shellColors.primary : tone.muted }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <DataTable
        columns={visibleColumns}
        rows={log.rows}
        keyExtractor={(row) => row.id}
        loading={log.loading}
        error={log.error}
        onRetry={log.refresh}
        emptyTitle={log.byUser && !log.subject ? "Pick a user" : "No activity recorded yet"}
        emptyBody={
          log.byUser && !log.subject
            ? "Search for a user above to see their activity."
            : log.category || log.action
            ? "Nothing matches this filter yet. Clear it to see everything recorded so far."
            : "Audited events will appear here as they happen. Most event types aren't wired up yet — see the integration plan for what's coming and in what order."
        }
        expandedRowId={expandedId}
        onToggleRow={setExpandedId}
        renderExpanded={renderExpanded}
      />

      <Pager
        page={log.pagination.page}
        pageCount={log.pagination.pageCount}
        total={log.pagination.total}
        onChange={log.setPage}
        unit="entries"
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17 },

  filters: { gap: 8, marginBottom: 16 },

  byUserWrap: { gap: 8, maxWidth: 560 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
  results: { borderWidth: 1, borderRadius: radii.sm, marginTop: 6, overflow: "hidden" },
  resultRow: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  resultName: { fontSize: 13, fontWeight: "700" },
  resultMeta: { fontSize: 11, marginTop: 1 },
  subjectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  subjectText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  subFilterRow: { flexDirection: "row", gap: 4 },
  subFilter: { borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  subFilterText: { fontSize: 12, fontWeight: "600" },

  whenDate: { fontSize: 12, fontWeight: "700" },
  whenTime: { fontSize: 11, marginTop: 1 },
  actionLabel: { fontSize: 12, fontWeight: "700" },
  actionKey: { fontSize: 10, marginTop: 1 },
  message: { fontSize: 13, lineHeight: 18 },
  mono: { fontSize: 11 },

  expandedWrap: { gap: 14 },
  fullMessage: { fontSize: 13, lineHeight: 19, fontWeight: "600" },

  changesBox: { borderWidth: 1, borderRadius: radii.sm, padding: 12, gap: 8 },
  changesTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  changeField: { fontSize: 12, fontWeight: "700", minWidth: 90 },
  changeFrom: { fontSize: 12, textDecorationLine: "line-through" },
  changeTo: { fontSize: 12, fontWeight: "600" },

  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: shellColors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  refreshText: { fontSize: 13, fontWeight: "700", color: colors.white },

  // Wraps under the title on a narrow screen instead of squeezing it
  headerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  changeHidden: { textDecorationLine: "none", fontStyle: "italic" },

  notesBox: { borderWidth: 1, borderRadius: radii.sm, padding: 12, gap: 8 },
  note: { gap: 2 },
  noteMeta: { fontSize: 11 },
  noteBody: { fontSize: 13, lineHeight: 18 },
  // Wraps under the input on a narrow screen
  noteForm: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  noteInput: { flexGrow: 1, flexBasis: 220, minWidth: 0, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  smallBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 9 },
  smallBtnText: { fontSize: 12, fontWeight: "700" },
  holdRow: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  exportText: { fontSize: 13, fontWeight: "700" },
  exportNotice: { fontSize: 12, marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  noteSkeleton: { gap: 6 },
  filterSkeleton: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});