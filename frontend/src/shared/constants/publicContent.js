// Copy shared by the web and phone public pages

// Landing hero / onboarding welcome
export const HERO = {
  title: "Your Food. Your Fitness. Your Future.",
  tagline: "Scan. Understand. Improve.",
  body: "One app to scan your meals, chat with an AI coach that knows your goals, and track workouts, steps and water.",
};

// Landing page "how it works", web only
export const STEPS = [
  { icon: "person-add-outline", title: "Tell us about you", body: "Share your goal, diet and activity level, plus any allergies or health conditions. Everything you see is shaped by it." },
  { icon: "camera-outline", title: "Scan and log", body: "Snap a meal, log a workout, add your water and sync your steps. Each one takes a few seconds." },
  { icon: "sparkles-outline", title: "Get coached", body: "Your AI coach reads your numbers and tells you what to do next, in a tone you choose." },
];

// Landing feature cards and onboarding slides. `tint` is a chipTints key
export const FEATURES = [
  {
    icon: "scan-outline",
    title: "Food Scanner",
    tint: "green",
    body: "Snap a photo of your meal and get the calories, protein, carbs and fat in each serving. Save it as breakfast, lunch, dinner or a snack, and see how your day compares to your daily targets.",
  },
  {
    icon: "chatbubbles-outline",
    title: "AI Coach",
    tint: "purple",
    body: "Ask anything about food, workouts or progress. Your coach already knows your goals, diet and any health conditions you've shared, and replies in the tone you pick: friendly, direct or motivational.",
  },
  {
    icon: "barbell-outline",
    title: "Workout Tracking",
    tint: "orange",
    body: "Browse routines and single exercises, filtered by the equipment you have. Log each session as you go, save your favorites, and look back at past workouts any time.",
  },
  {
    icon: "trending-up-outline",
    title: "Progress Tracking",
    tint: "blue",
    body: "Track your weight against your target, sync your steps and count your glasses of water. Charts show the trend over weeks, and gentle reminders nudge you when a goal is slipping.",
  },
];

// Terms of Service & Privacy Policy. `icon` heads each section's card
export const TERMS_UPDATED = "October 2026";
export const TERMS_INTRO = "The short version: we use your info to run and personalize the app, we don't sell it, and you stay in control.";

export const SECTIONS = [
  {
    title: "1. The Basics",
    icon: "person-circle-outline",
    body:
      "NutriFitAI helps you track food, workouts, and progress, with an AI coach to guide you. To use it, you need to be 13 or older and verify your email. Accounts that aren't verified within 48 hours are deleted.\n\n" +
      "Please give accurate info, keep your password to yourself, and use the app honestly. We may suspend accounts that break these rules or put others at risk. We save the time you accepted these terms.",
  },
  {
    title: "2. Not Medical Advice",
    icon: "warning-outline",
    body:
      "NutriFitAI is a wellness app, not a doctor. Scan results are estimates, and the AI coach can make mistakes. " +
      "Check with a doctor or dietitian before big changes to how you eat or train, especially if you have a health condition, are pregnant, or are under 18. " +
      "If something hurts or feels wrong, stop and get help.",
  },
  {
    title: "3. What We Collect",
    icon: "document-text-outline",
    body:
      "• Account: your name, email, and a password (we only keep a scrambled version). With Google sign-in, we also get your Google ID and profile picture.\n" +
      "• Profile: age, sex, height, activity level, goals, target weight, time zone, and your app settings.\n" +
      "• Activity: weight, water, steps, workouts, meals, food scan photos, and your coach chats.\n" +
      "• Technical: your device's notification token, the days you open the app, and sign-in records (with IP address and device info) for security.",
  },
  {
    title: "4. Health & Diet Info",
    icon: "medkit-outline",
    body:
      "Sharing your diet, health conditions, and body measurements is optional. We use it for one thing: tailoring food, workout, and coaching tips to you, like working around an allergy. Because it's sensitive, we handle it with extra care.\n\n" +
      "By checking the consent box when you sign up, you let us store and use it for this. You can change or remove it anytime in your Profile.",
  },
  {
    title: "5. Permissions",
    icon: "camera-outline",
    body:
      "We only ask when a feature needs it:\n" +
      "• Camera and photos: to scan food and set a profile picture.\n" +
      "• Activity or health access: to read your daily step count from your phone, Apple Health, or Health Connect. Steps only, nothing else.\n\n" +
      "You can turn these off in your device settings. Only the related feature stops working.",
  },
  {
    title: "6. Scanner & AI Coach",
    icon: "sparkles-outline",
    body:
      "Food scanner: your photo goes to our food detection service, which finds the foods and estimates their nutrition. We keep the photo so you can look back at it, then delete it after 90 days. Your nutrition results stay. Deleting a scan removes its photo right away.\n\n" +
      "AI coach: to answer you, we send your message plus a short summary of your info to an AI model. That can include your first name, age range, sex, height, weight, diet, health notes, goals, and recent steps, water, workouts, and meals. It never includes your email, last name, or password. Answers may come from our own AI server or from outside AI services we use as backup. For under-18s, the coach sticks to general healthy habits.",
  },
  {
    title: "7. Who Sees Your Data",
    icon: "share-social-outline",
    body:
      "We don't sell your personal or health information. We only share what's needed to run the app, with:\n" +
      "• Hosting and storage providers, including Cloudflare for photos\n" +
      "• An email service, for verification and reset codes\n" +
      "• Expo, to send push notifications\n" +
      "• Google, if you sign in with it\n" +
      "• AI services, for the coach (see above)\n\n" +
      "Our admins can see basic account details like name, email, and role, and can suspend or delete accounts. Their actions are logged. We may also share data if the law requires it.",
  },
  {
    title: "8. How Long We Keep It",
    icon: "time-outline",
    body:
      "Most of your data stays until you delete it or your account. A few things clear out on their own:\n" +
      "• Scan photos: 90 days\n" +
      "• Coach chats: 180 days\n" +
      "• Notifications: 90 days\n" +
      "• App-visit records: about 13 months\n" +
      "• Unverified accounts: 48 hours\n" +
      "• Email codes: 10 minutes\n\n" +
      "Security logs of sign-ins and account actions are kept for 1 to 3 years, depending on the event. They stay after you delete your account and are used only for security.",
  },
  {
    title: "9. Keeping You Safe",
    icon: "lock-closed-outline",
    body:
      "• Passwords and email codes are stored scrambled, never as plain text.\n" +
      "• You stay signed in with a secure cookie on web, or a token on your phone. \"Remember me\" lasts up to 30 days, otherwise 3 days.\n" +
      "• So the app still works when your connection drops, it saves your recent screens on your device. Signing out clears them.\n\n" +
      "Use a strong, unique password and sign out on shared devices. If you think someone got into your account, change your password right away.",
  },
  {
    title: "10. Your Choices",
    icon: "options-outline",
    body:
      "In the app, you can:\n" +
      "• Edit your profile and health info\n" +
      "• Change your goals and notification settings\n" +
      "• Delete scans, meals, and chats one by one\n" +
      "• Change or reset your password\n\n" +
      "Want to leave? Delete your account in Settings (you'll confirm with your password). This permanently erases your profile, logs, meals, scans, photos, chats, notifications, and device tokens.\n\n" +
      "In the Philippines, the Data Privacy Act of 2012 also gives you the right to access, correct, and erase your data, and to complain to the National Privacy Commission.",
  },
  {
    title: "11. Changes",
    icon: "refresh-outline",
    body: "We'll update this page when NutriFitAI changes, and change the date above when we do. If you keep using the app afterward, you're agreeing to the new version.",
  },
];
// "1. Using NutriFitAI" -> ["1", "Using NutriFitAI"], for the numbered cards
export function splitTitle(title) {
  const m = /^(\d+)\.\s*(.*)$/.exec(title);
  return m ? [m[1], m[2]] : ["", title];
}