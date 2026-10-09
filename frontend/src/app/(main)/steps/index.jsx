import { RangeTabs, RecentDaysCard, StepGoalCard, StepStats, TodayStepsCard } from "@/features/steps/components/StepCards";
import { StepDayEditModal } from "@/features/steps/components/StepHistory";
import { useDailySteps } from "@/features/steps/hooks/useDailySteps";
import { useStepSync } from "@/features/steps/hooks/useStepSync";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import ScreenHeader from "@/shared/components/layout/ScreenHeader";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenAlert, ScreenError } from "@/shared/components/ui/ScreenAlert";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { formatNumber, todayISO } from "@/shared/utils/dates";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { stepsStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
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
  const router = useRouter();
  // { date, current } while the edit dialog is open
  const [editing, setEditing] = useState(null);
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
    // Reload even when the phone sync fails, or the skeletons would stay
    try {
      await sync.refresh();
    } finally {
      steps.refresh();
    }
  }, [sync, steps]);
  usePullRefresh(onRefresh);

  // The daily goal is the top of every bar. Month and Year bars use steps per
  // day (`avg`) so they compare against that same daily goal
  // First load only: numbers and lists are placeholders the size of what
  // replaces them. Later range switches keep the old content until new data lands
  const first = !steps.loaded;
  const maxSteps = steps.dailyGoal;

  return (
    // The layout scrolls; its pull syncs the phone, then reloads (onRefresh)
    <DashboardLayout hideTabBar screenAlert={false}>
      <View style={styles.content}>
        {/* Opened from the ☰ menu, so no bottom bar; the header has a back arrow */}
        <ScreenHeader title="Steps" subtitle="Your daily movement" />
        <ScreenAlert />

        <ConnectionCard palette={palette} sync={sync} />

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={styles.stepIcon}>
                <Ionicons name="footsteps" size={20} color={colors.white} />
              </View>
              <View>
                <Text style={[styles.kicker, { color: palette.muted }]}>TODAY</Text>
                {first ? <Skeleton width={120} height={32} /> : (
                  <Text style={[styles.heroValue, { color: palette.text }]}>
                    {/* null means "not recorded", which is a different claim from
                        zero steps -- show a dash rather than inventing a 0. */}
                    {steps.todaySteps === null ? "--" : formatNumber(steps.todaySteps)}
                  </Text>
                )}
              </View>
            </View>
            {first ? <Skeleton width={44} height={22} /> : <Text style={styles.goalPercent}>{steps.goalPercent}%</Text>}
          </View>

          <View style={[styles.goalTrack, { backgroundColor: palette.track }]}>
            <View style={[styles.goalFill, { width: `${steps.goalPercent}%` }]} />
          </View>

          {first ? (
            <View style={styles.rowBetween}>
              <Skeleton width={130} height={15} />
              <Skeleton width={80} height={15} />
            </View>
          ) : (
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
          )}
        </View>

        <RangeTabs steps={steps} palette={palette} />

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <StepStats steps={steps} palette={palette} loading={first} />

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
                const hasData = day.avg !== null;
                const height = hasData ? Math.max(4, Math.min(day.avg / maxSteps, 1) * BAR_HEIGHT) : 0;
                return (
                  <View key={day.key} style={styles.barColumn}>
                    <View style={[styles.barTrack, { backgroundColor: palette.track, height: BAR_HEIGHT }]}>
                      {hasData && (
                        <View
                          style={[
                            styles.bar,
                            {
                              height,
                              backgroundColor: day.avg >= steps.dailyGoal ? shellColors.primary : colors.stepsInactiveFill,
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

        <TodayStepsCard
          todaySteps={steps.todaySteps}
          loading={first}
          onSaved={steps.refresh}
          onEdit={() => setEditing({ date: todayISO(), current: steps.todaySteps ?? 0 })}
          style={styles.goalSpacing}
        />
        <StepGoalCard goal={steps.dailyGoal} onSaved={steps.refresh} style={styles.goalSpacing} />

        <RecentDaysCard
          steps={steps}
          palette={palette}
          loading={first}
          sourceLabel={sync.label}
          onEdit={(day) => setEditing({ date: day.activityDate, current: day.stepCount })}
          onHistory={() => router.push("/steps/history")}
        />

        <ScreenError message={steps.error} />
      </View>

      <StepDayEditModal
        visible={Boolean(editing)}
        date={editing?.date}
        current={editing?.current}
        onClose={() => setEditing(null)}
        onSaved={steps.refresh}
      />
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
            NutriFitAI reads your daily step totals. Nothing is written back.
          </Text>
          <ScreenError message={sync.error} />
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


  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  chartPlaceholder: { height: BAR_HEIGHT + 20, alignItems: "center", justifyContent: "center" },
  barColumn: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { width: "100%", borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 10 },

  goalSpacing: { marginBottom: 12 },

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