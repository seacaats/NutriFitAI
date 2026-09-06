// ============================================================
//   !tokens follow v4 default color hex values
//   bg-[#1c1c1c]   -> screenDark   (auth screen backdrop, literal hex)
//   bg-[#dcffca]   -> bgMint       (auth screen / panel bg, literal hex)
//   bg-[#a9d98d]   -> authCard     (login/register card bg, literal hex)
//   bg-[#24680d]   -> brandPanel   (desktop split-screen panel, literal hex)
//   text-[#64bd3c] -> brandLight   (big brand heading on green, literal hex)
//   text-[#3d9715] -> brandDark    ("light" logo text variant, literal hex)
//   bg-[#4caf1f]   -> primary      (buttons, literal hex)
//   hover:bg-[#3d9715] -> primaryDark
//   text/icon green-600/700
// ============================================================

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
  focusRing: "#00c950", // green-500, focus:ring-green-500
  quoteText: "rgba(255, 255, 255, 0.8)", // text-white/80

  facebookBlue: "#1877F2",
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

export const typography = {
  brandHeading: { fontSize: 40, fontWeight: "800" }, // text-5xl
  h1: { fontSize: 28, fontWeight: "800" },
  h2: { fontSize: 20, fontWeight: "700" }, // text-xl
  h3: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  bodyBold: { fontSize: 15, fontWeight: "700" },
  caption: { fontSize: 12, fontWeight: "400" }, // text-xs
  tiny: { fontSize: 10, fontWeight: "400" }, // text-[10px]
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
    inactiveNavText: "#8b9bb0",
    inactiveNavHoverBg: "#f3f4f6", // gray-100
    logoutHoverBg: "#fef2f2", // red-50
    headerDescText: "#6a7282", // gray-500
    dropdownBg: "#ffffff",
    dropdownBorder: "#e5e7eb", // gray-200
    notifIcon: "#99a1af", // gray-400
    notifHoverBg: "#f3f4f6", // gray-100
    notifGreenCard: "#f0faeb",
    notifBlueCard: "#eff6ff", // blue-50
    toggleTrackOff: "#d1d5dc", // gray-300
    avatarBg: "#d1d5dc", // gray-300
  },

  dark: {
    shellBg: "#111111",
    cardBg: "#181818",
    sidebarBg: "#222222",
    sidebarText: "#ffffff",
    rightBg: "#181818",
    activeNavBg: "#294b22",
    inactiveNavText: "#99a1af", // gray-400
    inactiveNavHoverBg: "#333333",
    logoutHoverBg: "#333333",
    headerDescText: "#99a1af", // gray-400
    dropdownBg: "#252525",
    dropdownBorder: "#364153", // gray-700
    notifIcon: "#d1d5dc", // gray-300
    notifHoverBg: "#333333",
    notifGreenCard: "#333333",
    notifBlueCard: "#333333",
    toggleTrackOff: "#d1d5dc", // gray-300
    avatarBg: "#d1d5dc", // gray-300
  },
};

export function getShellColors(darkMode) {
  return {
    primary: shellColors.primary,
    danger: "#fb2c36", // red-500
    white: "#ffffff",
    ...(darkMode ? shellColors.dark : shellColors.light),
  };
}

export default { colors, spacing, radii, typography, shellColors, getShellColors };