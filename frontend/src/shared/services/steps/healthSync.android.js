import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

import { addDays, eachDay, todayISO } from "./stepDates";

/**
 * Android step source, backed by Health Connect
 * Same four-function contract as the iOS file so the screens never branch.
 * Note that Health Connect is a STORE. So other applications that use it
 * to actually record is important to sync besides this application
 */

// Health Connect keeps far more history than iOS; 30 days covers the UI
export const MAX_BACKFILL_DAYS = 30;

// Matches the daily_steps_source_check constraint
export const SOURCE = "health_connect";

export const EMPTY_STORE_HINT =
  "Health Connect has no step data yet. Steps are written by apps like Samsung Health, Fitbit or Google Fit — install and open one, then sync again.";

const STEP_PERMISSION = { accessType: "read", recordType: "Steps" };

// initialize() is idempotent but not free; memoised so every call isn't a bridge hop
let initialized = false;
async function ensureInitialized() {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

/**
 * Health Connect wants ISO datetimes. Local-midnight bounds, so a day means the
 * user's day.
 */
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
   * Three outcomes, not two.
   *
   * "Needs an update" is a distinct status from "unavailable", and it is
   * actionable: on Android below 14 Health Connect is a Play Store app the user
   * can install. Collapsing it into a generic failure is the same mistake as
   * showing "something went wrong" for a Huawei device with no Play Services.
   *
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
      // Returns the permissions actually granted, which may be an empty array
      // if the user declined — a resolved promise is not consent.
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

  /** Health Connect permissions are revoked from its own settings screen, not ours. */
  async openSettings() {
    try {
      await openHealthConnectSettings();
    } catch {
      // Non-fatal: the button just does nothing if the provider is missing.
    }
  },

  /**
   * Daily totals for an inclusive range, in ONE call.
   *
   * `period: "DAYS"` rather than a fixed 24-hour Duration is deliberate: a
   * Period is date-based, so it respects calendar boundaries and daylight
   * saving instead of drifting an hour twice a year.
   *
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

    // BUG FIX (steps not appearing on Android): this used to derive
    // `activityDate` by slicing `bucket.startTime` from the response, e.g.
    // `String(bucket.startTime).slice(0, 10)`. `aggregateGroupByPeriod`
    // returns each bucket's startTime as a full ISO instant, and for a user
    // west of UTC (any negative offset) a bucket whose LOCAL day is, say,
    // "2026-09-19" can have a UTC instant that still reads "2026-09-19T0X:.."
    // only near UTC; for the many users whose offset pushes local midnight to
    // a different UTC calendar day, slicing gave a date one day off from the
    // one requested. Because the request window was itself built from local
    // calendar dates (`eachDay(start, end)`) with exactly one bucket per day
    // in order (`timeRangeSlicer: { period: "DAYS", length: 1 }`), the
    // reliable source of truth for which day a bucket belongs to is its
    // position in the request, not a re-parse of the response's timestamp.
    // Since `useDailySteps` buckets rows by exact activityDate string match
    // against the days it expects to see, a shifted date meant the row never
    // matched any expected day and silently vanished from every chart/stat on
    // the mobile Steps screen -- this is the most likely root cause of "no
    // step data shows on mobile" for users not on UTC.
    const requestedDays = eachDay(start, end);

    return (buckets || [])
      .map((bucket, index) => {
        const total = bucket?.result?.COUNT_TOTAL;
        if (!Number.isFinite(Number(total))) return null;

        const activityDate = requestedDays[index];
        if (!activityDate) return null;

        return { activityDate, stepCount: Math.max(0, Math.round(Number(total))) };
      })
      // Buckets with no samples are dropped rather than zeroed: same reasoning
      // as iOS, a gap is not a claim of zero movement.
      .filter((day) => day && day.stepCount > 0);
  },
};

export default healthSync;