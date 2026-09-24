import { Pedometer } from "expo-sensors";
import { addDays, daysBetween, eachDay, todayISO } from "./stepDates";

/**
 * iOS step source, and the default this file resolves to on any platform
 * without a more specific implementation.
 *
 * Metro picks the right file by extension -- healthSync.android.js and
 * healthSync.web.js sit alongside this one, exactly like the .web.jsx screens
 * already in this project. Callers write a single import and never branch on
 * Platform.OS, which is what keeps the platform difference in one place instead
 * of scattered through the screens.
 *
 * Backed by CoreMotion's CMPedometer, which records continuously whether or not
 * NutriFit is running. So the app being closed affects how FRESH the data is,
 * never how COMPLETE it is: opening the app on Thursday correctly backfills
 * Monday through Thursday.
 *
 * One hard limit: Apple stores only the past seven days of pedometer history.
 * A start date further back silently returns only what exists, so MAX_BACKFILL_DAYS
 * is set to match rather than pretending otherwise.
 */

export const MAX_BACKFILL_DAYS = 7;

/** Matches the daily_steps_source_check constraint in migration 002. */
export const SOURCE = "healthkit";

/**
 * CMPedometer wants Date objects spanning the local day. Built from the local
 * constructor so midnight means midnight where the user is standing.
 */
function localDayBounds(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

const healthSync = {
  source: SOURCE,

  /** Human label for the connect screen. */
  label: "Apple Health",

  /**
   * True when the device has a pedometer at all. Returns false on the iOS
   * Simulator, which has no CoreMotion sensor -- testing this feature requires
   * a physical iPhone.
   */
  async isAvailable() {
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  },

  /**
   * Triggers the Motion & Fitness prompt.
   *
   * iOS shows this once per install; a later call on a denied permission
   * resolves without re-prompting, which is why the UI must offer a path to
   * Settings rather than just re-asking.
   */
  async requestPermission() {
    try {
      const { granted } = await Pedometer.requestPermissionsAsync();
      return Boolean(granted);
    } catch {
      return false;
    }
  },

  async hasPermission() {
    try {
      const { granted } = await Pedometer.getPermissionsAsync();
      return Boolean(granted);
    } catch {
      return false;
    }
  },

  /**
   * Daily totals for an inclusive range.
   *
   * There is no grouped query in CoreMotion, so this is one call per day --
   * cheap at seven days, and clamped to Apple's retention window so we never
   * issue calls that can only return partial data.
   *
   * Days that error are omitted rather than reported as zero. The distinction
   * survives all the way to the chart: a missing day is a gap, a zero is a
   * claim that the user didn't move.
   *
   * @returns {Promise<Array<{ activityDate: string, stepCount: number }>>}
   */
  async readDailyTotals(fromISO, toISO) {
    const today = todayISO();
    const earliest = addDays(today, -(MAX_BACKFILL_DAYS - 1));
    const start = fromISO < earliest ? earliest : fromISO;
    const end = toISO > today ? today : toISO;

    if (daysBetween(start, end) < 0) return [];

    const results = await Promise.all(
      eachDay(start, end).map(async (isoDate) => {
        const { start: from, end: to } = localDayBounds(isoDate);
        try {
          const result = await Pedometer.getStepCountAsync(from, to);
          const steps = Number(result?.steps);
          if (!Number.isFinite(steps)) return null;
          return { activityDate: isoDate, stepCount: Math.max(0, Math.round(steps)) };
        } catch {
          return null;
        }
      }),
    );

    return results.filter(Boolean);
  },
};

export default healthSync;
