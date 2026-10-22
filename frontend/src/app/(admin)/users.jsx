import { RoleBadge } from "@/features/admin/components/Badges";
import DataTable from "@/features/admin/components/DataTable";
import DetailGrid from "@/features/admin/components/DetailGrid";
import FilterRow from "@/features/admin/components/FilterRow";
import Pager from "@/features/admin/components/Pager";
import StatCard from "@/features/admin/components/StatCard";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { isValidEmail, NAME_MAX } from "@/shared/utils/formValidators";
import { formatDate, formatTimestamp } from "@/shared/utils/formatDate";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

/**
 * Admin user directory and account management screen.
 */

const ROLE_FILTERS = [
  { value: null, label: "Everyone" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
];

// Confirmation copy per account action (every action requires an audit reason).
const ACTION_COPY = {
  rename: { title: (p) => `Rename ${p.name}?`, button: "Save name" },
  suspend: { title: (p) => `Suspend ${p.name}?`, body: "They are emailed, signed out within 15 minutes and can't sign in until reinstated. The reason stays private: add a message below if they should be told why.", button: "Suspend" },
  reinstate: { title: (p) => `Reinstate ${p.name}?`, body: "They can sign in again right away.", button: "Reinstate" },
  reset: { title: (p) => `Require a password reset for ${p.name}?`, body: "Sign-in is refused until they set a new password through Forgot password.", button: "Require reset" },
  cancelReset: { title: (p) => `Cancel the password reset for ${p.name}?`, body: "Their current password works again right away.", button: "Cancel reset" },
  create: { title: () => "Add an account", body: "No password is set: they get an email explaining how to choose their own. Admins set up 2FA at first sign-in.", button: "Create account" },
  resetMfa: { title: (p) => `Reset the authenticator app for ${p.name}?`, body: "Their app and recovery codes stop working and they are signed out. At their next sign-in they set up a new one.", button: "Reset authenticator" },
  endSession: { title: (p) => `End this session of ${p.name}?`, body: "Admins are signed out at once, other users within 15 minutes.", button: "End session" },
  endAll: { title: (p) => `Sign ${p.name} out of every device?`, body: "Admins are signed out at once, other users within 15 minutes.", button: "Sign out everywhere" },
  delete: { title: (p) => `Delete ${p.name}?`, body: "They are emailed, suspended and signed out now. Their account and all of their data are permanently deleted in 14 days unless you cancel. The reason stays private: add a message below if they should be told why.", button: "Schedule deletion" },
  cancelDelete: { title: (p) => `Cancel the deletion of ${p.name}?`, body: "They can sign in again right away.", button: "Cancel deletion" },
};

// Format a readable browser/OS label from a User-Agent string.
function deviceOf(userAgent) {
  const ua = String(userAgent || "");
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
  const app = /Edg\//.test(ua) ? "Edge" : /Firefox/i.test(ua) ? "Firefox" : /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "";
  if (app && os) return `${app} on ${os}`;
  return app || os || "Unknown device";
}

// Active device sessions for an expanded user row, with controls to revoke individual or all sessions.
function SessionList({ row, users, manage, startAction, tone }) {
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await users.loadSessions(row.id));
    } catch (err) {
      setError(err?.message || "Couldn't load sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.roleActions, { borderTopColor: tone.border }]}>
      <View style={styles.sessionHead}>
        <Text style={[styles.roleActionsLabel, { color: tone.muted }]}>Sessions</Text>
        <Pressable onPress={load} disabled={loading}>
          <Text style={[styles.sessionLink, { color: shellColors.primary }]}>{loading ? "Loading…" : "Refresh"}</Text>
        </Pressable>
      </View>
      {error && <Text style={[styles.subCell, { color: colors.danger }]}>{error}</Text>}
      {sessions && sessions.length === 0 && <Text style={[styles.bodyCell, { color: tone.muted }]}>No signed-in devices.</Text>}
      {(sessions || []).map((s) => (
        <View key={s.id} style={[styles.sessionRow, { borderColor: tone.border }]}>
          <View style={styles.flex1}>
            <Text style={[styles.primaryCell, { color: tone.text }]}>{deviceOf(s.userAgent)}</Text>
            <Text style={[styles.subCell, { color: tone.muted }]}>
              Last active {formatTimestamp(s.lastUsedAt)}{s.ip ? ` · ${s.ip}` : ""}
            </Text>
          </View>
          {manage && (
            <Pressable onPress={() => startAction("endSession", row, { sessionId: s.id })} style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}>
              <Text style={[styles.roleBtnText, { color: tone.text }]}>End</Text>
            </Pressable>
          )}
        </View>
      ))}
      {manage && sessions && sessions.length > 0 && (
        <View style={styles.roleBtnRow}>
          <Pressable onPress={() => startAction("endAll", row)} style={[styles.roleBtn, { borderColor: colors.danger, backgroundColor: tone.card }]}>
            <Text style={[styles.roleBtnText, { color: colors.danger }]}>Sign out everywhere</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AdminUsersScreen() {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  const { user } = useAuth();

  // Prevent self-targeting in UI controls (also enforced server-side).
  const canManage = (row) => row.id !== user?.id;

  const { search: linkedSearch } = useLocalSearchParams();
  const users = useAdminUsers({ search: typeof linkedSearch === "string" ? linkedSearch : "" });
  const [expandedId, setExpandedId] = useState(null);
  const [notice, setNotice] = useState(null);

  // Two-step confirmation state for administrative actions (requires an audit reason).
  const [pendingChange, setPendingChange] = useState(null);
  const [reason, setReason] = useState("");
  // Optional user-facing message for suspension and deletion emails (audit reason remains internal).
  const [userMessage, setUserMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const canSubmit = reason.trim().length >= 3
    && (!userMessage.trim() || userMessage.trim().length >= 3)
    && !(pendingChange?.kind === "rename" && !pendingChange.firstName.trim())
    && !(pendingChange?.kind === "create" && (!pendingChange.firstName.trim() || !isValidEmail(pendingChange.email)));

  const startAction = (kind, row, extra = {}) => {
    setExpandedId(row.id);
    setPendingChange({ kind, id: row.id, name: row.fullName || row.email, ...extra });
    setReason("");
    setUserMessage("");
    setNotice(null);
  };

  const startCreate = () => {
    setPendingChange({ kind: "create", id: null, name: "", email: "", firstName: "", lastName: "", role: "user" });
    setReason("");
    setUserMessage("");
    setNotice(null);
  };

  const submitAction = async () => {
    if (!pendingChange || !canSubmit) return;
    setSubmitting(true);
    const { kind, id } = pendingChange;
    const why = reason.trim();
    let result;
    if (kind === "rename") {
      result = await users.updateName(id, { firstName: pendingChange.firstName.trim(), lastName: pendingChange.lastName.trim() || null }, why);
    } else if (kind === "suspend") result = await users.suspend(id, why, userMessage.trim());
    else if (kind === "reinstate") result = await users.reinstate(id, why);
    else if (kind === "reset") result = await users.forcePasswordReset(id, why);
    else if (kind === "cancelReset") result = await users.cancelPasswordReset(id, why);
    else if (kind === "create") {
      const lastName = pendingChange.lastName.trim();
      result = await users.createUser({ email: pendingChange.email.trim(), firstName: pendingChange.firstName.trim(), role: pendingChange.role, ...(lastName ? { lastName } : {}) }, why);
    } else if (kind === "resetMfa") result = await users.resetAuthenticator(id, why);
    else if (kind === "endSession") result = await users.revokeSession(id, pendingChange.sessionId, why);
    else if (kind === "endAll") result = await users.revokeAllSessions(id, why);
    else if (kind === "delete") result = await users.deleteUser(id, why, userMessage.trim());
    else if (kind === "cancelDelete") result = await users.cancelDeletion(id, why);
    else {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setNotice({ ok: result.ok, message: result.message, id });
    if (result.ok) {
      if (kind === "endSession" || kind === "endAll") setSessionsVersion((v) => v + 1);
      setPendingChange(null);
      setReason("");
      setUserMessage("");
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
          {row.suspendedAt && <Text style={[styles.subCell, { color: colors.danger }]}>{row.deletionScheduledFor ? "Scheduled for Deletion" : "Suspended"}</Text>}
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
      render: (row) => <Text style={[styles.bodyCell, { color: tone.muted }]}>{formatDate(row.createdAt)}</Text>,
    },
  ];

  const renderExpanded = (row) => {
    return (
      <View style={styles.expandedWrap}>
        <DetailGrid
          items={[
            { label: "User ID", value: row.id },
            { label: "Email", value: row.email },
            { label: "Role", value: row.role },
            { label: "Email verified", value: row.emailVerified ? "Yes" : "No" },
            ...(row.role === "user"
              ? [{ label: "Terms accepted", value: formatDate(row.termsAcceptedAt) }]
              : []),
            { label: "Joined", value: formatDate(row.createdAt) },
            ...(row.emailChangedAt ? [{ label: "Email changed", value: formatDate(row.emailChangedAt) }] : []),
            ...(row.suspendedAt
              ? [
                { label: row.deletionScheduledFor ? "Scheduled for Deletion" : "Suspended", value: formatDate(row.suspendedAt) },
                { label: "By", value: row.suspendedBy || "Unknown" },
                { label: "Reason", value: row.suspendedReason || "No reason recorded" },
                { label: "Message to user", value: row.suspendedUserMessage || "None sent" },
              ]
              : []),
            ...(row.deletionScheduledFor ? [{ label: "Deletes on", value: formatDate(row.deletionScheduledFor) }] : []),
            ...(row.passwordResetRequired
              ? [
                { label: "Password reset required", value: formatDate(row.passwordResetRequiredAt) },
                { label: "Required by", value: row.passwordResetBy || "Unknown" },
                { label: "Reset reason", value: row.passwordResetReason || "No reason recorded" },
              ]
              : []),
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
              {/* Hide manual suspend/reinstate while a scheduled deletion is pending */}
              {!row.deletionScheduledFor && (
                <Pressable
                  onPress={() => startAction(row.suspendedAt ? "reinstate" : "suspend", row)}
                  style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
                >
                  <Text style={[styles.roleBtnText, { color: tone.text }]}>{row.suspendedAt ? "Reinstate" : "Suspend"}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => startAction(row.passwordResetRequired ? "cancelReset" : "reset", row)}
                style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
              >
                <Text style={[styles.roleBtnText, { color: tone.text }]}>
                  {row.passwordResetRequired ? "Cancel password reset" : "Require password reset"}
                </Text>
              </Pressable>
              {row.role === "admin" && (
                <Pressable
                  onPress={() => startAction("resetMfa", row)}
                  style={[styles.roleBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
                >
                  <Text style={[styles.roleBtnText, { color: tone.text }]}>Reset authenticator</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => startAction(row.deletionScheduledFor ? "cancelDelete" : "delete", row)}
                style={[styles.roleBtn, { borderColor: row.deletionScheduledFor ? tone.border : colors.danger, backgroundColor: tone.card }]}
              >
                <Text style={[styles.roleBtnText, { color: row.deletionScheduledFor ? tone.text : colors.danger }]}>
                  {row.deletionScheduledFor ? "Cancel deletion" : "Delete account"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {pendingChange?.id === row.id && confirmNode}
        {notice?.id === row.id && noticeNode}

        <SessionList key={`${row.id}-${sessionsVersion}`} row={row} users={users} manage={canManage(row)} startAction={startAction} tone={tone} />
      </View>
    );
  };

  // Render confirmation and result notices inline inside the expanded row, or at the top of the page for account creation.
  const noticeNode = notice && (
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
  );
  const confirmNode = pendingChange && pendingChange.kind !== "create" && (
    <View style={[styles.confirmCard, { backgroundColor: tone.card, borderColor: colors.danger }]}>
      <Text style={[styles.confirmTitle, { color: tone.text }]}>
        {ACTION_COPY[pendingChange.kind].title(pendingChange)}
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
            autoFocus
            placeholder="First name"
            maxLength={NAME_MAX}
            placeholderTextColor={tone.muted}
            style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
          />
          <RingInput
            value={pendingChange.lastName}
            onChangeText={(lastName) => setPendingChange((p) => ({ ...p, lastName }))}
            placeholder="Last name"
            maxLength={NAME_MAX}
            placeholderTextColor={tone.muted}
            style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
          />
        </View>
      )}
      <RingInput
        value={reason}
        onChangeText={setReason}
        autoFocus={pendingChange.kind !== "rename"}
        placeholder="Reason (required)"
        maxLength={300}
        placeholderTextColor={tone.muted}
        style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
        multiline
      />
      {(pendingChange.kind === "suspend" || pendingChange.kind === "delete") && (
        <RingInput
          value={userMessage}
          onChangeText={setUserMessage}
          placeholder="Message to the user (optional)"
          maxLength={300}
          placeholderTextColor={tone.muted}
          style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
          multiline
        />
      )}
      <View style={styles.confirmActions}>
        <Pressable
          onPress={() => { setPendingChange(null); setReason(""); setUserMessage(""); }}
          style={[styles.secondaryBtn, { borderColor: tone.border }]}
        >
          <Text style={[styles.secondaryBtnText, { color: tone.text }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submitAction}
          disabled={submitting || !canSubmit}
          style={[styles.dangerBtn, (submitting || !canSubmit) && styles.btnDisabled]}
        >
          <Text style={styles.dangerBtnText}>{submitting ? "Saving…" : ACTION_COPY[pendingChange.kind].button}</Text>
        </Pressable>
      </View>
    </View>
  );

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
        <Pressable onPress={startCreate} style={styles.refreshBtn}>
          <Ionicons name="person-add-outline" size={16} color={colors.white} />
          <Text style={styles.refreshText}>Add account</Text>
        </Pressable>
        <Pressable onPress={users.refresh} disabled={users.loading} style={[styles.refreshBtn, users.loading && { opacity: 0.6 }]}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>{users.loading ? "Loading" : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <StatCard label="TOTAL ACCOUNTS" value={users.counts?.total} tone={tone} />
        <StatCard label="USERS" value={users.counts?.user} tone={tone} />
        <StatCard label="ADMINS" value={users.counts?.admin} tone={tone} />
      </View>

      <View style={[styles.controls, narrow && styles.controlsNarrow]}>
        <View style={[styles.searchBox, { backgroundColor: tone.card, borderColor: tone.border }, ring.style]}>
          <Ionicons name="search" size={16} color={tone.muted} />
          <TextInput
            {...ring.handlers}
            value={users.search}
            maxLength={120}
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

      {notice && (!notice.id || expandedId !== notice.id) && noticeNode}

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

      <ConfirmModal
        visible={pendingChange?.kind === "create"}
        tone="confirm"
        title="Add an account"
        message="No password is set: they get an email explaining how to choose their own. Admins set up 2FA at first sign-in."
        confirmLabel="Create account"
        cancelLabel="Cancel"
        onConfirm={submitAction}
        onCancel={() => { setPendingChange(null); setReason(""); setUserMessage(""); }}
        loading={submitting}
        confirmDisabled={!canSubmit}
      >
        <View style={styles.createModalBody}>
          <View style={styles.nameRow}>
            <RingInput
              value={pendingChange?.firstName || ""}
              onChangeText={(firstName) => setPendingChange((p) => ({ ...p, firstName }))}
              autoFocus
              placeholder="First name"
              maxLength={NAME_MAX}
              placeholderTextColor={tone.muted}
              style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
            />
            <RingInput
              value={pendingChange?.lastName || ""}
              onChangeText={(lastName) => setPendingChange((p) => ({ ...p, lastName }))}
              placeholder="Last name (optional)"
              maxLength={NAME_MAX}
              placeholderTextColor={tone.muted}
              style={[styles.reasonInput, styles.nameInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
            />
          </View>
          <RingInput
            value={pendingChange?.email || ""}
            onChangeText={(email) => setPendingChange((p) => ({ ...p, email }))}
            placeholder="Email"
            maxLength={254}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholderTextColor={tone.muted}
            style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text, minHeight: 0 }]}
          />
          <View style={styles.roleBtnRow}>
            {["user", "admin"].map((r) => {
              const on = pendingChange?.role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setPendingChange((p) => ({ ...p, role: r }))}
                  style={[styles.roleBtn, { borderColor: on ? shellColors.primary : tone.border, backgroundColor: on ? tone.soft : tone.card }]}
                >
                  <Text style={[styles.roleBtnText, { color: on ? shellColors.primary : tone.text }]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
          <RingInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            maxLength={300}
            placeholderTextColor={tone.muted}
            style={[styles.reasonInput, { backgroundColor: tone.soft, borderColor: tone.border, color: tone.text }]}
            multiline
          />
        </View>
      </ConfirmModal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  primaryCell: { fontSize: 13, fontWeight: "700" },
  subCell: { fontSize: 11, marginTop: 1 },
  bodyCell: { fontSize: 12 },

  expandedWrap: { gap: 14 },
  roleActions: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  roleActionsLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  roleBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 8 },
  roleBtnText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  sessionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionLink: { fontSize: 12, fontWeight: "700" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },

  createModalBody: { gap: 10, alignSelf: "stretch" },
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
