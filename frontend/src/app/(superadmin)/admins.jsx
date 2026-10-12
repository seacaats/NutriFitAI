import { RoleBadge } from "@/features/admin/components/Badges";
import DataTable, { DetailGrid, Pager } from "@/features/admin/components/DataTable";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import Skeleton from "@/shared/components/Skeleton";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { RingInput, useFocusRing } from "@/shared/components/ui/FormInput";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";


// Both this route and the endpoint behind it are superadmin-gated. The route
// guard (app/(main)/_layout.jsx) is the usability half; requireMinimumRole
// on the server, reading a role refreshed from the database rather than from
// the token, is the half that matters.
//
// The one place roles change: a superadmin promotes an admin to superadmin, or
// demotes a superadmin to admin. Users are never promoted or demoted; the
// server refuses it too

// Confirm-card copy per action. Both need a reason (adminValidators)
const ACTION_COPY = {
  promote: {
    title: (p) => `Promote ${p.name} to superadmin?`,
    body: "They get full access, including changing roles and deleting accounts.",
    button: "Promote",
    busy: "Promoting…",
  },
  demote: {
    title: (p) => `Demote ${p.name} to admin?`,
    body: "They keep admin access but can no longer change roles or delete accounts.",
    button: "Demote",
    busy: "Demoting…",
  },
};

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SuperadminAdminsScreen() {
  const ring = useFocusRing();
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const router = useRouter();

  const { user } = useAuth();
  // Hits /admin/admins, which returns superadmins first then admins (adminController.listAdmins)
  const admins = useAdminUsers({ endpoint: "/admin/admins" });

  const [expandedId, setExpandedId] = useState(null);
  const [notice, setNotice] = useState(null);
  // { kind: "promote" | "demote", id, name } while the confirm card is open
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = reason.trim().length >= 3;

  const startAction = (kind, row) => {
    setPending({ kind, id: row.id, name: row.fullName || row.email });
    setReason("");
    setNotice(null);
  };

  const submitAction = async () => {
    if (!pending || !canSubmit) return;
    setSubmitting(true);
    const result = await admins.changeRole(pending.id, pending.kind === "promote" ? "superadmin" : "admin", reason.trim());
    setSubmitting(false);
    setNotice({ ok: result.ok, message: result.message });
    if (result.ok) {
      setPending(null);
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
          {width < 1100 && (
            <Text numberOfLines={1} style={[styles.subCell, { color: tone.muted }]}>{row.email}</Text>
          )}
        </View>
      ),
    },
    { key: "email", title: "Email", flex: 3, priority: 2 },
    { key: "role", title: "Access", width: 130, render: (row) => <RoleBadge role={row.role} /> },
    {
      key: "createdAt",
      title: "Account since",
      width: 130,
      priority: 3,
      render: (row) => <Text style={[styles.bodyCell, { color: tone.muted }]}>{formatWhen(row.createdAt)}</Text>,
    },
  ];

  const renderExpanded = (row) => {
    const isSelf = row.id === user?.id;

    return (
      <View style={styles.expandedWrap}>
        <DetailGrid
          items={[
            { label: "User ID", value: row.id },
            { label: "Email", value: row.email },
            { label: "Access level", value: row.role },
            { label: "Email verified", value: row.emailVerified ? "Yes" : "No" },
            { label: "Account since", value: formatWhen(row.createdAt) },
          ]}
        />

        <View style={[styles.actions, { borderTopColor: tone.border }]}>
          <Pressable
            onPress={() => router.push("/audit-logs")}
            style={[styles.secondaryBtn, { borderColor: tone.border }]}
          >
            <Ionicons name="document-text-outline" size={14} color={tone.text} />
            <Text style={[styles.secondaryBtnText, { color: tone.text }]}>View audit log</Text>
          </Pressable>

          {isSelf ? (
            <Text style={[styles.selfNote, { color: tone.muted }]}>
              You can&apos;t change your own role. Ask another superadmin.
            </Text>
          ) : row.role === "admin" ? (
            <Pressable
              onPress={() => startAction("promote", row)}
              style={[styles.secondaryBtn, { borderColor: tone.border, backgroundColor: tone.card }]}
            >
              <Ionicons name="arrow-up-circle-outline" size={14} color={tone.text} />
              <Text style={[styles.secondaryBtnText, { color: tone.text }]}>Promote to superadmin</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => startAction("demote", row)}
              style={[styles.revokeBtn, { borderColor: colors.danger }]}
            >
              <Ionicons name="arrow-down-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.revokeBtnText}>Demote to admin</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: tone.muted }]}>SUPERADMIN</Text>
          <Text style={[styles.pageTitle, { color: tone.text }]}>Admins</Text>
          <Text style={[styles.pageSubtitle, { color: tone.muted }]}>
            Everyone holding elevated access. Every grant and revocation is recorded in the
            audit log.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={admins.refresh} disabled={admins.loading} style={[styles.refreshBtn, admins.loading && { opacity: 0.6 }]}>
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.refreshText}>{admins.loading ? "Loading" : "Refresh"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Rendered before the counts arrive, with placeholders for the numbers */}
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
          <Text style={[styles.statLabel, { color: tone.muted }]}>SUPERADMINS</Text>
          {admins.counts
            ? <Text style={[styles.statValue, { color: tone.text }]}>{admins.counts.superadmin}</Text>
            : <Skeleton width={56} height={26} />}
          <Text style={[styles.statHint, { color: tone.muted }]}>
            {admins.counts?.superadmin <= 1
              ? "The last one can't be demoted — promote another first."
              : "Full access, including role changes."}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
          <Text style={[styles.statLabel, { color: tone.muted }]}>ADMINS</Text>
          {admins.counts
            ? <Text style={[styles.statValue, { color: tone.text }]}>{admins.counts.admin}</Text>
            : <Skeleton width={56} height={26} />}
          <Text style={[styles.statHint, { color: tone.muted }]}>
            Can read users and the audit log; cannot change roles.
          </Text>
        </View>
      </View>

      <View style={[styles.controls, narrow && styles.controlsNarrow]}>
        <View style={[styles.searchBox, { backgroundColor: tone.card, borderColor: tone.border }, ring.style]}>
          <Ionicons name="search" size={16} color={tone.muted} />
          <TextInput
            {...ring.handlers}
            value={admins.search}
            onChangeText={admins.setSearch}
            placeholder="Search admins by name or email"
            placeholderTextColor={tone.muted}
            style={[ring.input, styles.searchInput, { color: tone.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {admins.search.length > 0 && (
            <Pressable onPress={() => admins.setSearch("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={tone.muted} />
            </Pressable>
          )}
        </View>
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

      {pending && (
        <View style={[styles.confirmCard, { backgroundColor: tone.card, borderColor: pending.kind === "promote" ? shellColors.primary : colors.danger }]}>
          <Text style={[styles.confirmTitle, { color: tone.text }]}>{ACTION_COPY[pending.kind].title(pending)}</Text>
          <Text style={[styles.confirmBody, { color: tone.muted }]}>
            {ACTION_COPY[pending.kind].body} This is recorded in the audit log with your name and the reason below.
          </Text>
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
              onPress={() => { setPending(null); setReason(""); }}
              style={[styles.secondaryBtn, { borderColor: tone.border }]}
            >
              <Text style={[styles.secondaryBtnText, { color: tone.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submitAction}
              disabled={submitting || !canSubmit}
              style={[pending.kind === "promote" ? styles.primaryBtn : styles.dangerBtn, (submitting || !canSubmit) && styles.btnDisabled]}
            >
              <Text style={styles.dangerBtnText}>{submitting ? ACTION_COPY[pending.kind].busy : ACTION_COPY[pending.kind].button}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <DataTable
        columns={columns}
        rows={admins.rows}
        keyExtractor={(row) => row.id}
        loading={admins.loading}
        error={admins.error}
        onRetry={admins.refresh}
        emptyTitle={admins.search ? "No matching admins" : "No admins yet"}
        emptyBody={
          admins.search
            ? `Nothing matches "${admins.search}".`
            : "Admin accounts are created outside the app."
        }
        expandedRowId={expandedId}
        onToggleRow={setExpandedId}
        renderExpanded={renderExpanded}
      />

      <Pager
        page={admins.pagination.page}
        pageCount={admins.pagination.pageCount}
        total={admins.pagination.total}
        onChange={admins.setPage}
        unit="admins"
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  statCard: { flex: 1, minWidth: 220, borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 4 },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },

  primaryCell: { fontSize: 13, fontWeight: "700" },
  subCell: { fontSize: 11, marginTop: 1 },
  bodyCell: { fontSize: 12 },

  expandedWrap: { gap: 14 },
  actions: { borderTopWidth: 1, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  selfNote: { fontSize: 12, fontStyle: "italic" },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "700" },

  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  revokeBtnText: { fontSize: 13, fontWeight: "700", color: colors.danger },

  confirmCard: { borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 10, marginBottom: 16 },
  confirmTitle: { fontSize: 15, fontWeight: "700" },
  confirmBody: { fontSize: 12, lineHeight: 18 },
  reasonInput: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 64, textAlignVertical: "top" },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtn: { backgroundColor: shellColors.primary, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 10 },
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