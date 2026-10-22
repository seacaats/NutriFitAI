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
    tag: "01 / SCAN",
    tint: "green",
    body: "Snap a photo of your meal and get the calories, protein, carbs and fat in each serving. Save it as breakfast, lunch, dinner or a snack, and see how your day compares to your daily targets.",
  },
  {
    icon: "chatbubbles-outline",
    title: "AI Coach",
    tag: "02 / COACH",
    tint: "purple",
    body: "Ask anything about food, workouts or progress. Your coach already knows your goals, diet and any health conditions you've shared, and replies in the tone you pick: friendly, direct or motivational.",
  },
  {
    icon: "barbell-outline",
    title: "Workout Tracking",
    tag: "03 / TRAIN",
    tint: "orange",
    body: "Browse single exercises and create routines, filtered by the equipment you have. Log each session as you go, save your favorites, and look back at past workouts any time.",
  },
  {
    icon: "trending-up-outline",
    title: "Progress Tracking",
    tag: "04 / TRACK",
    tint: "blue",
    body: "Track your weight against your target, sync your steps and count your glasses of water. Charts show the trend over weeks, and gentle reminders nudge you when a goal is slipping.",
  },
];

// Landing page previews, web only. Sample data for the interactive demos, not real user data
export const SCAN_MEALS = [
  { id: "adobong_manok", name: "Chicken Adobo", sub: "1 cup · sample result", kcal: 280, icon: "restaurant-outline", protein: { g: 28, pct: 40 }, carbs: { g: 4, pct: 6 }, fat: { g: 16, pct: 51 } },
  { id: "sinigang_na_baboy", name: "Pork Sinigang", sub: "1 cup · sample result", kcal: 280, icon: "cafe-outline", protein: { g: 18, pct: 26 }, carbs: { g: 8, pct: 11 }, fat: { g: 20, pct: 64 } },
  { id: "fried_boneless_bangus", name: "Fried Bangus", sub: "100g · sample result", kcal: 240, icon: "fish-outline", protein: { g: 20, pct: 33 }, carbs: { g: 0, pct: 0 }, fat: { g: 17, pct: 64 } },
  { id: "mango", name: "Mango", sub: "1 medium · sample result", kcal: 130, icon: "nutrition-outline", protein: { g: 1, pct: 3 }, carbs: { g: 35, pct: 100 }, fat: { g: 0.6, pct: 4 } },
];

// Share of the daily target each meal slot fills in the ring
export const MEAL_SLOTS = [
  { label: "Breakfast", share: 0.4 },
  { label: "Lunch", share: 0.65 },
  { label: "Dinner", share: 0.87 },
  { label: "Snack", share: 0.75 },
];

// One reply per coach tone, the same meal in each voice
export const COACH_REPLIES = [
  { key: "friendly", label: "Friendly", text: "Great choice with Chicken Adobo! You just hit 28g of protein. Drink 1 glass of water before your 4 PM dumbbell session, you got this!" },
  { key: "direct", label: "Direct", text: "280 kcal logged. Remaining today: 64g protein, 1,120 kcal. Next action: 30-min Upper Body routine + 500 ml water." },
  { key: "motivational", label: "Motivational", text: "Solid protein, watch the sodium in the sauce! Hit 3 extra glasses of water this afternoon and don't skip your last set of squats." },
];

// Two picks per equipment choice: [name, sets and reps]
export const WORKOUT_PICKS = {
  Dumbbells: [["DB Goblet Squat", "3 sets × 12 reps"], ["Seated Shoulder Press", "3 sets × 10 reps"]],
  Bodyweight: [["Tempo Push-Ups", "3 sets × 12 reps"], ["Walking Lunges", "3 sets × 10 reps"]],
  "Full Gym (Several Equipments)": [["Barbell Bench Press", "3 sets × 12 reps"], ["Lat Pulldown", "3 sets × 10 reps"]],
};

// "How it works" demo choices
export const DEMO_GOALS = ["Lose Weight", "Build Muscle", "Improve Fitness"];
export const DEMO_DIETS = ["High Protein", "Balanced", "Low Carb"];

// Terms of Service & Privacy Policy. `icon` heads each section's card
export const TERMS_UPDATED = "October 2026";
export const TERMS_INTRO = "The short version: we use your info to run and personalize the app, we don't sell it, and you stay in control.";

export const SECTIONS = [
  {
    title: "1. The Basics",
    icon: "person-circle-outline",
    body:
      "NutriFitAI helps you track food, workouts, and progress, with an AI coach to guide you. To use it, you need to be 13 or older and verify your email. Accounts that aren't verified within 48 hours are deleted.\n\n" +
      "Please give accurate info, keep your credentials secure, and use the app honestly. Photos you upload (profile avatars and food scans) are screened by automated moderation to block explicit, violent, or harmful content. We may suspend or remove accounts that break these rules, upload prohibited content, or put others at risk. We save the time you accepted these terms.",
  },
  {
    title: "2. Not Medical Advice",
    icon: "warning-outline",
    body:
      "NutriFitAI is a wellness app, not a doctor. Scan results are estimates, and the AI coach can make mistakes. " +
      "Check with a doctor or dietitian before big changes to how you eat or train, especially if you have a health condition, are pregnant, or are under 18. " +
      "When creating custom exercises or following workout plans, ensure the movements match your physical abilities and are performed safely. If something hurts or feels wrong, stop and get help.",
  },
  {
    title: "3. What We Collect",
    icon: "document-text-outline",
    body:
      "• Account: your name, email, and a password (we only keep a hashed version). With Google sign-in, we also get your Google ID and profile picture (if none is set). If enabled, two-factor authentication configuration and hashed recovery codes.\n" +
      "• Profile: age, sex, height, activity level, goals, target weight, time zone, notification preferences, and your app settings.\n" +
      "• Activity: weight, water, steps, custom and catalog workouts, logged meals, food scan photos, and your coach chats.\n" +
      "• Technical: your device's push notification token, app usage days, and security audit logs (including sign-in events, IP address, and device info).",
  },
  {
    title: "4. Health & Diet Info",
    icon: "medkit-outline",
    body:
      "Sharing your diet, health conditions, and body measurements is of much importance. We use it for one thing: tailoring food, workout, and coaching tips to you, like working around an allergy. Because it's sensitive, we handle it with extra care.\n\n" +
      "By checking the consent box when you sign up, you let us store and use it for this. You can change such details anytime in your Profile.",
  },
  {
    title: "5. Permissions & Notifications",
    icon: "notifications-outline",
    body:
      "We only ask when a feature needs it:\n" +
      "• Camera and photos: to scan food and set a profile picture.\n" +
      "• Microphone: to talk to the AI coach. Audio is only used to turn your voice into text.\n" +
      "• Activity or health access: to read your daily step count from your phone, Apple Health, or Health Connect. Steps only, nothing else.\n" +
      "• Push notifications: to send reminders for meals, workouts, water, and streaks. You can choose which notifications you receive, set quiet hours, or turn them off in Settings.\n\n" +
      "You can turn any of these off in your device settings or inside the app. Only the related feature stops working.",
  },
  {
    title: "6. Scanner, Coach & Workouts",
    icon: "sparkles-outline",
    body:
      "Food scanner: your photo is analyzed by our food detection service, which identifies foods and estimates nutrition values per portion. Uploaded photos are screened for appropriate content.\n\n" +
      "AI coach: to answer you, we send your message plus a short summary of your info to an AI model. That can include your first name, age range, sex, height, weight, diet, health notes, goals, and recent steps, water, workouts, and meals. It never includes your email, last name, or password.\n\n" +
      "Custom workouts: you can create, edit, and track personal exercises and routines. You are responsible for ensuring personal workout entries are appropriate and that any physical exercises you perform are safe for your condition.",
  },
  {
    title: "7. Who Sees Your Data",
    icon: "share-social-outline",
    body:
      "We don't sell your personal or health information. We only share what's needed to run the app, with:\n" +
      "• Secure cloud hosting and object storage providers (such as Cloudflare R2 for photos)\n" +
      "• An email service, for verification, security alerts, and reset codes\n" +
      "• Expo and Google Firebase, to deliver push notifications to your devices\n" +
      "• Content moderation and AI services, to screen photos and power coach conversations\n" +
      "• Google, if you choose to sign in with your Google account\n\n" +
      "Our administrators can see basic account details like name, email, status, and role to assist users and maintain safety. All administrative actions are recorded in secure audit logs. We may also share data if the law requires it.",
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
      "• Passwords, recovery codes, and email verification codes are stored hashed, never as plain text.\n" +
      "• Two-Factor Authentication (2FA): you can secure your account with an authenticator app (TOTP) and backup recovery codes in Settings.\n" +
      "• Security audit logging: sign-in events, password updates, and sensitive account changes are logged to guard against unauthorized access.\n" +
      "• Session security: you stay signed in with a secure cookie on web, or an encrypted token on your phone. \"Remember me\" lasts up to 30 days, otherwise 3 days.\n" +
      "• Offline cache: to keep working during connection drops, recent screens are cached locally on your device. Signing out clears them.\n\n" +
      "Use a strong, unique password, enable 2FA, and sign out on shared devices. If you suspect unauthorized access, change your password immediately.",
  },
  {
    title: "10. Your Choices",
    icon: "options-outline",
    body:
      "In the app, you can:\n" +
      "• Edit your profile, goals, and health info anytime\n" +
      "• Manage notification preferences and quiet hours\n" +
      "• Create, edit, or remove custom workouts, logged meals, scans, and chats\n" +
      "• Set up or disable two-factor authentication\n" +
      "• Change or reset your password\n\n" +
      "Want to leave? Delete your account in Settings. This permanently erases your profile, workouts, meals, scans, photos, chats, notifications, and device tokens.\n\n" +
      "In the Philippines, the Data Privacy Act of 2012 also gives you the right to access, correct, and erase your data, and to complain to the National Privacy Commission.",
  },
  {
    title: "11. Credits",
    icon: "heart-outline",
    body:
      "NutriFitAI's exercise library is powered by wger (wger.de), an open-source fitness project, and is used under the Creative Commons Attribution-ShareAlike (CC BY-SA) license. Thank you to the wger community and its contributors.\n\n" +
      "The app is also built with open-source tools, and relies on trusted services for hosting, sign-in, and AI. We're grateful to everyone behind them.",
  },
  {
    title: "12. Changes",
    icon: "refresh-outline",
    body: "We'll update this page when NutriFitAI changes. If you keep using the app afterward, you're agreeing to the new version.",
  },
];
// "1. Using NutriFitAI" -> ["1", "Using NutriFitAI"], for the numbered cards
export function splitTitle(title) {
  const m = /^(\d+)\.\s*(.*)$/.exec(title);
  return m ? [m[1], m[2]] : ["", title];
}