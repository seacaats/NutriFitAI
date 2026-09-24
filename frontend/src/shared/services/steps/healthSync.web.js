/**
 * The step screen on web is a READER: it renders whatever the phone has already
 * synced to the server, and shows a "connect your phone" empty state when
 * tracking.connectedAt is null
 */

export const MAX_BACKFILL_DAYS = 0;
export const SOURCE = null;

const healthSync = {
  source: null,
  label: "Mobile app",

  async isAvailable() {
    return false;
  },

  async getAvailability() {
    return { available: false, reason: "web" };
  },

  async requestPermission() {
    return false;
  },

  async hasPermission() {
    return false;
  },

  async openSettings() {},

  async readDailyTotals() {
    return [];
  },
};

export default healthSync;
