import { SeverityBadge } from "@/features/admin/components/Badges";
import DataTable, { DetailGrid, FilterRow, Pager } from "@/features/admin/components/DataTable";
import { useAuditLogs } from "@/features/admin/hooks/useAuditLogs";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { adminStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Server decides which each row and fields different roles see.
// This implementation only tracks (auth.register.consent_accepted, and admin.*) 
// now. audit_logs.createdAt is an instant, a separate concern from the CALENDAR
// DAYS rule established and followed

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

const CATEGORY_LABELS = {
  auth: "Auth",
  account: "Account",
  activity: "Activity",
  nutrition: "Nutrition",
  workout: "Workouts",
  coach: "AI Coach",
  administration: "Administration",
  system: "System",
};

export default function AuditLogsScreen() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const log = useAuditLogs();
  const [expandedId, setExpandedId] = useState(null);

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
    ];
  }, [log.meta]);

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
        </View>
      ),
    },
    {
      key: "message",
      title: "What happened",
      flex: 3,
      render: (row) => (
        // Two lines, not one: the superadmin sentence carries values and an IP
        // and would be truncated to uselessness at one. The full text is in
        // the drawer regardless.
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

      <DetailGrid
        items={[
          { label: "Action", value: row.action },
          { label: "Category", value: CATEGORY_LABELS[row.category] || row.category },
          { label: "Severity", value: row.severity },
          { label: "When", value: formatTimestamp(row.createdAt) },
          { label: "Actor", value: row.actor },
          { label: "Actor role", value: row.actorRole },
          { label: "Subject", value: row.target },
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
              <Text style={[styles.changeField, { color: tone.text }]}>{change.field}</Text>
              <Text selectable style={[styles.changeFrom, { color: tone.muted }]}>
                {String(change.from ?? "empty")}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={tone.muted} />
              <Text selectable style={[styles.changeTo, { color: tone.text }]}>
                {String(change.to ?? "empty")}
              </Text>
            </View>
          ))}
        </View>
      )}
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
        <Pressable onPress={log.refresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {/*Says what is being withheld and why.*/}
      {log.redacted && (
        <View style={[styles.banner, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Ionicons name="eye-off-outline" size={16} color={tone.muted} />
          <Text style={[styles.bannerText, { color: tone.muted }]}>
            Standard Admin View. Extended session data and full audit differentials 
            are restricted to Superadmins.
          </Text>
        </View>
      )}

      <View style={styles.filters}>
        <FilterRow options={categoryFilters} value={log.category} onChange={log.setCategory} />
        {actionFilters.length > 0 && (
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
        emptyTitle="No activity recorded yet"
        emptyBody={
          log.category || log.action
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
});
