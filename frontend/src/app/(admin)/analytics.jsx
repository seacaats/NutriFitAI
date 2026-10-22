import StatCard from "@/features/admin/components/StatCard";
import { useAdminAnalytics } from "@/features/admin/hooks/useAdminAnalytics";
import Skeleton from "@/shared/components/Skeleton";
import AreaChartMini from "@/shared/components/charts/AreaChartMini";
import DonutChart from "@/shared/components/charts/DonutChart";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getChipTint, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { adminStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

/**
 * Admin analytics dashboard (web only). Displays aggregate platform counts from
 * GET /admin/analytics without personal or health data.
 * "Active" counts distinct regular users who opened the app on a given day.
 */

const DASH = "—";

const AUDIT_ROWS = [
  { key: "info", label: "Info", color: colors.textMuted },
  { key: "notice", label: "Notice", color: chipTints.blue.icon },
  { key: "warning", label: "Warning", color: chipTints.orange.icon },
  { key: "critical", label: "Critical", color: colors.danger },
];

const USAGE_ROWS = [
  { key: "meals", label: "Meals logged", icon: "restaurant-outline" },
  { key: "scans", label: "Food scans", icon: "camera-outline" },
  { key: "workouts", label: "Workouts completed", icon: "barbell-outline" },
  { key: "waterLogs", label: "Water entries", icon: "water-outline" },
  { key: "coachMessages", label: "Coach messages", icon: "hardware-chip-outline" },
];

// Sequential onboarding and retention funnel stages; each stage requires passing prior stages.
const FUNNEL_ROWS = [
  { key: "signedUp", label: "Signed up" },
  { key: "verified", label: "Verified email" },
  { key: "onboarded", label: "Finished onboarding" },
  { key: "logged", label: "Logged a meal, water or workout" },
  { key: "returned", label: "Came back on a later day" },
];

// Round up y-axis maximum to the nearest multiple of `step`, floored at `min`.
const ceilTo = (n, step, min = step) => Math.max(min, Math.ceil(n / step) * step);

function Panel({ title, note, children, tone, style }) {
  return (
    <View style={[styles.panel, { backgroundColor: tone.card, borderColor: tone.border }, style]}>
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { color: tone.text }]}>{title}</Text>
        {!!note && <Text style={[styles.panelNote, { color: tone.muted }]}>{note}</Text>}
      </View>
      {children}
    </View>
  );
}

// Progress bars showing the share of new accounts reaching each funnel step.
function Funnel({ activation, tone, loading }) {
  const steps = activation?.steps;
  if (loading) return <Skeleton width={220} height={15} />;
  if (!steps?.signedUp) {
    return <Text style={[styles.funnelEmpty, { color: tone.muted }]}>No accounts old enough to measure yet. It updates through the day.</Text>;
  }
  return (
    <View>
      {FUNNEL_ROWS.map((r) => {
        const share = Math.round((steps[r.key] / steps.signedUp) * 100);
        return (
          <View key={r.key} style={styles.funnelRow}>
            <View style={styles.funnelTop}>
              <Text style={[styles.funnelLabel, { color: tone.text }]}>{r.label}</Text>
              <Text style={[styles.funnelValue, { color: tone.text }]}>{steps[r.key].toLocaleString()} · {share}%</Text>
            </View>
            <View style={[styles.funnelTrack, { backgroundColor: tone.border }]}>
              <View style={[styles.funnelFill, { width: `${share}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Donut chart with legend breakdown.
function Breakdown({ rows, counts, tone, centerLabel, loading }) {
  const total = rows.reduce((s, r) => s + (counts?.[r.key] || 0), 0);
  return (
    <View style={styles.breakdown}>
      <DonutChart size={110} strokeWidth={16} centerBg={tone.card} segments={rows.map((r) => ({ value: counts?.[r.key] || 0, color: r.color }))}>
        {loading
          ? <Skeleton width={36} height={16} />
          : <Text style={[styles.donutValue, { color: tone.text }]}>{counts ? total.toLocaleString() : DASH}</Text>}
        <Text style={[styles.donutLabel, { color: tone.muted }]}>{centerLabel}</Text>
      </DonutChart>
      <View style={styles.legend}>
        {rows.map((r) => (
          <View key={r.key} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: r.color }]} />
            <Text style={[styles.legendLabel, { color: tone.text }]}>{r.label}</Text>
            {loading
              ? <Skeleton width={24} height={12} />
              : <Text style={[styles.legendValue, { color: tone.text }]}>{counts ? (counts[r.key] || 0).toLocaleString() : DASH}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { view: v, loading, error, refresh } = useAdminAnalytics();
  // Show skeleton placeholders on initial load; retain existing numbers during manual refresh.
  const first = loading && !v;

  // Preserve natural card height when stacked vertically on narrow viewports.
  const panelFlex = narrow ? styles.stackItem : styles.flex1;

  const activeTop = ceilTo(Math.max(0, ...(v?.activeSeries.map((d) => d.value) || [0])), 5);
  const signupTop = ceilTo(Math.max(0, ...(v?.signupSeries.map((d) => d.value) || [0])), 5);
  const green = getChipTint("green", darkMode);
  const blue = getChipTint("blue", darkMode);

  return (
    <DashboardLayout>
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: tone.muted }]}>ADMINISTRATION</Text>
          <Text style={[styles.pageTitle, { color: tone.text }]}>Analytics</Text>
          <Text style={[styles.pageSubtitle, { color: tone.muted }]}>
            How NutriFitAI is being used. Counts only.
          </Text>
        </View>
        <Pressable onPress={refresh} disabled={loading} style={[styles.refreshBtn, loading && { opacity: 0.6 }]}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.refreshText}>{loading ? "Loading" : "Refresh"}</Text>
        </Pressable>
      </View>

      <ScreenError message={error} />

      {/* Headline numbers */}
      <View style={styles.statRow}>
        <StatCard
          label="USERS"
          value={v ? v.accounts.users.toLocaleString() : DASH}
          hint={v ? `${v.accounts.verifiedUsers.toLocaleString()} verified` : null}
          tone={tone} loading={first}
        />
        <StatCard label="ACTIVE TODAY" value={v ? v.activeUsers.today.toLocaleString() : DASH} tone={tone} loading={first} />
        <StatCard
          label="ACTIVE · 7 DAYS"
          value={v ? v.activeUsers.week.toLocaleString() : DASH}
          hint={v ? `${v.activeUsers.month.toLocaleString()} in ${v.days} days` : null}
          tone={tone} loading={first}
        />
        <StatCard
          label={`NEW · ${v?.days ?? 30} DAYS`}
          value={v ? v.signupsTotal.toLocaleString() : DASH}
          tone={tone} loading={first}
        />
        <StatCard
          label="SUSPENDED"
          value={v ? v.accounts.suspended.toLocaleString() : DASH}
          hint={v ? `${v.accounts.admins} admins` : null}
          tone={tone} loading={first}
        />
      </View>

      {/* 30-day trend charts */}
      <View style={[styles.row, narrow && styles.column]}>
        <Panel title="Active users" note="Per day, last 30 days" tone={tone} style={panelFlex}>
          {first ? (
            <Skeleton width="100%" height={170} />
          ) : (
            <AreaChartMini
              data={v?.activeSeries || []}
              height={170}
              stroke={green.icon}
              fill={green.backgroundColor}
              yMin={0}
              yMax={activeTop}
              yTicks={[0, activeTop / 2, activeTop].map(Math.round)}
              name="Active"
              unit="users"
            />
          )}
        </Panel>
        <Panel title="Sign-ups" note="New user accounts per day" tone={tone} style={panelFlex}>
          {first ? (
            <Skeleton width="100%" height={170} />
          ) : (
            <AreaChartMini
              data={v?.signupSeries || []}
              height={170}
              stroke={blue.icon}
              fill={blue.backgroundColor}
              yMin={0}
              yMax={signupTop}
              yTicks={[0, signupTop / 2, signupTop].map(Math.round)}
              name="Sign-ups"
              unit=""
            />
          )}
        </Panel>
      </View>

      {/* Cohort funnel for accounts at least 7 days old */}
      <Panel
        title="New-user funnel"
        note={v?.activation?.steps?.signedUp ? `${v.activation.steps.signedUp.toLocaleString()} accounts, at least a week old` : "Accounts at least a week old"}
        tone={tone}
        style={styles.funnelPanel}
      >
        <Funnel activation={v?.activation} tone={tone} loading={first} />
      </Panel>

      <View style={[styles.row, narrow && styles.column]}>
        <Panel title="Feature use" note="Last 7 days" tone={tone} style={panelFlex}>
          {USAGE_ROWS.map((r, i) => (
            <View key={r.key} style={[styles.usageRow, i > 0 && { borderTopWidth: 1, borderTopColor: tone.border }]}>
              <Ionicons name={r.icon} size={16} color={shellColors.primary} />
              <Text style={[styles.usageLabel, { color: tone.text }]}>{r.label}</Text>
              {first
                ? <Skeleton width={40} height={15} />
                : <Text style={[styles.usageValue, { color: tone.text }]}>{v ? v.usage[r.key].toLocaleString() : DASH}</Text>}
            </View>
          ))}
        </Panel>

        <Panel title="Audit events" note="Last 7 days, by severity" tone={tone} style={panelFlex}>
          <Breakdown rows={AUDIT_ROWS} counts={v?.audit} tone={tone} centerLabel="events" loading={first} />
        </Panel>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  refreshBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: shellColors.primary, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { fontSize: 13, fontWeight: "700", color: colors.white },

  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  column: { flexDirection: "column" },
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },

  panel: { borderWidth: 1, borderRadius: radii.md, padding: 18, minWidth: 0 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  panelTitle: { fontSize: 16, fontWeight: "800" },
  panelNote: { fontSize: 12, fontWeight: "600" },

  usageRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  usageLabel: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600" },
  usageValue: { fontSize: 16, fontWeight: "800" },

  funnelPanel: { marginBottom: 12 },
  funnelRow: { paddingVertical: 8 },
  funnelTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  funnelLabel: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600" },
  funnelValue: { fontSize: 14, fontWeight: "800" },
  funnelTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  funnelFill: { height: 8, borderRadius: 4, backgroundColor: shellColors.primary },
  funnelEmpty: { fontSize: 14 },

  breakdown: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  donutValue: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  donutLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  legend: { flex: 1, minWidth: 140, gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendValue: { fontSize: 13, fontWeight: "700" },
});
