import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { QUIET_END, QUIET_START } from "@/shared/components/ui/TimeStepper";
import {
  decimalOrNull,
  GLASS_ML,
  NO_WORKOUT_PREFS,
  NUTRITION_GOAL_FIELDS,
  nutritionGoalProblem,
  STEP_GOAL,
  suggestCalories,
  WATER_GOAL,
  weightTargetProblem,
} from "@/shared/constants/goalOptions";
import { useAuth } from "@/shared/context/AuthContext";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/**
 * The onboarding (/onboarding), shown once after the first verified sign-in.
 *
 * Every step is optional. "Next" keeps a step's answers, "Skip" leaves them
 * out, and only kept steps are sent. Either way PUT /profile/onboarding marks
 * the account onboarded, so the wizard isn't shown again; everything stays
 * editable from Profile, Settings and each screen's goal card
 */

export const ONBOARDING_STEPS = [
  { key: "nutrition", title: "Daily nutrition", subtitle: "Calories and macros to aim for. Leave any empty for none." },
  { key: "workouts", title: "Workouts you like", subtitle: "Exercises that match show first on the Workouts screen. Everything else is still there." },
  { key: "steps", title: "Daily steps", subtitle: "Steps to aim for each day." },
  { key: "water", title: "Daily water", subtitle: `Glasses of ${GLASS_ML} ml to drink each day.` },
  { key: "weight", title: "Target weight", subtitle: "Where you'd like to be, and how fast. Both optional, and you can change them on Progress." },
  { key: "coach", title: "Coach tone", subtitle: "How Nori, your AI coach, talks to you. Change it any time from the AI Coach screen." },
  { key: "quiet", title: "Quiet hours", subtitle: "No reminders in this window. Your sleep hours work well." },
  { key: "security", title: "Two-factor authentication", subtitle: "Optional. We email you a code each time you sign in, so a stolen password isn't enough. Turn it on or off any time in Settings." },
  { key: "review", title: "All set?", subtitle: "Check your answers. You can change any of them later." },
];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// The wizard's answers, starting from whatever the account already has
function initialAnswers(profile) {
  const goals = profile?.goals || {};
  const prefs = profile?.notificationPrefs || {};
  return {
    nutrition: Object.fromEntries(NUTRITION_GOAL_FIELDS.map((f) => [f.key, goals[f.key] ? String(goals[f.key]) : ""])),
    workoutPrefs: profile?.workoutPrefs || NO_WORKOUT_PREFS,
    dailySteps: goals.dailySteps || STEP_GOAL.default,
    waterGlasses: goals.dailyWaterMl
      ? clamp(Math.round(goals.dailyWaterMl / GLASS_ML), WATER_GOAL.minGlasses, WATER_GOAL.maxGlasses)
      : WATER_GOAL.minGlasses,
    targetWeight: profile?.targetWeightKg ? String(profile.targetWeightKg) : "",
    weeklyPace: profile?.weeklyPaceKg ? String(profile.weeklyPaceKg) : "",
    coachTone: profile?.coachTone ?? null,
    quietOn: Boolean(prefs.quietStart),
    quietStart: prefs.quietStart || QUIET_START,
    quietEnd: prefs.quietEnd || QUIET_END,
    // Turned on from the step itself (it saves right away, not with the rest)
    mfaOn: Boolean(profile?.mfaEnabled),
  };
}

// The request body: only steps the user kept, as the API's field names
function buildBody(answers, kept, profile) {
  const body = {};
  if (kept.has("nutrition")) {
    for (const f of NUTRITION_GOAL_FIELDS) {
      const text = answers.nutrition[f.key];
      // An emptied field clears a saved target; one that was never set is left out
      if (text) body[f.key] = Number(text);
      else if (profile?.goals?.[f.key] != null) body[f.key] = null;
    }
  }
  if (kept.has("workouts")) body.workoutPrefs = answers.workoutPrefs;
  if (kept.has("steps")) body.dailySteps = answers.dailySteps;
  if (kept.has("water")) body.dailyWaterMl = answers.waterGlasses * GLASS_ML;
  if (kept.has("weight")) {
    body.targetWeightKg = decimalOrNull(answers.targetWeight);
    body.weeklyPaceKg = decimalOrNull(answers.weeklyPace);
  }
  // null (none picked) clears a saved tone, back to the default voice
  if (kept.has("coach")) body.coachTone = answers.coachTone;
  if (kept.has("quiet")) {
    const prefs = profile?.notificationPrefs || {};
    body.notificationPrefs = {
      reminders: prefs.reminders ?? true,
      achievements: prefs.achievements ?? true,
      quietStart: answers.quietOn ? answers.quietStart : null,
      quietEnd: answers.quietOn ? answers.quietEnd : null,
    };
  }
  return body;
}

// "" when the step's answers can be kept, else what's wrong
function stepProblem(key, answers) {
  if (key === "nutrition") return nutritionGoalProblem(answers.nutrition);
  if (key === "weight") return weightTargetProblem(answers.targetWeight, answers.weeklyPace);
  return "";
}

// What Skip clears on a step: its picked choices go back to unpicked.
// Workouts go back to "Any", the catalog's own fallback. Steppers and typed
// numbers are left as they are, they're not saved on Skip anyway
const SKIP_CLEARS = {
  workouts: { workoutPrefs: NO_WORKOUT_PREFS },
  weight: { weeklyPace: "" },
  coach: { coachTone: null },
  quiet: { quietOn: false },
};

export function useOnboarding() {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [answers, setAnswers] = useState(() => initialAnswers(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  // Steps whose answers will be saved (left with Next, not Skip)
  const [kept, setKept] = useState(() => new Set());

  useEffect(() => {
    apiClient.get("/profile", { auth: true })
      .then((data) => {
        setProfile(data);
        setAnswers(initialAnswers(data));
      })
      .catch(() => {}) // Starts from the defaults instead
      .finally(() => setLoading(false));
  }, []);

  const step = ONBOARDING_STEPS[index];
  const isReview = step.key === "review";

  const update = useCallback((changes) => {
    setAnswers((a) => ({ ...a, ...changes }));
    setError("");
  }, []);

  const mark = (key, keep) => setKept((current) => {
    const next = new Set(current);
    if (keep) next.add(key);
    else next.delete(key);
    return next;
  });

  const goTo = (i) => {
    setError("");
    setIndex(clamp(i, 0, ONBOARDING_STEPS.length - 1));
  };

  function next() {
    const problem = stepProblem(step.key, answers);
    if (problem) {
      setError(problem);
      return;
    }
    mark(step.key, true);
    goTo(index + 1);
  }

  function skip() {
    if (SKIP_CLEARS[step.key]) update(SKIP_CLEARS[step.key]);
    mark(step.key, false);
    goTo(index + 1);
  }

  // Saves, then returns to the dashboard it was opened over (or opens it, when
  // /onboarding was reached directly). The session is refreshed first, so the
  // dashboard sees the account as onboarded
  async function submit(body) {
    setSaving(true);
    setError("");
    try {
      await apiClient.put("/profile/onboarding", body, { auth: true });
      await refreshAuth();
      if (router.canGoBack()) router.back();
      else router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your setup. Please try again.");
      setSaving(false);
    }
  }

  const finish = () => submit(buildBody(answers, kept, profile));
  const skipAll = () => submit({});

  return {
    steps: ONBOARDING_STEPS,
    step,
    index,
    isReview,
    answers,
    kept,
    profile,
    suggestedKcal: profile ? suggestCalories(profile) : null,
    loading,
    saving,
    error,
    clearError: () => setError(""),
    update,
    next,
    skip,
    back: () => goTo(index - 1),
    goTo,
    finish,
    skipAll,
  };
}