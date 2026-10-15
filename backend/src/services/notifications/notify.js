const User = require('../../models/user/User');
const Notification = require('../../models/notifications/Notification');
const { sendPush } = require('./pushSender');
const { sendNoticeEmail } = require('../mailer');
const { today } = require('../../utils/calendarDay');

// Every notification the app sends, by type. Push text shows on the lock
// screen, so it never carries health values or names: "Time for some water",
// not "You're 800 ml short".
//
//   category  reminders / achievements follow the user's switches; coach
//             only the master switch; account always goes out. Everything
//             but account is for role "user" only: admins have no logs,
//             goals or coach (it's their warning about changes
//             they may not have made)
//   inbox     shown under the bell. false = recorded only for the daily
//             limit and dedupe
//   push      sent to the user's devices
//   email     account notices only: { subject, title, intro, note? }
const NOTIFICATION_TYPES = {
  // ---- reminders (reminders.js) ----
  workout_reminder: {
    category: 'reminders',
    inbox: true,
    push: true,
    title: 'Workout coming up',
    // "soon", not a number: a session planned at short notice is reminded
    // with less than 30 minutes to go (reminders.js)
    body: 'Your planned workout starts soon.',
    link: '/workouts?tab=upcoming',
  },
  water_reminder: {
    category: 'reminders',
    inbox: true,
    push: true,
    title: 'Time for some water',
    body: "You're behind on today's water goal.",
    link: '/water',
  },
  meal_reminder: {
    category: 'reminders',
    inbox: true,
    push: true,
    title: 'Log your meals',
    body: "Nothing's logged for today yet.",
    link: '/food-scanner',
  },
  steps_reminder: {
    category: 'reminders',
    inbox: true,
    push: true,
    title: 'Steps check',
    body: "There's still time to reach today's step goal.",
    link: '/steps',
  },

  // ---- achievements (waterController, stepsController) ----
  water_goal_reached: {
    category: 'achievements',
    inbox: true,
    push: true,
    title: 'Water goal reached',
    body: "You hit today's water goal. Nice work.",
    link: '/water',
  },
  steps_goal_reached: {
    category: 'achievements',
    inbox: true,
    push: true,
    title: 'Step goal reached',
    body: "You hit today's step goal. Nice work.",
    link: '/steps',
  },

  // ---- streaks (reminders.js) ----
  // A day counts when anything was logged: a meal, steps or a workout
  streak_3: {
    category: 'achievements',
    inbox: true,
    push: true,
    title: '3-day streak',
    body: "You've logged something 3 days in a row. Keep it going.",
    link: '/progress',
  },
  streak_7: {
    category: 'achievements',
    inbox: true,
    push: true,
    title: '7-day streak',
    body: 'A full week of logging. Nice work.',
    link: '/progress',
  },
  streak_30: {
    category: 'achievements',
    inbox: true,
    push: true,
    title: '30-day streak',
    body: '30 days in a row. That habit is sticking.',
    link: '/progress',
  },

  // ---- coach (coachController) ----
  // Only when the user likely left before the reply arrived. Never the
  // reply text: it can carry health details
  coach_reply: {
    category: 'coach',
    inbox: true,
    push: true,
    title: 'Your coach replied',
    body: 'Open the chat to read it.',
    link: '/ai-coach',
  },

  // ---- account (auth, profile and admin controllers) ----
  password_changed: {
    category: 'account',
    inbox: true,
    title: 'Your password was changed',
    body: 'Your password was changed from Settings.',
    link: '/settings',
    email: {
      subject: 'Your NutriFitAI password was changed',
      title: 'Your password was changed',
      intro: 'The password for your NutriFitAI account was just changed from Settings.',
    },
  },
  mfa_enabled: {
    category: 'account',
    inbox: true,
    title: 'Two-factor sign-in is on',
    body: 'Signing in now asks for a code from your authenticator app.',
    link: '/settings',
    email: {
      subject: 'Two-factor sign-in was turned on',
      title: 'Two-factor sign-in is on',
      intro: 'Two-factor sign-in was just turned on for your NutriFitAI account.',
    },
  },
  mfa_disabled: {
    category: 'account',
    inbox: true,
    title: 'Two-factor sign-in is off',
    body: 'Two-factor sign-in was turned off from Settings.',
    link: '/settings',
    email: {
      subject: 'Two-factor sign-in was turned off',
      title: 'Two-factor sign-in is off',
      intro: 'Two-factor sign-in was just turned off for your NutriFitAI account.',
    },
  },
  mfa_recovery_used: {
    category: 'account',
    inbox: true,
    title: 'A recovery code was used',
    body: 'A recovery code was used to sign in. Generate new ones in Settings if you are running low.',
    link: '/settings',
    email: {
      subject: 'A recovery code was used to sign in',
      title: 'A recovery code was used',
      intro: 'A one-time recovery code was just used to sign in to your NutriFitAI account.',
    },
  },
  password_reset: {
    category: 'account',
    inbox: true,
    title: 'Your password was reset',
    body: 'Your password was reset with a code sent to your email.',
    link: '/settings',
    email: {
      subject: 'Your NutriFitAI password was reset',
      title: 'Your password was reset',
      intro: 'The password for your NutriFitAI account was just reset using a code sent to this email.',
    },
  },
  google_linked: {
    category: 'account',
    inbox: true,
    title: 'Google account linked',
    body: 'You can now sign in with Google.',
    link: '/settings',
    email: {
      subject: 'A Google account was linked to NutriFitAI',
      title: 'Google account linked',
      intro: 'A Google account was linked to your NutriFitAI account. You can now sign in with it.',
    },
  },
  account_suspended: {
    category: 'account',
    // No inbox: a suspended user can't sign in to read it
    inbox: false,
    email: {
      subject: 'Your NutriFitAI account has been suspended',
      title: 'Your account has been suspended',
      intro: "Your NutriFitAI account has been suspended by an administrator. You won't be able to sign in until it's reinstated.",
      note: 'If you think this is a mistake, contact support.',
    },
  },
  account_reinstated: {
    category: 'account',
    inbox: true,
    title: 'Your account was reinstated',
    body: 'Your account is active again.',
    link: '/dashboard',
    email: {
      subject: 'Your NutriFitAI account was reinstated',
      title: 'Your account was reinstated',
      intro: 'Your NutriFitAI account is active again. You can sign in as usual.',
      note: 'Welcome back.',
    },
  },
  password_reset_required: {
    category: 'account',
    inbox: false,
    email: {
      subject: 'Reset your NutriFitAI password',
      title: 'A password reset is required',
      intro: 'An administrator has required a new password for your NutriFitAI account. Use "Forgot password" on the sign-in page to set one.',
      note: 'Until then, signing in with your old password is refused.',
    },
  },
  account_deleted: {
    category: 'account',
    // Email only: the account and its inbox are gone
    inbox: false,
    email: {
      subject: 'Your NutriFitAI account was deleted',
      title: 'Your account was deleted',
      intro: 'Your NutriFitAI account and its data have been deleted.',
      note: "If you didn't expect this, contact support.",
    },
  },
  password_reset_cancelled: {
    category: 'account',
    inbox: true,
    title: 'Password reset no longer required',
    body: 'You can sign in with your current password again.',
    link: '/settings',
    email: {
      subject: 'You can sign in to NutriFitAI again',
      title: 'Password reset no longer required',
      intro: 'An administrator cancelled the password reset on your NutriFitAI account. You can sign in with your current password.',
      note: "If you didn't expect this, change your password from Settings.",
    },
  },
  name_changed_by_admin: {
    category: 'account',
    inbox: true,
    title: 'Your name was updated',
    body: 'An administrator updated the name on your account.',
    link: '/profile',
  },
  role_changed: {
    category: 'account',
    inbox: true,
    title: 'Your account role changed',
    body: 'Your account role was changed by an administrator.',
    link: '/dashboard',
  },
};

// Reminder pushes per user per day, across the automatic reminder types.
// Workout reminders don't count: the user scheduled those themselves
const DAILY_REMINDER_LIMIT = 4;
const UNLIMITED_REMINDERS = ['workout_reminder'];

// "HH:MM" in the user's zone, 24-hour
function localTime(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('hour')}:${get('minute')}`;
}

// True inside quiet hours. A window can cross midnight (22:00 to 07:00)
function inQuietHours(prefs, timeZone, at = new Date()) {
  if (!prefs?.quietStart || !prefs?.quietEnd) return false;
  const now = localTime(timeZone, at);
  const { quietStart: start, quietEnd: end } = prefs;
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Sends one notification. The only way anything in the app notifies a user.
 *
 * Never throws and is safe to call without awaiting, same contract as
 * logAction: a failed notification must not fail the action it's about.
 *
 * @param {string|null} userId  null only for account_deleted (pass options.email)
 * @param {string} type         a key of NOTIFICATION_TYPES
 * @param {{ user?: object, email?: string, dedupeKey?: string }} [options]
 *   user       the user document, when the caller already has it (the scheduler)
 *   email      where to send the email when there is no user any more
 *   dedupeKey  "water:2026-10-04:midday". The same key never sends twice
 */
async function notify(userId, type, options = {}) {
  try {
    const def = NOTIFICATION_TYPES[type];
    if (!def) throw new Error(`Unknown notification type "${type}"`);

    const user = options.user || (userId ? await User.getById(userId) : null);
    const profile = user?.profile || {};
    const timeZone = profile.timezone || 'UTC';

    // Quiet hours hold back the push only. The inbox row is still written,
    // so an achievement at 11 PM is waiting under the bell in the morning
    let quiet = false;

    // Account notices skip every check below
    if (def.category !== 'account') {
      if (!user || user.suspendedAt) return;
      // Covers callers that don't filter by role, like workout reminders
      // for a user since promoted
      if (user.role !== 'user') return;
      if (profile.notificationsEnabled === false) return;
      if (profile.notificationPrefs?.[def.category] === false) return;
      // Every user-facing type keeps an inbox row, so quiet hours only hold
      // back the push; a type without one would be dropped, not queued
      quiet = inQuietHours(profile.notificationPrefs, timeZone);
      if (quiet && !def.inbox) return;
      if (def.category === 'reminders' && !UNLIMITED_REMINDERS.includes(type)
        && await Notification.countToday(user.id, 'reminders', today(timeZone), UNLIMITED_REMINDERS) >= DAILY_REMINDER_LIMIT) return;
    }

    // The row comes first: it's the dedupe. null = this key was already sent
    if (user && (def.inbox || def.push)) {
      const row = await Notification.record({
        userId: user.id,
        type,
        category: def.category,
        title: def.title,
        body: def.body,
        link: def.link || null,
        inInbox: def.inbox,
        day: today(timeZone),
        dedupeKey: options.dedupeKey || null,
      });
      if (!row) return;
    }

    if (def.push && user && !quiet) {
      await sendPush({ userId: user.id, kind: type, title: def.title, body: def.body, link: def.link || null });
    }

    const to = options.email || user?.email;
    if (def.email && to) await sendNoticeEmail(to, def.email);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed to send', type, err);
  }
}

module.exports = { notify, localTime };