export const currentUser = {
  id: "u_001",
  name: "Jose Manalo",
  email: "josemanalo@gmail.com",
  plan: "Pro",
  joined: "May 2024",
  height: 170,
  weight: 70,
  bmi: 24.2,
  bmiCategory: "Normal",
  goal: "Lose Weight",
  dietPreference: "High Protein",
  activityLevel: "Moderate",
  healthConditions: "None",
};

export const dailyNutrition = {
  caloriesConsumed: 1850,
  caloriesGoal: 2200,
  protein: { current: 79, goal: 120 },
  carbs: { current: 165, goal: 1250 },
  fat: { current: 45, goal: 70 },
};

export const todaysPlan = {
  mealPlan: { completed: 2, total: 4 },
  workout: { name: "Upper Body", durationMins: 35 },
};

export const scanResult = {
  foodName: "Lasagna",
  grams: 250,
  calories: 120,
  protein: 26.4,
  carbs: 31.8,
  fat: 18.8,
};

export type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text?: string;
  items?: string[];
  time: string;
};

export const coachMessages: ChatMessage[] = [
  { id: "1", sender: "bot", text: "Hi Jose! \ud83d\udc4b\nHow can I help you today?", time: "10:30 am" },
  { id: "2", sender: "user", text: "What should I eat after workout?", time: "10:30 am" },
  {
    id: "3",
    sender: "bot",
    text: "For Muscle Recovery, I recommend a balanced meal with protein and good carbs.",
    time: "10:31 am",
  },
  {
    id: "4",
    sender: "bot",
    items: ["Grilled Chicken", "Brown Rice", "Greek Yogurt", "Banana"],
    time: "10:31 am",
  },
];

export const progressStats = {
  weekLabel: "May 12 - May 18, 2024",
  calories: { value: 13850, goal: 15400 },
  workouts: { value: 5, goal: 6 },
  steps: { value: 58420, goal: 70000 },
  streak: 7,
  caloriesTrend: [
    { day: "Mon", kcal: 1600 },
    { day: "Tue", kcal: 1950 },
    { day: "Wed", kcal: 1650 },
    { day: "Thu", kcal: 1950 },
    { day: "Fri", kcal: 1500 },
    { day: "Sat", kcal: 2150 },
    { day: "Sun", kcal: 1650 },
  ],
  caloriesTrendAvg: 1978,
  macroDistribution: [
    { label: "Protein", pct: 35, grams: 487, color: "#4CAF35" },
    { label: "Carbs", pct: 45, grams: 623, color: "#64B5F6" },
    { label: "Fats", pct: 20, grams: 245, color: "#FF9800" },
  ],
  weight: {
    current: 70,
    deltaVsLastMonth: -2.5,
    trend: [
      { label: "Apr 21", kg: 72.5 },
      { label: "Apr 28", kg: 72 },
      { label: "May 5", kg: 71.3 },
      { label: "May 12", kg: 70.6 },
      { label: "May 18", kg: 70 },
    ],
  },
  achievements: [
    { id: "a1", title: "7 Day Streak", subtitle: "Keep it Up!", icon: "flame" as const, bg: "#DDF5C9" },
    { id: "a2", title: "Healthy Eater", subtitle: "Eat Balanced", icon: "nutrition" as const, bg: "#FBE3D0" },
    { id: "a3", title: "Early Bird", subtitle: "Morning Person", icon: "sunny" as const, bg: "#F3D9FA" },
    { id: "a4", title: "Workout Warrior", subtitle: "5 Workouts", icon: "barbell" as const, bg: "#D6ECFB" },
  ],
};
