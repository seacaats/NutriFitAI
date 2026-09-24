import { RoleBadge } from "@/features/admin/components/Badges";
import DataTable, { DetailGrid, FilterRow, Pager } from "@/features/admin/components/DataTable";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { adminStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

/**
 * Users management -- the directory every admin and superadmin sees.
 *
 * One file rather than an index.jsx / index.web.jsx pair (DataTable.jsx). There is no
 * platform-specific data source here and no divergent design, only a
 * width-dependent column count, so a split would create exactly the
 * hand-synced duplicate that screenStyles.js exists to undo.
 *
 * WHAT A SUPERADMIN SEES THAT AN ADMIN DOES NOT: the role column is
 * actionable. Promotion and demotion go through PATCH
 * /admin/users/:id/role, which is superadmin-only server-side -- this screen
 * hides the control for an admin as a courtesy, not as the enforcement.
 */

const ROLE_FILTERS = [
  { value: null, label: "Everyone" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
  { value: "superadmin", label: "Superadmins" },
];

/**
 * Dates render through toLocaleDateString rather than being sliced from an
 * ISO string.
 *
 * Not a violation of this project's date rule, which is about CALENDAR DAYS
 * (steps, goals) that must stay YYYY-MM-DD strings so no timezone can shift
 * them. createdAt is a genuine instant stored as a BSON Date, and an instant
 * is SUPPOSED to be displayed in the reader's local timezone -- the admin in
 * Manila should see Manila time.
 */
function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatCard({ label, value, tone }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
      <Text style={[styles.statLabel, { color: tone.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tone.text }]}>{value}</Text>
    </View>
  );
}

export default function AdminUsersScreen() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const { user, hasRole } = useAuth();
  const canChangeRoles = hasRole("superadmin");

  const users = useAdminUsers();
  const [expandedId, setExpandedId] = useState(null);
  const [notice, setNotice] = useState(null);

  /**
   * A role change is irreversible-ish and high-consequence, so it is a
   * two-step interaction: pick the new role, then confirm with a reason. The
   * reason is REQUIRED by the API (adminValidators) rather than optional --
   * it is the one part of the audit entry nothing else can reconstruct later
   */
  const [pendingChange, setPendingChange] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitRoleChange = async () => {
    if (!pendingChange || reason.trim().length < 3) return;
    setSubmitting(true);
    const result = await users.changeRole(pendingChange.id, pendingChange.nextRole, reason.trim());
    setSubmitting(false);
    setNotice({ ok: result.ok, message: result.message });
    if (result.ok) {
      setPendingChange(null);
      setReason("");
    }
  };

  const columns = [
    {
      key: "fullName",
      title: "Name",
      flex: 2,
      render: (row) => (
        <View>
          <Text numberOfLines={1} style={[styles.primaryCell, { color: tone.text }]}>
            {row.fullName || "—"}
            {row.id === user?.id ? "  (you)" : ""}
          </Text>
          {/* The email rides under the name below 1100px */}
          {width < 1100 && (
            <Text numberOfLines={1} style={[styles.subCell, { color: tone.muted }]}>{row.email}</Text>
          )}
        </View>
      ),
    },
    { key: "email", title: "Email", flex: 3, priority: 2 },
    { key: "role", title: "Role", width: 120, render: (row) => <RoleBadge role={row.role} /> },
    {
      key: "emailVerified",
      title: "Verified",
      width: 90,
      priority: 3,
      render: (row) => (
        <Ionicons
          name={row.emailVerified ? "checkmark-circle" : "ellipse-outline"}
          size={17}
          color={row.emailVerified ? colors.green600 : tone.muted}

          accessibilityLabel={row.emailVerified ? "Email verified" : "Email not verified"}
        />
      ),
    },
    {
      key: "createdAt",
      title: "Joined",
      width: 120,
      priority: 2,
      render: (row) => <Text style={[styles.bodyCell, { color: tone.muted }]}>{formatWhen(row.createdAt)}</Text>,
    },
  ];

  const renderExpanded = (row) => {
    // A superadmin may not change their OWN role (the API refuses it too --
    // privilege should only ever flow from another account, so there is
    // always a second party in the audit trail)
    const isSelf = row.id === user?.id;
    const roleOptions = ["user", "admin", "superadmin"].filter((r) => r !== row.role);

    return (
      <View style={styles.expandedWrap}>
        <DetailGrid
          items={[
            { label: "User ID", value: row.id },
            { label: "Email", value: row.email },
            { label: "Role", value: row.role },
            { label: "Email verified", value: row.emailVerified ? "Yes" : "No" },
            ...(row.role === "user"
              ? [{ label: "Terms accepted", value: formatWhen(row.termsAcceptedAt) }]
              : []),
            { label: "Joined", value: formatWhen(row.createdAt) },
          ]}
        />

        {canChangeRoles && !isSelf && (
          <View style={[styles.roleActions, { borderTopColor: tone.border }]}>
            <Text style={[styles.roleActionsLabel, { color: tone.muted }]}>Change role to</Text>
            <View style={styles.roleBtnRow}>
              {roleOptions.map((nextRole) => (
                <Pressable
                  key={nextRole}
                  onPress={() => {
                    setPendingChange({ id: row.id, name: row.fullName || row.email, from: row.role, nextRole });
                    setReason("");
                    setNotice(null);
                  }}
                  style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
                >
                  <Text style={[styles.roleBtnText, { color: tone.text }]}>{nextRole}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {canChangeRoles && isSelf && (
          <Text style={[styles.selfNote, { color: tone.muted }]}>
            You can&apos;t change your own role. Ask another superadmin.
          </Text>
        )}
      </View>
    );
  };

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: tone.muted }]}>ADMINISTRATION</Text>
          <Text style={[styles.pageTitle, { color: tone.text }]}>Users</Text>
          <Text style={[styles.pageSubtitle, { color: tone.muted }]}>
            Everyone with a NutriFit AI account. Open a row for the full record.
          </Text>
        </View>
        <Pressable onPress={users.refresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {users.counts && (
        <View style={styles.statRow}>
          <StatCard label="TOTAL ACCOUNTS" value={users.counts.total} tone={tone} />
          <StatCard label="USERS" value={users.counts.user} tone={tone} />
          <StatCard label="ADMINS" value={users.counts.admin} tone={tone} />
          <StatCard label="SUPERADMINS" value={users.counts.superadmin} tone={tone} />
        </View>
      )}

      <View style={[styles.controls, narrow && styles.controlsNarrow]}>
        <View style={[styles.searchBox, { backgroundColor: tone.card, borderColor: tone.border }]}>
          <Ionicons name="search" size={16} color={tone.muted} />
          <TextInput
            value={users.search}
            onChangeText={users.setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={tone.muted}
            style={[styles.searchInput, { color: tone.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {users.search.length > 0 && (
            <Pressable onPress={() => users.setSearch("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={tone.muted} />
            </Pressable>
          )}
        </View>
        <FilterRow options={ROLE_FILTERS} value={users.roleFilter} onChange={users.setRoleFilter} />
      </View>

      {notice && (
        <View
          style={[
            styles.notice,
            { backgroundColor: notice.ok ? tone.soft : colors.dangerBg, borderColor: notice.ok ? tone.border : colors.danger },
          ]}
        >
          <Ionicons
            name={notice.ok ? "checkmark-circle-outline" : "alert-circle-outline"}
            size={16}
            color={notice.ok ? colors.green600 : colors.danger}
          />
          <Text style={[styles.noticeText, { color: notice.ok ? tone.text : colors.danger }]}>{notice.message}</Text>
          <Pressable onPress={() => setNotice(null)} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={15} color={tone.muted} />
          </Pressable>
        </View>
      )}

      {/* The confirm step */}
      {pendingChange && (
        <View style={[styles.confirmCard, { backgroundColor: tone.card, borderColor: colors.danger }]}>
          <Text style={[styles.confirmTitle, { color: tone.text }]}>
            Change {pendingChange.name} from {pendingChange.from} to {pendingChange.nextRole}?
          </Text>
          <Text style={[styles.confirmBody, { color: tone.muted }]}>
            This is recorded in the audit log with your name, the time, and the reason below.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            placeholderTextColor={tone.muted}
            style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
            multiline
          />
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => { setPendingChange(null); setReason(""); }}
              style={[styles.secondaryBtn, { borderColor: tone.border }]}
            >
              <Text style={[styles.secondaryBtnText, { color: tone.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submitRoleChange}
              disabled={submitting || reason.trim().length < 3}
              style={[styles.dangerBtn, (submitting || reason.trim().length < 3) && styles.btnDisabled]}
            >
              <Text style={styles.dangerBtnText}>{submitting ? "Saving…" : "Confirm change"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <DataTable
        columns={columns}
        rows={users.rows}
        keyExtractor={(row) => row.id}
        loading={users.loading}
        error={users.error}
        onRetry={users.refresh}
        emptyTitle={users.search ? "No matching accounts" : "No accounts yet"}
        emptyBody={
          users.search
            ? `Nothing matches "${users.search}". Try a shorter search.`
            : "Registered accounts will appear here."
        }
        expandedRowId={expandedId}
        onToggleRow={setExpandedId}
        renderExpanded={renderExpanded}
      />

      <Pager
        page={users.pagination.page}
        pageCount={users.pagination.pageCount}
        total={users.pagination.total}
        onChange={users.setPage}
        unit="accounts"
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  statCard: { flex: 1, minWidth: 150, borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 4 },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  statValue: { fontSize: 24, fontWeight: "800" },

  primaryCell: { fontSize: 13, fontWeight: "700" },
  subCell: { fontSize: 11, marginTop: 1 },
  bodyCell: { fontSize: 12 },

  expandedWrap: { gap: 14 },
  roleActions: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  roleActionsLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  roleBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 8 },
  roleBtnText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  selfNote: { fontSize: 12, fontStyle: "italic" },

  confirmCard: { borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 10, marginBottom: 16 },
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
