import { Platform } from "react-native";
import { colors, radii, shellColors, spacing, typography } from "./nutrifitai";

// Word-break helper for email labels on web
const breakAnywhere = Platform.OS === "web" ? { wordBreak: "break-all" } : null;

/**
 * Shared cross-platform screen style rules
 */

// ===========================================================================
// (auth)
// ===========================================================================

export const forgotPasswordStyles = (colors) => ({
  root: { flex: 1, backgroundColor: colors.bgMint },
});

export const loginStyles = (colors) => ({
  fieldSpacing: { marginBottom: 20 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orText: { ...typography.tiny, color: colors.textMuted, marginHorizontal: 10 },

  socialText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  footerText: { ...typography.caption, color: colors.textSecondary },
});

// Shared form styles for registration screens
export const registerStyles = (colors) => ({
  row: { flexDirection: "row", gap: 12 },
  thirdField: { flex: 1 },
  // Account form field spacing
  accountFieldSpacing: { marginBottom: 20 },
  sectionLabel: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: 6 },
  required: { color: colors.danger },
  optional: { fontWeight: "400", color: colors.textMuted },
  // Two fields in a row stacked into one column on small screens
  stackedRow: { flexDirection: "column", gap: 20 },

  genderRow: { flexDirection: "row", gap: 8 },
  genderPillActive: { borderWidth: 2, borderColor: colors.green600 },
  genderText: { ...typography.caption, color: colors.textPrimary, textAlign: "center" },
  genderTextActive: { color: colors.green700, fontWeight: "700" },

  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.md },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },
  termsText: { ...typography.tiny, color: colors.textSecondary, flex: 1 },
  termsLink: { ...typography.tiny, color: colors.green700, fontWeight: "700", textDecorationLine: "underline" },

  submitBtn: { marginTop: 6, marginBottom: spacing.sm },
  footerText: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },

  backText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
});

export const verifyRegistrationStyles = (colors) => ({
  root: { flex: 1, backgroundColor: colors.bgMint },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10, textAlign: "center" },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2, textAlign: "center", ...breakAnywhere },
  hint: { ...typography.tiny, color: colors.textMuted, marginTop: 6, textAlign: "center" },
});

export const verifyResetPasswordStyles = (colors) => ({
  root: { flex: 1, backgroundColor: colors.bgMint },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10 },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2, textAlign: "center", ...breakAnywhere },
});

// ===========================================================================
// (main)
// ===========================================================================

export const aiCoachStyles = {
  flex1: { flex: 1 },

  bubbleUser: { backgroundColor: shellColors.primary },
  bubbleTextUser: { fontSize: 14, color: colors.white },
  bubbleTextAi: { fontSize: 14 },
  bubblePending: { flexDirection: "row", alignItems: "center", gap: 8 },

  errorBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.errorBannerBg,
    borderColor: colors.errorBannerBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { fontSize: 12, color: colors.dangerStrong, flexShrink: 1 },

  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
};

// Dashboard styles
export const dashboardStyles = {
  progressFill: { height: 8, borderRadius: 4 },
  viewAll: { fontSize: 12, fontWeight: "600", color: shellColors.primary },
  stackRow: { flexDirection: "column" },
};

// Food scanner styles
export const foodScannerStyles = {
  heading: { fontSize: 17, fontWeight: "700" },
  flex1: { flex: 1 },
  stackRow: { flexDirection: "column" },

  scanTitle: { marginTop: 16, fontSize: 14, fontWeight: "700", color: shellColors.primary },
  scanDesc: { marginTop: 4, maxWidth: 260, textAlign: "center", fontSize: 12 },

  uploadBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingVertical: 12,
  },
  uploadBtnText: { fontSize: 14, fontWeight: "600", color: shellColors.primary },
};

// Profile screen styles
export const profileStyles = {
  flex1: { flex: 1 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrapRow: { flexWrap: "wrap" },
  btnDisabled: { opacity: 0.7 },

  chipActive: { backgroundColor: shellColors.primary, borderColor: shellColors.primary },
  chipTextActive: { color: colors.white },
  selectDisplay: { justifyContent: "center" },
};

export const stepsStyles = {
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: shellColors.primary },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
};

// Workout screen styles
export const workoutsStyles = {
  flex1: { flex: 1 },

  lastPerformedLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: colors.infoText },
  lastPerformedRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 },
  lastPerformedValue: { fontSize: 14, fontWeight: "800", color: colors.infoTextStrong },
  lastPerformedWhen: { fontSize: 11, color: colors.infoText },

  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  exerciseName: { fontSize: 14, fontWeight: "700" },
  metaPillText: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
  loadMoreText: { fontSize: 13, fontWeight: "700", color: shellColors.primary },

  modalBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  musclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
};

/**
 * admin: page chrome shared by the admin screens
 * (/admin/users, /admin/audit-logs, /admin/analytics)
 */

export const adminStyles = {
  flex1: { flex: 1 },

  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 },
  pageHeaderNarrow: { flexDirection: "column", alignItems: "stretch" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  pageSubtitle: { fontSize: 14, marginTop: 6, maxWidth: 560, lineHeight: 21 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },

  controls: { gap: 12, marginBottom: 16 },
  controlsNarrow: {},
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    // Max-width search input container
    height: 40,
    minWidth: 0,
    maxWidth: 560,
  },

  searchInput: { flex: 1, fontSize: 13, outlineStyle: "none" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: "600" },
};
