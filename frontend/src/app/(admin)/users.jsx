import { RoleBadge } from "@/features/admin/components/Badges";
import DataTable, { DetailGrid, FilterRow, Pager } from "@/features/admin/components/DataTable";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import Skeleton from "@/shared/components/Skeleton";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import { ROLES, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
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

// Confirm-card copy per action. Every action needs a reason (adminValidators)
const ACTION_COPY = {
  role: { button: "Confirm change" },
  rename: { title: (p) => `Rename ${p.name}?`, button: "Save name" },
  suspend: { title: (p) => `Suspend ${p.name}?`, body: "They are signed out within 15 minutes and can't sign in until reinstated.", button: "Suspend" },
  reinstate: { title: (p) => `Reinstate ${p.name}?`, body: "They can sign in again right away.", button: "Reinstate" },
  reset: { title: (p) => `Require a password reset for ${p.name}?`, body: "Sign-in is refused until they set a new password through Forgot password.", button: "Require reset" },
  cancelReset: { title: (p) => `Cancel the password reset for ${p.name}?`, body: "Their current password works again right away.", button: "Cancel reset" },
  delete: { title: (p) => `Permanently delete ${p.name}?`, body: "Their account and all of their data are removed. This can't be undone.", button: "Delete account" },
};

// `value` null while the counts load: the card renders with a placeholder
function StatCard({ label, value, tone }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
      <Text style={[styles.statLabel, { color: tone.muted }]}>{label}</Text>
      {value == null ? <Skeleton width={56} height={26} /> : <Text style={[styles.statValue, { color: tone.text }]}>{value}</Text>}
    </View>
  );
}

export default function AdminUsersScreen() {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const { user, hasRole, role: myRole } = useAuth();
  const canChangeRoles = hasRole("superadmin");
  const canDelete = hasRole("superadmin");

  // Mirrors loadManageableTarget: never yourself, only a strictly lower role.
  // A courtesy, the server enforces it
  const canManage = (row) => row.id !== user?.id && ROLES.indexOf(myRole) > ROLES.indexOf(row.role);

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

  // A rename also needs a first name, the API rejects an empty one
  const canSubmit = reason.trim().length >= 3
    && !(pendingChange?.kind === "rename" && !pendingChange.firstName.trim());

  const startAction = (kind, row, extra = {}) => {
    setPendingChange({ kind, id: row.id, name: row.fullName || row.email, ...extra });
    setReason("");
    setNotice(null);
  };

  const submitRoleChange = async () => {
    if (!pendingChange || !canSubmit) return;
    setSubmitting(true);
    const { kind, id } = pendingChange;
    const why = reason.trim();
    let result;
    if (kind === "rename") {
      result = await users.updateName(id, { firstName: pendingChange.firstName.trim(), lastName: pendingChange.lastName.trim() || null }, why);
    } else if (kind === "suspend") result = await users.suspend(id, why);
    else if (kind === "reinstate") result = await users.reinstate(id, why);
    else if (kind === "reset") result = await users.forcePasswordReset(id, why);
    else if (kind === "cancelReset") result = await users.cancelPasswordReset(id, why);
    else if (kind === "delete") result = await users.deleteUser(id, why);
    else result = await users.changeRole(id, pendingChange.nextRole, why);
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
          {row.suspendedAt && <Text style={[styles.subCell, { color: colors.danger }]}>Suspended</Text>}
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
            ...(row.suspendedAt
              ? [{ label: "Suspended", value: `${formatWhen(row.suspendedAt)} — ${row.suspendedReason || "no reason"}` }]
              : []),
            ...(row.passwordResetRequired ? [{ label: "Password reset", value: "Required at next sign-in" }] : []),
          ]}
        />

        {canManage(row) && (
          <View style={[styles.roleActions, { borderTopColor: tone.border }]}>
            <Text style={[styles.roleActionsLabel, { color: tone.muted }]}>Account actions</Text>
            <View style={styles.roleBtnRow}>
              <Pressable
                onPress={() => startAction("rename", row, { firstName: row.firstName || "", lastName: row.lastName || "" })}
                style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
              >
                <Text style={[styles.roleBtnText, { color: tone.text }]}>Edit name</Text>
              </Pressable>
              <Pressable
                onPress={() => startAction(row.suspendedAt ? "reinstate" : "suspend", row)}
                style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
              >
                <Text style={[styles.roleBtnText, { color: tone.text }]}>{row.suspendedAt ? "Reinstate" : "Suspend"}</Text>
              </Pressable>
              {/* One button that flips, like Suspend / Reinstate */}
              <Pressable
                onPress={() => startAction(row.passwordResetRequired ? "cancelReset" : "reset", row)}
                style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
              >
                <Text style={[styles.roleBtnText, { color: tone.text }]}>
                  {row.passwordResetRequired ? "Cancel password reset" : "Require password reset"}
                </Text>
              </Pressable>
              {canDelete && (
                <Pressable
                  onPress={() => startAction("delete", row)}
                  style={[styles.roleBtn, { borderColor: colors.danger, backgroundColor: tone.card }]}
                >
                  <Text style={[styles.roleBtnText, { color: colors.danger }]}>Delete account</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {canChangeRoles && !isSelf && (
          <View style={[styles.roleActions, { borderTopColor: tone.border }]}>
            <Text style={[styles.roleActionsLabel, { color: tone.muted }]}>Change role to</Text>
            <View style={styles.roleBtnRow}>
              {roleOptions.map((nextRole) => (
                <Pressable
                  key={nextRole}
                  onPress={() => startAction("role", row, { from: row.role, nextRole })}
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
            Everyone with a NutriFitAI account. Open a row for the full record.
          </Text>
        </View>
        <Pressable onPress={users.refresh} disabled={users.loading} style={[styles.refreshBtn, users.loading && { opacity: 0.6 }]}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>{users.loading ? "Loading" : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <StatCard label="TOTAL ACCOUNTS" value={users.counts?.total} tone={tone} />
        <StatCard label="USERS" value={users.counts?.user} tone={tone} />
        <StatCard label="ADMINS" value={users.counts?.admin} tone={tone} />
        <StatCard label="SUPERADMINS" value={users.counts?.superadmin} tone={tone} />
      </View>

      <View style={[styles.controls, narrow && styles.controlsNarrow]}>
        <View style={[styles.searchBox, { backgroundColor: tone.card, borderColor: tone.border }, ring.style]}>
          <Ionicons name="search" size={16} color={tone.muted} />
          <TextInput
            {...ring.handlers}
            value={users.search}
            onChangeText={users.setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={tone.muted}
            style={[ring.input, styles.searchInput, { color: tone.text }]}
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
            {pendingChange.kind === "role"
              ? `Change ${pendingChange.name} from ${pendingChange.from} to ${pendingChange.nextRole}?`
              : ACTION_COPY[pendingChange.kind].title(pendingChange)}
          </Text>
          <Text style={[styles.confirmBody, { color: tone.muted }]}>
            {ACTION_COPY[pendingChange.kind].body ? `${ACTION_COPY[pendingChange.kind].body} ` : ""}
            This is recorded in the audit log with your name, the time, and the reason below.
          </Text>
          {pendingChange.kind === "rename" && (
            <View style={styles.nameRow}>
              <RingInput
                value={pendingChange.firstName}
                onChangeText={(firstName) => setPendingChange((p) => ({ ...p, firstName }))}
                placeholder="First name"
                placeholderTextColor={tone.muted}
                style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
              />
              <RingInput
                value={pendingChange.lastName}
                onChangeText={(lastName) => setPendingChange((p) => ({ ...p, lastName }))}
                placeholder="Last name"
                placeholderTextColor={tone.muted}
                style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
              />
            </View>
          )}
          <RingInput
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
              disabled={submitting || !canSubmit}
              style={[styles.dangerBtn, (submitting || !canSubmit) && styles.btnDisabled]}
            >
              <Text style={styles.dangerBtnText}>{submitting ? "Saving…" : ACTION_COPY[pendingChange.kind].button}</Text>
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
  nameRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  nameInput: { flex: 1, minWidth: 160, minHeight: 0 },
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