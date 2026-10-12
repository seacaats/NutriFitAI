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
 * Analytics -- the admin and superadmin dashboard (web only, like the rest
 * of (admin)). Counts across the whole app from GET /admin/analytics: no
 * names, emails or health values, so both roles see the same page.
 *
 * "Active" means opened the app that day (any signed-in use, counted once
 * per user per day), regular users only
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

// A y-axis top a little above the highest point, never below `min`
const ceilTo = (n, step, min = step) => Math.max(min, Math.ceil(n / step) * step);

// `loading` is the first load only: placeholders where the numbers go
function StatCard({ label, value, hint, tone, loading }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tone.card, borderColor: tone.border }]}>
      <Text style={[styles.statLabel, { color: tone.muted }]}>{label}</Text>
      {loading ? <Skeleton width={70} height={26} /> : <Text style={[styles.statValue, { color: tone.text }]}>{value}</Text>}
      {loading ? <Skeleton width={90} height={11} /> : !!hint && <Text style={[styles.statHint, { color: tone.muted }]}>{hint}</Text>}
    </View>
  );
}

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

// A donut with its legend. Empty when every count is 0
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
  // First load: the page's real layout with placeholders. A refresh keeps the old numbers
  const first = loading && !v;

  // Stacked cards keep their natural height (flex: 1 would collapse them in a column)
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
          hint={v ? `${v.accounts.admins + v.accounts.superadmins} admins` : null}
          tone={tone} loading={first}
        />
      </View>

      {/* Trends over the last 30 days */}
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

      <View style={[styles.row, narrow && styles.column]}>
        {/* What people used this week */}
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

        {/* Severity is the audit log's chain (Audit Logs page) */}
        <Panel title="Audit events" note="Last 7 days, by severity" tone={tone} style={panelFlex}>
          <Breakdown rows={AUDIT_ROWS} counts={v?.audit} tone={tone} centerLabel="events" loading={first} />
        </Panel>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,

  // alignSelf: not stretched across the page when the header stacks
  refreshBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: shellColors.primary, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { fontSize: 13, fontWeight: "700", color: colors.white },

  statCard: { flex: 1, minWidth: 150, borderWidth: 1, borderRadius: radii.md, padding: 16, gap: 4 },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statHint: { fontSize: 11, fontWeight: "600" },

  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  column: { flexDirection: "column" },
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },

  panel: { borderWidth: 1, borderRadius: radii.md, padding: 16, minWidth: 0 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  panelTitle: { fontSize: 15, fontWeight: "800" },
  panelNote: { fontSize: 11, fontWeight: "600" },

  usageRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  usageLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600" },
  usageValue: { fontSize: 15, fontWeight: "800" },

  breakdown: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  donutValue: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  donutLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  legend: { flex: 1, minWidth: 140, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 12 },
  legendValue: { fontSize: 12, fontWeight: "700" },
});