import DataTable from "@/features/admin/components/DataTable";
import DetailGrid from "@/features/admin/components/DetailGrid";
import FilterDropdowns from "@/features/admin/components/FilterDropdowns";
import FilterRow from "@/features/admin/components/FilterRow";
import Pager from "@/features/admin/components/Pager";
import StatCard from "@/features/admin/components/StatCard";
import { useAdminImageReviews } from "@/features/admin/hooks/useAdminImageReviews";
import { useUserSearch } from "@/features/admin/hooks/useAuditLogs";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import { useTheme } from "@/shared/context/ThemeContext";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { formatTimestamp } from "@/shared/utils/formatDate";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

/**
 * Admin moderation queue for uploads not cleared by automated checks.
 * - Needs review: flagged photos awaiting an admin decision (each view is audited).
 * - Blocked: rejected at upload; file was not stored, kept as a record only.
 * - Unchecked: moderation provider was unreachable; retried automatically.
 */

const TABS = [
  { value: "review", label: "Needs review" },
  { value: "blocked", label: "Blocked" },
  { value: "unchecked", label: "Unchecked" },
];

const KIND_FILTERS = [
  { value: null, label: "All photos" },
  { value: "avatar", label: "Profile photo" },
  { value: "scan", label: "Food scan" },
  { value: "workout", label: "Workout photo" },
];
const CATEGORY_FILTERS = [
  { value: null, label: "All categories" },
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "violence/graphic", label: "Graphic violence" },
  { value: "self-harm", label: "Self-harm" },
  { value: "self-harm/intent", label: "Self-harm intent" },
  { value: "self-harm/instructions", label: "Self-harm instructions" },
];
const WHEN_FILTERS = [
  { value: null, label: "Any time" },
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
];
const WHO_FILTERS = [
  { value: false, label: "All users" },
  { value: true, label: "Repeat blocks only" },
];

const KIND_LABEL = { avatar: "Profile photo", scan: "Food scan", workout: "Workout photo" };
const CATEGORY_LABEL = {
  sexual: "Sexual content",
  violence: "Violence",
  "violence/graphic": "Graphic violence",
  "self-harm": "Self-harm",
  "self-harm/intent": "Self-harm intent",
  "self-harm/instructions": "Self-harm instructions",
};
const label = (value) => CATEGORY_LABEL[value] || String(value || "").replace(/[_/]/g, " ");
const confidence = (score) => (score == null ? "—" : `${Math.round(score * 100)}%`);

// Confirmation modal copy per moderation decision (both require an audit reason).
const ACTION_COPY = {
  approve: { title: "Approve this photo?", body: "The photo stays and the flag clears.", button: "Approve" },
  remove: { title: "Remove this photo?", body: "The file is deleted and the user is told an admin removed it.", button: "Remove photo" },
};

// Loads the flagged photo on demand; each request records an audit log entry.
function Photo({ id, viewUrl, tone }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const show = async () => {
    setLoading(true);
    setError(null);
    try {
      setUrl(resolveMediaUrl(await viewUrl(id)));
    } catch (err) {
      setError(err?.message || "Couldn't load the photo.");
    } finally {
      setLoading(false);
    }
  };

  if (url) return <Image source={{ uri: url }} resizeMode="contain" style={[styles.photo, { backgroundColor: tone.soft }]} />;
  return (
    <View style={styles.roleBtnRow}>
      <Pressable onPress={show} disabled={loading} style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}>
        <Text style={[styles.roleBtnText, { color: tone.text }]}>{loading ? "Loading…" : "View photo"}</Text>
      </Pressable>
      {error && <Text style={[styles.subCell, { color: colors.danger, alignSelf: "center" }]}>{error}</Text>}
    </View>
  );
}

export default function AdminImageReviewsScreen() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const reviews = useAdminImageReviews();
  const ring = useFocusRing();
  const [searchTerm, setSearchTerm] = useState("");
  const search = useUserSearch(reviews.filters.subject ? "" : searchTerm);
  const filter = (key, value) => { setExpandedId(null); reviews.setFilter(key, value); };
  const router = useRouter();
  const [expandedId, setExpandedId] = useState(null);
  const [pendingChange, setPendingChange] = useState(null); // { kind, id }
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const startAction = (kind, row) => {
    setExpandedId(row.id);
    setPendingChange({ kind, id: row.id });
    setReason("");
    setNotice(null);
  };

  const submitAction = async () => {
    if (!pendingChange) return;
    const { kind, id } = pendingChange;
    setSubmitting(true);
    const why = reason.trim();
    const result = kind === "approve" ? await reviews.approve(id, why) : await reviews.remove(id, why);
    setSubmitting(false);
    setNotice({ id, ...result });
    if (result.ok) {
      setPendingChange(null);
      setReason("");
      setExpandedId(null);
    }
  };

  const canSubmit = reason.trim().length >= 3;

  // Extract primitive IDs for safe comparison inside row drawer closures.
  const pendingId = pendingChange ? pendingChange.id : null;
  const noticeId = notice ? notice.id : null;

  const columns = [
    {
      key: "user",
      title: "User",
      flex: 3,
      render: (row) => (
        <View>
          <Text numberOfLines={1} style={[styles.primaryCell, { color: tone.text }]}>{row.user.name || "Deleted account"}</Text>
          {row.user.email && <Text numberOfLines={1} style={[styles.subCell, { color: tone.muted }]}>{row.user.email}</Text>}
          {row.repeatOffender && <Text style={[styles.subCell, { color: colors.danger, fontWeight: "700" }]}>Repeat blocks · {row.recentBlocks} recently</Text>}
        </View>
      ),
    },
    {
      key: "kind",
      title: "Photo",
      width: 130,
      render: (row) => <Text style={[styles.bodyCell, { color: tone.text }]}>{KIND_LABEL[row.kind] || row.kind}</Text>,
    },
    {
      key: "flagged",
      title: "Flagged for",
      flex: 3,
      priority: 2,
      render: (row) => (
        <View style={styles.chipRow}>
          {(row.flagged.length ? row.flagged : [row.topCategory].filter(Boolean)).map((c) => (
            <View key={c} style={[styles.chip, { borderColor: tone.border, backgroundColor: tone.soft }]}>
              <Text style={[styles.chipText, { color: tone.text }]}>{label(c)}</Text>
            </View>
          ))}
          {row.status === "unchecked" && <Text style={[styles.bodyCell, { color: tone.muted }]}>Not checked</Text>}
        </View>
      ),
    },
    {
      key: "topScore",
      title: "Confidence",
      width: 100,
      priority: 2,
      render: (row) => <Text style={[styles.bodyCell, { color: tone.muted }]}>{confidence(row.topScore)}</Text>,
    },
    {
      key: "createdAt",
      title: "When",
      width: 170,
      priority: 3,
      render: (row) => <Text style={[styles.bodyCell, { color: tone.muted }]}>{formatTimestamp(row.createdAt)}</Text>,
    },
  ];

  const noticeNode = notice && (
    <View style={[styles.notice, { backgroundColor: notice.ok ? tone.soft : colors.dangerBg, borderColor: notice.ok ? tone.border : colors.danger }]}>
      <Ionicons name={notice.ok ? "checkmark-circle-outline" : "alert-circle-outline"} size={16} color={notice.ok ? colors.green600 : colors.danger} />
      <Text style={[styles.noticeText, { color: notice.ok ? tone.text : colors.danger }]}>{notice.message}</Text>
      <Pressable onPress={() => setNotice(null)} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={15} color={tone.muted} />
      </Pressable>
    </View>
  );

  const confirmNode = pendingChange && (
    <View style={[styles.confirmCard, { backgroundColor: tone.card, borderColor: colors.danger }]}>
      <Text style={[styles.confirmTitle, { color: tone.text }]}>{ACTION_COPY[pendingChange.kind].title}</Text>
      <Text style={[styles.confirmBody, { color: tone.muted }]}>
        {ACTION_COPY[pendingChange.kind].body} This is recorded in the audit log with your name, the time, and the reason below.
      </Text>
      <RingInput
        value={reason}
        onChangeText={setReason}
        autoFocus
        placeholder="Reason (required)"
        maxLength={300}
        placeholderTextColor={tone.muted}
        style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
        multiline
      />
      <View style={styles.confirmActions}>
        <Pressable onPress={() => { setPendingChange(null); setReason(""); }} style={[styles.secondaryBtn, { borderColor: tone.border }]}>
          <Text style={[styles.secondaryBtnText, { color: tone.text }]}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submitAction} disabled={submitting || !canSubmit} style={[styles.dangerBtn, (submitting || !canSubmit) && styles.btnDisabled]}>
          <Text style={styles.dangerBtnText}>{submitting ? "Saving…" : ACTION_COPY[pendingChange.kind].button}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderExpanded = (row) => (
    <View style={styles.expandedWrap}>
      <DetailGrid
        items={[
          { label: "Photo", value: KIND_LABEL[row.kind] || row.kind },
          { label: "User", value: row.user.name || "Deleted account" },
          { label: "Flagged for", value: row.flagged.length ? row.flagged.map(label).join(", ") : label(row.topCategory) || "—" },
          { label: "Confidence", value: confidence(row.topScore) },
          { label: "When", value: formatTimestamp(row.createdAt) },
          ...(row.repeatOffender ? [{ label: "Blocked recently", value: `${row.recentBlocks} photos` }] : []),
        ]}
      />
      {row.user.email && (
        <View style={styles.roleBtnRow}>
          <Pressable
            onPress={() => router.push({ pathname: "/users", params: { search: row.user.email } })}
            style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
          >
            <Text style={[styles.roleBtnText, { color: tone.text }]}>Open user</Text>
          </Pressable>
        </View>
      )}

      {row.canView ? (
        <>
          <Photo id={row.id} viewUrl={reviews.viewUrl} tone={tone} />
          <View style={[styles.roleActions, { borderTopColor: tone.border }]}>
            <Text style={[styles.roleActionsLabel, { color: tone.muted }]}>Decision</Text>
            <View style={styles.roleBtnRow}>
              <Pressable onPress={() => startAction("approve", row)} style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}>
                <Text style={[styles.roleBtnText, { color: tone.text }]}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => startAction("remove", row)} style={[styles.roleBtn, { borderColor: colors.danger, backgroundColor: tone.card }]}>
                <Text style={[styles.roleBtnText, { color: colors.danger }]}>Remove image</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <Text style={[styles.bodyCell, { color: tone.muted }]}>
          {row.status === "blocked"
            ? "Refused at upload. The photo was never kept, so this is only a record."
            : "The check couldn't run for this photo, so it can't be opened. It is checked again automatically, and moves to Needs review if flagged."}
        </Text>
      )}

      {pendingId === row.id && confirmNode}
      {noticeId === row.id && noticeNode}
    </View>
  );

  // Render notice at top of page when the associated row is no longer in the current table view.
  const noticeRowListed = reviews.rows.some((r) => r.id === noticeId);

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: tone.muted }]}>ADMINISTRATION</Text>
          <Text style={[styles.pageTitle, { color: tone.text }]}>Image Review</Text>
          <Text style={[styles.pageSubtitle, { color: tone.muted }]}>
            Photos the automatic check didn't clear. Only flagged photos can be opened, and each view is logged.
          </Text>
        </View>
        <Pressable onPress={reviews.refresh} disabled={reviews.loading} style={[styles.refreshBtn, reviews.loading && { opacity: 0.6 }]}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>{reviews.loading ? "Loading" : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <StatCard label="NEEDS REVIEW" value={reviews.counts?.review} tone={tone} />
        <StatCard label="BLOCKED" value={reviews.counts?.blocked} tone={tone} />
        <StatCard label="UNCHECKED" value={reviews.counts?.unchecked} tone={tone} />
        <StatCard label="REPEAT BLOCKS" value={reviews.counts?.repeatBlockers} tone={tone} />
      </View>

      <View style={[styles.controls, narrow && styles.controlsNarrow]}>
        <FilterRow options={TABS} value={reviews.tab} onChange={(value) => { setExpandedId(null); reviews.setTab(value); }} />
      </View>

      <View style={styles.filters}>
        <FilterDropdowns
          filters={[
            { key: "kind", label: "Photo type", options: KIND_FILTERS, value: reviews.filters.kind },
            { key: "category", label: "Category", options: CATEGORY_FILTERS, value: reviews.filters.category },
            { key: "days", label: "When", options: WHEN_FILTERS, value: reviews.filters.days },
            { key: "repeat", label: "Users", options: WHO_FILTERS, value: reviews.filters.repeat },
          ]}
          onChange={filter}
          onClear={() => { setExpandedId(null); setSearchTerm(""); reviews.clearFilters(); }}
        >
          {reviews.filters.subject ? (
            <View style={[styles.subjectChip, { borderColor: tone.border, backgroundColor: tone.soft }]}>
              <Ionicons name="person-circle-outline" size={16} color={shellColors.primary} />
              <Text numberOfLines={1} style={[styles.subjectText, { color: tone.text }]}>{reviews.filters.subject.label}</Text>
              <Pressable hitSlop={8} accessibilityLabel="Clear selected user" onPress={() => { filter("subject", null); setSearchTerm(""); }}>
                <Ionicons name="close" size={16} color={tone.muted} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.byUserWrap}>
              <View style={[styles.searchBox, { borderColor: tone.border }, ring.style]}>
                <Ionicons name="search" size={15} color={tone.muted} />
                <TextInput
                  {...ring.handlers}
                  value={searchTerm}
                  maxLength={120}
                  onChangeText={setSearchTerm}
                  placeholder="Find a user by name or email"
                  placeholderTextColor={tone.muted}
                  autoCapitalize="none"
                  style={[ring.input, styles.searchInput, { color: tone.text }]}
                />
                {search.searching && <ActivityIndicator size="small" color={shellColors.primary} />}
              </View>
              {search.results.length > 0 && (
                <View style={[styles.results, { borderColor: tone.border }]}>
                  {search.results.map((user) => (
                    <Pressable
                      key={user.id}
                      style={[styles.resultRow, { borderBottomColor: tone.border }]}
                      onPress={() => { filter("subject", { id: user.id, label: user.fullName || user.email }); setSearchTerm(""); }}
                    >
                      <Text numberOfLines={1} style={[styles.resultName, { color: tone.text }]}>{user.fullName || user.email}</Text>
                      <Text numberOfLines={1} style={[styles.resultMeta, { color: tone.muted }]}>{user.email}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </FilterDropdowns>
      </View>

      {notice && !noticeRowListed && noticeNode}

      <DataTable
        columns={columns}
        rows={reviews.rows}
        keyExtractor={(row) => row.id}
        loading={reviews.loading}
        error={reviews.error}
        onRetry={reviews.refresh}
        emptyTitle="Nothing here"
        emptyBody={reviews.hasFilters ? "No photos match these filters." : reviews.tab === "review" ? "No photos are waiting for a decision." : "No photos in this list."}
        expandedRowId={expandedId}
        onToggleRow={setExpandedId}
        renderExpanded={renderExpanded}
      />

      <Pager page={reviews.pagination.page} pageCount={reviews.pagination.pageCount} total={reviews.pagination.total} onChange={reviews.setPage} unit="photos" />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  filters: { marginBottom: 16 },
  byUserWrap: { width: 300, maxWidth: "100%" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 13, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
  results: { borderWidth: 1, borderRadius: radii.sm, marginTop: 6, overflow: "hidden" },
  resultRow: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  resultName: { fontSize: 13, fontWeight: "700" },
  resultMeta: { fontSize: 11, marginTop: 1 },
  subjectChip: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, height: 40, maxWidth: "100%" },
  subjectText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },

  primaryCell: { fontSize: 13, fontWeight: "700" },
  subCell: { fontSize: 11, marginTop: 1 },
  bodyCell: { fontSize: 12 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  expandedWrap: { gap: 14 },
  photo: { width: "100%", maxWidth: 420, height: 320, borderRadius: radii.md },
  roleActions: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  roleActionsLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  roleBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 8 },
  roleBtnText: { fontSize: 12, fontWeight: "700" },

  confirmCard: { borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 10 },
  confirmTitle: { fontSize: 15, fontWeight: "700" },
  confirmBody: { fontSize: 12, lineHeight: 18 },
  reasonInput: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 64, textAlignVertical: "top" },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  secondaryBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, fontWeight: "700" },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 10 },
  dangerBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  btnDisabled: { opacity: 0.5 },

  refreshBtn: {
    alignSelf: "flex-start",
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
