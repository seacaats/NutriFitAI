// Theme token definitions and color palette constants

export const colors = {
  // Screens / panels
  screenDark: "#1c1c1c",
  bgMint: "#dcffca",
  authCard: "#a9d98d",
  brandPanel: "#24680d",
  white: "#ffffff",

  // Brand
  brandLight: "#64bd3c",
  brandDark: "#3d9715",
  primary: "#4caf1f",
  primaryDark: "#3d9715",

  green500: "#00c950",
  green600: "#00a63e",
  green700: "#008236",
  green800: "#016630",
  greenTint: "#dcfce7",

  textPrimary: "#1e2939", // gray-800
  textSecondary: "#4a5565", // gray-600
  textMuted: "#6a7282", // gray-500
  border: "#d1d5dc", // gray-300
  inputBg: "#ffffff",

  danger: "#fb2c36", // red-500
  dangerBg: "#fef2f2", // red-50

  divider: "rgba(153, 161, 175, 0.5)", // gray-400/50
  focusRing: "#00c950", // green-500
  quoteText: "rgba(255, 255, 255, 0.8)",

  facebookBlue: "#1877F2",

  // Near-black text for colored chips and pills
  nearBlack: "#1a1a1a",

  // Calorie and macro nutrient accents
  orange400: "#fb923c",
  // Inactive step bar fill color
  stepsInactiveFill: "#9bd486",

  // Info panels
  infoBg: "#eff6ff", // blue-50
  infoBorder: "#bfdbfe", // blue-200
  infoText: "#1d4ed8", // blue-700
  infoTextStrong: "#1e3a8a", // blue-900

  // Error banners and inline alert text
  errorBannerBg: "#fef2f2", // red-50
  errorBannerBorder: "#fecaca", // red-200
  dangerStrong: "#dc2626", // red-600
  dangerAlt: "#dc2626", // red-600

  // Profile save banner and success accents
  mintTint: "#f0fdf4", // green-50
  mintTintDark: "#1a2e14",
  deepGreenText: "#14532d", // green-900
  grayInputBg: "#f3f4f6", // gray-100
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// SVG chart font stack prioritizing Inter
export const CHART_FONT = "Inter_400Regular, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const typography = {
  brandHeading: { fontSize: 40, fontWeight: "800" },
  h1: { fontSize: 28, fontWeight: "800" },
  h2: { fontSize: 20, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  bodyBold: { fontSize: 15, fontWeight: "700" },
  caption: { fontSize: 12, fontWeight: "400" },
  tiny: { fontSize: 10, fontWeight: "400" },
  button: { fontSize: 16, fontWeight: "700" },
};

export const shellColors = {
  primary: "#4CAF2F",

  light: {
    shellBg: "#f5f7f4",
    cardBg: "#ffffff",
    sidebarBg: "#ffffff",
    sidebarText: "#222222",
    rightBg: "#f8faf7",
    activeNavBg: "#dcffcc",
    inactiveNavText: "#5f6b7d",
    activeNavText: "#2f7d17",
    inactiveNavHoverBg: "#f3f4f6",
    logoutHoverBg: "#fef2f2",
    headerDescText: "#4b5563",
    dropdownBg: "#ffffff",
    dropdownBorder: "#e5e7eb",
    shellBorder: "#e6ebe3",
    notifIcon: "#5f6b7d",
    notifHoverBg: "#f3f4f6",
    notifGreenCard: "#f0faeb",
    notifBlueCard: "#eff6ff",
    toggleTrackOff: "#d1d5dc",
    avatarBg: "#d1d5dc",
  },

  dark: {
    shellBg: "#111111",
    cardBg: "#181818",
    sidebarBg: "#222222",
    sidebarText: "#ffffff",
    rightBg: "#181818",
    activeNavBg: "#294b22",
    inactiveNavText: "#99a1af",
    activeNavText: "#4CAF2F",
    inactiveNavHoverBg: "#333333",
    logoutHoverBg: "#333333",
    headerDescText: "#99a1af",
    dropdownBg: "#252525",
    dropdownBorder: "#364153",
    shellBorder: "#2a2a2a",
    notifIcon: "#d1d5dc",
    notifHoverBg: "#333333",
    notifGreenCard: "#333333",
    notifBlueCard: "#333333",
    toggleTrackOff: "#d1d5dc",
    avatarBg: "#d1d5dc",
  },
};

export function getShellColors(darkMode) {
  return {
    primary: shellColors.primary,
    danger: "#fb2c36",
    white: "#ffffff",
    ...(darkMode ? shellColors.dark : shellColors.light),
  };
}

// Screen tones: centralized theme surface, border, and text tokens for dashboard screens
export const screenTones = {
  light: {
    card: "#ffffff",
    border: "#e5e7eb",
    text: "#111111",
    muted: "#6a7282",
    mutedAlt: "#9aa2b1",
    soft: "#f1f8ed",
    track: "#e8ece6",
    surfaceMuted: "#f3f4f6",
  },
  dark: {
    card: "#222222",
    border: "#364153",
    text: "#ffffff",
    muted: "#9ca3af",
    mutedAlt: "#9aa2b1",
    soft: "#293328",
    track: "#364153",
    surfaceMuted: "#333333",
  },
};

export function getScreenTones(darkMode) {
  return darkMode ? screenTones.dark : screenTones.light;
}

// Returns card style, textColor, and mutedText style objects for the current theme
export function getScreenPalette(darkMode) {
  const t = getScreenTones(darkMode);
  return {
    card: { backgroundColor: t.card, borderColor: t.border },
    textColor: { color: t.text },
    mutedText: { color: t.muted },
  };
}

// Tint palette for stat cards, badges, and tag chips
export const chipTints = {
  green: { light: "#e7f9df", dark: "#1a2e14", icon: colors.green600 },
  blue: { light: "#e5f0ff", dark: "#1a2440", icon: "#2b7fff" },
  purple: { light: "#fbe7fb", dark: "#2e1a34", icon: "#c86ee0" },
  orange: { light: "#fdeee0", dark: "#33261a", icon: "#f59e0b" },
  cyan: { light: "#e0f7fa", dark: "#12302f", icon: "#06b6d4" },
  rose: { light: "#ffe4e6", dark: "#3a1a20", icon: "#f43f5e" },
};

export function getChipTint(name, darkMode) {
  const tint = chipTints[name] || chipTints.green;
  return { backgroundColor: darkMode ? tint.dark : tint.light, icon: tint.icon };
}

// Public page theme tones for landing and legal screens
export const publicTones = {
  light: {
    bg: colors.bgMint,
    nav: "rgba(220, 255, 202, 0.92)",
    line: "#bfe3a8",
    hover: "rgba(255, 255, 255, 0.6)",
    bandMint: colors.mintTint,
    bandWhite: colors.white,
    surface: colors.white,
    border: colors.border,
    ink: colors.textPrimary,
    text: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.green700,
    title: colors.brandDark,
    tint: colors.greenTint,
    soft: colors.mintTint,
    tag: colors.white,
    track: chipTints.green.light,
    rule: colors.authCard,
    shadow: "#0f2a08",
  },
  dark: {
    bg: shellColors.dark.shellBg,
    nav: "rgba(17, 17, 17, 0.92)",
    line: "#2a2a2a",
    hover: "rgba(255, 255, 255, 0.1)",
    bandMint: shellColors.dark.cardBg,
    bandWhite: shellColors.dark.cardBg,
    surface: screenTones.dark.card,
    border: screenTones.dark.border,
    ink: screenTones.dark.text,
    text: "#c1c7d0",
    muted: screenTones.dark.muted,
    accent: shellColors.primary,
    title: shellColors.primary,
    tint: shellColors.dark.activeNavBg,
    soft: chipTints.green.dark,
    tag: screenTones.dark.surfaceMuted,
    track: chipTints.green.dark,
    rule: shellColors.dark.activeNavBg,
    shadow: "#000000",
  },
};

export function getPublicTones(darkMode) {
  return darkMode ? publicTones.dark : publicTones.light;
}

// Color palette for authentication screens in light and dark mode
export function getAuthColors(darkMode) {
  if (!darkMode) return colors;
  const p = publicTones.dark;
  return {
    ...colors,
    bgMint: p.bandMint,
    authCard: p.surface,
    brandPanel: p.soft,
    white: p.surface,
    inputBg: p.tag,
    grayInputBg: p.tag,
    mintTint: p.soft,
    greenTint: p.tint,
    green700: p.accent,
    brandDark: p.title,
    textPrimary: p.ink,
    textSecondary: p.text,
    textMuted: p.muted,
    border: p.border,
    divider: p.border,
    dangerBg: "#2a1215",
  };
}

export default {
  colors,
  spacing,
  radii,
  typography,
  shellColors,
  getShellColors,
  screenTones,
  getScreenTones,
  getScreenPalette,
  chipTints,
  getChipTint,
  publicTones,
  getPublicTones,
  getAuthColors,
};
