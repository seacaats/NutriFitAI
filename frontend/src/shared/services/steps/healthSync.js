import { addDays, daysBetween, eachDay, todayISO } from "@/shared/utils/dates";
import { Pedometer } from "expo-sensors";

// Maximum steps allowed per day
const MAX_STEPS_PER_DAY = 20000;

/**
 * iOS step tracking implementation using CoreMotion CMPedometer.
 * Apple stores up to 7 days of historical pedometer data.
 */

export const MAX_BACKFILL_DAYS = 7;

/** Matches the daily_steps_source_check constraint in migration 002. */
const SOURCE = "healthkit";

// Converts local calendar date to local start and end of day Date objects
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
   * Checks whether the device hardware includes a pedometer sensor.
   */
  async isAvailable() {
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  },

  /**
   * Triggers the iOS Motion & Fitness permission prompt.
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
   * Reads daily step totals for an inclusive range via CoreMotion.
   * Days with errors are omitted to represent data gaps.
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
          return { activityDate: isoDate, stepCount: Math.min(MAX_STEPS_PER_DAY, Math.max(0, Math.round(steps))) };
        } catch {
          return null;
        }
      }),
    );

    return results.filter(Boolean);
  },
};

export default healthSync;
