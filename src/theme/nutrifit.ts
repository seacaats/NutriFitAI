//design tokens
export const colors = {
  bgMint: "#E0FFD0",
  bgWhite: "#FFFFFF",
  primary: "#4CAF35",
  primaryDark: "#3B8C29",
  primaryLight: "#8BC34A",

  textPrimary: "#111111",
  textSecondary: "#5A5A5A",
  textMuted: "#8A8A8A",
  white: "#FFFFFF",

  inputBg: "#E9ECE6",
  cardBorder: "#E2E2E2",
  cardBg: "#FFFFFF",

  protein: "#00BFA5",
  carbs: "#FF9800",
  fat: "#9C27B0",

  danger: "#D32F2F",
  success: "#4CAF35",

  scanCardBg: "#DDF5C9",
  coachCardBg: "#F3D9FA",
  mealCardBg: "#FBF6C8",
  workoutCardBg: "#EDEDED",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const },
  h2: { fontSize: 22, fontWeight: "800" as const },
  h3: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodyBold: { fontSize: 16, fontWeight: "700" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  button: { fontSize: 17, fontWeight: "700" as const },
};

export default { colors, spacing, radii, typography };