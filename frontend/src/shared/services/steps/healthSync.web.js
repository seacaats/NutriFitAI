/**
 * Web stub for step tracking. Web reads synced step data from the API
 * without direct hardware sensor access.
 */

export const MAX_BACKFILL_DAYS = 0;

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
