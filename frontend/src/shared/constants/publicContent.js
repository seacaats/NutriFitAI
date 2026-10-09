// Copy shared by the web and phone public pages

// Landing hero / onboarding welcome
export const HERO = {
  title: "Your Food. Your Fitness. Your Future.",
  tagline: "Scan. Understand. Improve.",
  body: "One app to scan your meals, chat with an AI coach that knows your goals, and track workouts, steps and water.",
};

// Landing page "how it works", web only
export const STEPS = [
  { icon: "person-add-outline", title: "Tell us about you", body: "Your goal, diet and activity level shape every recommendation." },
  { icon: "camera-outline", title: "Scan and log", body: "Snap a meal, log a workout, sync your steps. It takes seconds." },
  { icon: "sparkles-outline", title: "Get coached", body: "Your AI coach turns the numbers into what to do next." },
];

// Landing feature cards and onboarding slides. `tint` is a chipTints key
export const FEATURES = [
  {
    icon: "scan-outline",
    title: "Food Scanner",
    tint: "green",
    body: "Point your camera at a meal and get an instant breakdown of calories, protein, carbs, and fat.",
  },
  {
    icon: "chatbubbles-outline",
    title: "AI Coach",
    tint: "purple",
    body: "Chat with a coach that knows your goals, your diet preference, and any health conditions you've shared.",
  },
  {
    icon: "barbell-outline",
    title: "Workout Tracking",
    tint: "orange",
    body: "Log sessions from a curated routine or a single exercise, and see your history at a glance.",
  },
  {
    icon: "trending-up-outline",
    title: "Progress Tracking",
    tint: "blue",
    body: "Weight, steps, and water intake over time -- so you can see what's actually trending, not just today.",
  },
];

// Terms of Service & Privacy Policy. `icon` heads each section's card
export const TERMS_UPDATED = "September 2026";
export const TERMS_INTRO = "How NutriFitAI works, what it stores about you, and the choices you have.";

export const SECTIONS = [
  {
    title: "1. Using NutriFitAI",
    icon: "person-circle-outline",
    body: "NutriFitAI provides fitness tracking, nutrition guidance, and an AI coaching assistant. By creating an account, you agree to use the service honestly and to keep your login credentials secure.",
  },
  {
    title: "2. Health & Dietary Information",
    icon: "medkit-outline",
    body:
      "During registration and while using your profile, you may choose to share information such as your diet " +
      "preference and any health conditions. We collect and store this information only to personalize your " +
      "nutrition and fitness recommendations -- for example, adjusting meal guidance around a food allergy or a " +
      "medical condition you tell us about.\n\n" +
      "This information is optional. Checking the consent box on the registration form means you agree to let " +
      "NutriFitAI collect, store, and use the dietary and health details you provide for this purpose. You can " +
      "review, edit, or remove this information at any time from your Profile page.",
  },
  {
    title: "3. Other Account & Activity Data",
    icon: "document-text-outline",
    body: "We also store the account details you provide (name, email, age, height, weight) and the activity you log (workouts, weight entries, chats with your AI coach) so the app can show your history and progress over time.",
  },
  {
    title: "4. Data Sharing",
    icon: "share-social-outline",
    body: "We do not sell your personal or health information. Data is used only to operate and improve NutriFitAI, and is shared with service providers solely as needed to run the app (for example, hosting and email delivery).",
  },
  {
    title: "5. Your Choices",
    icon: "options-outline",
    body: "You can update your profile information, change your consent preferences, or request that your account and its data be deleted, at any time from within the app.",
  },
  {
    title: "6. Changes to This Policy",
    icon: "refresh-outline",
    body: "We may update these terms as NutriFitAI evolves. Continuing to use the app after a change means you accept the updated terms.",
  },
];
// "1. Using NutriFitAI" -> ["1", "Using NutriFitAI"], for the numbered cards
export function splitTitle(title) {
  const m = /^(\d+)\.\s*(.*)$/.exec(title);
  return m ? [m[1], m[2]] : ["", title];
}