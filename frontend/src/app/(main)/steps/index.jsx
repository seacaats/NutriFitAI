import { useDailySteps } from "@/features/steps/hooks/useDailySteps";
import { useStepSync } from "@/features/steps/hooks/useStepSync";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { useTheme } from "@/shared/context/ThemeContext";
import { formatNumber, friendlyDate } from "@/shared/services/steps/stepDates";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { stepsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import {
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

/**
 * The mobile steps screen, and the only surface in the app where step data can
 * originate -- the web screen reads whatever this one has synced.
 *
 * Two hooks, deliberately separate:
 *   useDailySteps  reads /api/steps. Shared with the web screen.
 *   useStepSync    talks to the OS health store. Mobile only.
 *
 * Keeping them apart is what lets the web screen reuse the first one untouched.
 */

const BAR_HEIGHT = 120;

export default function StepsScreen() {
  const { shell: c, darkMode } = useTheme();
  const steps = useDailySteps();
  // Re-reading after a sync is what turns "pushed 7 days" into visible bars.
  const sync = useStepSync({ onSynced: steps.refresh });

  const palette = {
    card: c.cardBg,
    border: c.dropdownBorder,
    text: c.sidebarText,
    muted: c.headerDescText,
    // soft/track aren't part of the shell theme -- same tones the web
    // steps screen uses, shared via getScreenTones.
    soft: getScreenTones(darkMode).soft,
    track: getScreenTones(darkMode).track,
  };

  const onRefresh = useCallback(async () => {
    await sync.refresh();
    steps.refresh();
  }, [sync, steps]);

  const maxSteps = Math.max(...steps.series.map((d) => d.steps || 0), steps.dailyGoal);

  return (
    <DashboardLayout>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={sync.syncing || steps.loading}
            onRefresh={onRefresh}
            tintColor={shellColors.primary}
          />
        }
      >
        <Text style={[styles.eyebrow, { color: palette.muted }]}>ACTIVITY</Text>
        <Text style={[styles.title, { color: palette.text }]}>Steps</Text>

        <ConnectionCard palette={palette} sync={sync} />

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={styles.stepIcon}>
                <Ionicons name="footsteps" size={20} color={colors.white} />
              </View>
              <View>
                <Text style={[styles.kicker, { color: palette.muted }]}>TODAY</Text>
                <Text style={[styles.heroValue, { color: palette.text }]}>
                  {/* null means "not recorded", which is a different claim from
                      zero steps -- show a dash rather than inventing a 0. */}
                  {steps.todaySteps === null ? "--" : formatNumber(steps.todaySteps)}
                </Text>
              </View>
            </View>
            <Text style={styles.goalPercent}>{steps.goalPercent}%</Text>
          </View>

          <View style={[styles.goalTrack, { backgroundColor: palette.track }]}>
            <View style={[styles.goalFill, { width: `${steps.goalPercent}%` }]} />
          </View>

          <View style={styles.rowBetween}>
            <Text style={[styles.muted, { color: palette.muted }]}>
              {steps.todaySteps === null
                ? "No steps recorded yet today"
                : `${formatNumber(Math.max(steps.dailyGoal - steps.todaySteps, 0))} to go`}
            </Text>
            <Text style={[styles.strong, { color: palette.text }]}>
              Goal {formatNumber(steps.dailyGoal)}
            </Text>
          </View>
        </View>

        <View style={[styles.rangeTabs, { backgroundColor: palette.soft }]}>
          {steps.ranges.map((item) => (
            <Pressable
              key={item}
              onPress={() => steps.setRange(item)}
              style={[styles.rangeTab, steps.range === item && styles.rangeTabActive]}
            >
              <Text style={[styles.rangeText, { color: steps.range === item ? colors.white : palette.muted }]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.statsRow}>
            <Stat value={formatNumber(steps.total)} label="Total" palette={palette} />
            <Stat value={formatNumber(steps.average)} label="Daily avg" palette={palette} />
            <Stat value={String(steps.goalDays)} label="Goal days" palette={palette} />
          </View>

          {steps.loading ? (
            <View style={styles.chart}>
              {[1, 0.6, 0.85, 0.4, 0.7, 0.5, 0.9].map((h, i) => (
                <View key={i} style={styles.barColumn}>
                  <Skeleton
                    width="100%"
                    height={Math.max(8, BAR_HEIGHT * h)}
                    style={{ alignSelf: "flex-end" }}
                  />
                  <Skeleton width={18} height={10} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.chart}>
              {steps.series.map((day) => {
                // A day with no row renders as an empty slot, never a zero bar.
                const hasData = day.steps !== null;
                const height = hasData ? Math.max(4, (day.steps / maxSteps) * BAR_HEIGHT) : 0;
                return (
                  <View key={day.key} style={styles.barColumn}>
                    <View style={[styles.barTrack, { backgroundColor: palette.track, height: BAR_HEIGHT }]}>
                      {hasData && (
                        <View
                          style={[
                            styles.bar,
                            {
                              height,
                              backgroundColor: day.steps >= steps.dailyGoal ? shellColors.primary : colors.stepsInactiveFill,
                            },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[styles.barLabel, { color: palette.muted }]}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {!steps.loading && !steps.hasData && (
            <Text style={[styles.muted, styles.centered, { color: palette.muted }]}>
              No step data for this period yet.
            </Text>
          )}
        </View>

        {steps.recentDays.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent days</Text>
            {steps.recentDays.map((day, index) => (
              <View
                key={day.activityDate}
                style={[
                  styles.recentRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: palette.border },
                ]}
              >
                <View style={[styles.recentIcon, { backgroundColor: palette.soft }]}>
                  <Ionicons name="walk-outline" size={18} color={shellColors.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.strong, { color: palette.text }]}>
                    {friendlyDate(day.activityDate)}
                  </Text>
                  <Text style={[styles.tiny, { color: palette.muted }]}>
                    {day.source === "manual" ? "Entered manually" : sync.label}
                  </Text>
                </View>
                <Text style={[styles.recentValue, { color: palette.text }]}>
                  {formatNumber(day.stepCount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {Boolean(steps.error) && <Text style={styles.error}>{steps.error}</Text>}
      </ScrollView>
    </DashboardLayout>
  );
}

/**
 * The permission surface. Four distinct states, because collapsing them into a
 * single "something went wrong" is how a fixable problem -- Health Connect
 * simply needs installing -- becomes a dead end for the user.
 */
function ConnectionCard({ palette, sync }) {
  // Still probing the device: render nothing rather than flashing
  // "not supported" before we know.
  if (sync.available === null) return null;

  if (!sync.available) {
    const needsUpdate = sync.availabilityReason === "update_required";
    return (
      <View style={[styles.notice, { backgroundColor: palette.soft, borderColor: palette.border }]}>
        <Ionicons name="information-circle-outline" size={20} color={shellColors.primary} />
        <View style={styles.flex1}>
          <Text style={[styles.strong, { color: palette.text }]}>
            {needsUpdate ? "Health Connect needs updating" : "Step tracking unavailable"}
          </Text>
          <Text style={[styles.tiny, { color: palette.muted }]}>
            {needsUpdate
              ? "Install or update Health Connect from the Play Store, then come back."
              : "This device doesn't expose a step counter we can read."}
          </Text>
        </View>
        {needsUpdate && (
          <Pressable
            onPress={() => Linking.openURL("market://details?id=com.google.android.apps.healthdata")}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>Open</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!sync.connected) {
    return (
      <View style={[styles.notice, { backgroundColor: palette.soft, borderColor: palette.border }]}>
        <Ionicons name="link-outline" size={20} color={shellColors.primary} />
        <View style={styles.flex1}>
          <Text style={[styles.strong, { color: palette.text }]}>Connect {sync.label}</Text>
          <Text style={[styles.tiny, { color: palette.muted }]}>
            NutriFit reads your daily step totals. Nothing is written back.
          </Text>
          {Boolean(sync.error) && <Text style={styles.error}>{sync.error}</Text>}
        </View>
        <Pressable onPress={sync.connect} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Connect</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.connectedPill, { backgroundColor: palette.soft }]}>
      <View style={styles.liveDot} />
      <Text style={[styles.tiny, { color: palette.muted }]}>
        {sync.syncing ? "Syncing..." : `Connected to ${sync.label}`}
      </Text>
    </View>
  );
}

function Stat({ value, label, palette }) {
  return (
    <View style={styles.flex1}>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.tiny, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ...stepsStyles,

  content: { paddingBottom: 32, gap: 14 },
  flex1: { flex: 1 },
  centered: { textAlign: "center", marginTop: 10 },

  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 4 },

  card: { borderWidth: 1, borderRadius: radii.xl, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },

  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shellColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  heroValue: { fontSize: 28, fontWeight: "800" },
  goalPercent: { fontSize: 18, fontWeight: "800", color: shellColors.primary },

  goalTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  goalFill: { height: 8, borderRadius: 4, backgroundColor: shellColors.primary },

  rangeTabs: { flexDirection: "row", borderRadius: radii.pill, padding: 4 },
  rangeTab: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  rangeText: { fontSize: 13, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 12 },
  statValue: { fontSize: 18, fontWeight: "800" },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  chartPlaceholder: { height: BAR_HEIGHT + 20, alignItems: "center", justifyContent: "center" },
  barColumn: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { width: "100%", borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 10 },

  sectionTitle: { fontSize: 15, fontWeight: "700" },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  recentIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  recentValue: { fontSize: 15, fontWeight: "800" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 14,
  },
  connectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  smallButton: {
    backgroundColor: shellColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  smallButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },

  muted: { fontSize: 12 },
  tiny: { fontSize: 11 },
  strong: { fontSize: 13, fontWeight: "700" },
  error: { fontSize: 12, color: colors.dangerStrong, marginTop: 4 },
});