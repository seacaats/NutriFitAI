import { SeverityBadge } from "@/features/admin/components/Badges";
import DataTable from "@/features/admin/components/DataTable";
import DetailGrid from "@/features/admin/components/DetailGrid";
import FilterRow from "@/features/admin/components/FilterRow";
import Pager from "@/features/admin/components/Pager";
import RowNotesAndHold from "@/features/admin/components/RowNotesAndHold";
import { BY_USER, HELD, NOTED, useAuditLogs, useUserSearch } from "@/features/admin/hooks/useAuditLogs";
import Skeleton from "@/shared/components/Skeleton";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useFocusRing } from "@/shared/components/ui/FormInput";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { formatClockTime, formatMonthDay, formatTimestamp } from "@/shared/utils/formatDate";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
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

// Warn when an unheld row is within 30 days of TTL expiry so an admin can place a hold if needed.
const EXPIRY_WARNING_DAYS = 30;

// Darker skeleton fill for elements rendered directly on the light-mode page background.
const LIGHT_SKELETON_ON_PAGE = "#dfe3e8";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
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

// "By User" role filter modes ("Self" matches rows where the user acted on their own account).
const SUBJECT_MODES = [
  { value: "all", label: "All" },
  { value: "actor", label: "As Actor" },
  { value: "target", label: "As Target" },
  { value: "self", label: "Self" },
];

const ROLE_LABELS = { user: "User", admin: "Admin" };

// Full UUID pattern allowing direct log lookup by user ID even after account deletion.
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const skeletonTint = darkMode ? null : { backgroundColor: LIGHT_SKELETON_ON_PAGE };

  const runExport = async () => {
    setExporting(true);
    setExportNotice(await log.exportCsv());
    setExporting(false);
  };
  const [searchTerm, setSearchTerm] = useState("");
  const search = useUserSearch(log.byUser && !log.subject ? searchTerm : "");

  // Build category pills from server metadata so only categories visible to the current role appear.
  const categoryFilters = useMemo(() => {
    const categories = log.meta?.categories || [];
    return [
      { value: null, label: "All activity" },
      ...categories.map((category) => ({
        value: category,
        label: CATEGORY_LABELS[category] || category,
      })),
      { value: BY_USER, label: "By User" },
      { value: NOTED, label: "Noted" },
      { value: HELD, label: "Held" },
    ];
  }, [log.meta]);

  // Second-level action filters within the selected category.
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
          <Text style={[styles.whenDate, { color: tone.text }]}>{formatMonthDay(row.createdAt)}</Text>
          <Text style={[styles.whenTime, { color: tone.muted }]}>{formatClockTime(row.createdAt)}</Text>
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

  const renderExpanded = (row) => (
    <View style={styles.expandedWrap}>
      <Text selectable style={[styles.fullMessage, { color: tone.text }]}>{row.message}</Text>

      {/* Action-specific metadata fields formatted by the server */}
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
          { label: "Actor ID", value: row.actorId },
          { label: "Subject ID", value: row.targetId },
          { label: "IP address", value: row.ipAddress },
          { label: "Client", value: row.userAgent },
        ]}
      />

      {/* Before/after field diff table */}
      {Array.isArray(row.changes) && row.changes.length > 0 && (
        <View style={[styles.changesBox, { borderColor: tone.border }]}>
          <Text style={[styles.changesTitle, { color: tone.muted }]}>CHANGES</Text>
          {row.changes.map((change) => (
            <View key={change.field} style={styles.changeRow}>
              <Text style={[styles.changeField, { color: tone.text }]}>{change.label}</Text>
              {/* Health fields omit raw values in audit logs */}
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

      <RowNotesAndHold row={row} log={log} tone={tone} />
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
          {log.firstLoad && <Skeleton width={128} height={38} borderRadius={radii.sm} style={skeletonTint} />}
          {!log.firstLoad && (
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

      {exportNotice && (
        <Text style={[styles.exportNotice, { color: exportNotice.ok ? tone.muted : colors.danger }]}>
          {exportNotice.message}
        </Text>
      )}

      <View style={styles.filters}>
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
                    maxLength={120}
                    onChangeText={setSearchTerm}
                    placeholder="Search a user by name or email (e.g. juan@example.com)"
                    placeholderTextColor={tone.muted}
                    autoCapitalize="none"
                    style={[ring.input, styles.searchInput, { color: tone.text }]}
                  />
                  {search.searching && <ActivityIndicator size="small" color={shellColors.primary} />}
                </View>
                {/* Allow direct UUID lookup when no live account matches (e.g. deleted users) */}
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
        columns={columns}
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

  headerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  changeHidden: { textDecorationLine: "none", fontStyle: "italic" },

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
  filterSkeleton: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
