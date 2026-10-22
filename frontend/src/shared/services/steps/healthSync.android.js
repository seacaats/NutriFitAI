import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

import { addDays, eachDay, todayISO } from "@/shared/utils/dates";

// Maximum steps allowed per day
const MAX_STEPS_PER_DAY = 20000;

/**
 * Android step tracking implementation using Health Connect.
 * Health Connect acts as a centralized datastore aggregating step records from tracking apps.
 */

// Health Connect backfill window
export const MAX_BACKFILL_DAYS = 30;

// Matches the daily_steps_source_check constraint
const SOURCE = "health_connect";

const STEP_PERMISSION = { accessType: "read", recordType: "Steps" };

// Memoized initialization to prevent redundant bridge calls
let initialized = false;
async function ensureInitialized() {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

// Converts local calendar date bounds to ISO datetimes
function localDayBounds(isoDate, endISODate) {
  const [fy, fm, fd] = isoDate.split("-").map(Number);
  const [ty, tm, td] = endISODate.split("-").map(Number);
  return {
    startTime: new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
    endTime: new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
  };
}

const healthSync = {
  source: SOURCE,
  label: "Health Connect",

  /**
   * Checks whether Health Connect is available on the device.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  /** Distinguishes the update-required case so the UI can deep-link to the store. */
  async getAvailability() {
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
        return { available: true, reason: null };
      }
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return { available: false, reason: "update_required" };
      }
      return { available: false, reason: "unsupported" };
    } catch {
      return { available: false, reason: "unsupported" };
    }
  },

  async requestPermission() {
    try {
      if (!(await ensureInitialized())) return false;
      const granted = await requestPermission([STEP_PERMISSION]);
      return Array.isArray(granted)
        && granted.some((p) => p.recordType === "Steps" && p.accessType === "read");
    } catch {
      return false;
    }
  },

  async hasPermission() {
    try {
      if (!(await ensureInitialized())) return false;
      const granted = await getGrantedPermissions();
      return Array.isArray(granted)
        && granted.some((p) => p.recordType === "Steps" && p.accessType === "read");
    } catch {
      return false;
    }
  },

  /** Opens device Health Connect permission settings */
  async openSettings() {
    try {
      await openHealthConnectSettings();
    } catch {
      // Ignore if provider is missing
    }
  },

  /**
   * Reads daily totals for an inclusive range using date-based period grouping.
   * @returns {Promise<Array<{ activityDate: string, stepCount: number }>>}
   */
  async readDailyTotals(fromISO, toISO) {
    if (!(await ensureInitialized())) return [];

    const today = todayISO();
    const earliest = addDays(today, -(MAX_BACKFILL_DAYS - 1));
    const start = fromISO < earliest ? earliest : fromISO;
    const end = toISO > today ? today : toISO;
    if (start > end) return [];

    let buckets;
    try {
      buckets = await aggregateGroupByPeriod({
        recordType: "Steps",
        timeRangeFilter: { operator: "between", ...localDayBounds(start, end) },
        timeRangeSlicer: { period: "DAYS", length: 1 },
      });
    } catch {
      return [];
    }

    // Maps buckets by index against requestedDays to preserve local calendar alignment across timezones
    const requestedDays = eachDay(start, end);

    return (buckets || [])
      .map((bucket, index) => {
        const total = bucket?.result?.COUNT_TOTAL;
        if (!Number.isFinite(Number(total))) return null;

        const activityDate = requestedDays[index];
        if (!activityDate) return null;

        return { activityDate, stepCount: Math.min(MAX_STEPS_PER_DAY, Math.max(0, Math.round(Number(total)))) };
      })
      // Omit zero/empty buckets to preserve data gaps rather than recording zero steps
      .filter((day) => day && day.stepCount > 0);
  },
};

export default healthSync;
