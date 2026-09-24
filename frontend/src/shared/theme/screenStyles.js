import { colors, radii, screenTones, shellColors, spacing, typography } from "./nutrifit";

/**
 * Per-screen style rules that were byte-identical between a screen's native
 * (index.jsx / DashboardLayout.jsx) and web (index.web.jsx /
 * DashboardLayout.web.jsx) file, deduplicated so a change only has to happen
 * once instead of being hand-kept-in-sync across both
 */

// ===========================================================================
// (auth)
// ===========================================================================

export const forgotPasswordStyles = {
  root: { flex: 1, backgroundColor: colors.bgMint },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
};

export const loginStyles = {
  sessionCheckRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint },

  fieldSpacing: { marginBottom: spacing.md },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orText: { ...typography.tiny, color: colors.textMuted, marginHorizontal: 10 },

  socialText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  footerText: { ...typography.caption, color: colors.textSecondary },
};

/**
 * register: the two screens use different outer layouts (single column vs.
 * split panel), but the whole step-2 form -- gender pills, the activity/goal
 * dropdowns, the consent checkbox, the text area -- was retyped rule-for-rule
 * in both.
 */
export const registerStyles = {
  row: { flexDirection: "row", gap: 8 },
  thirdField: { flex: 1 },
  sectionLabel: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: 6 },

  genderRow: { flexDirection: "row", gap: 8 },
  genderPillActive: { borderWidth: 2, borderColor: colors.green600 },
  genderText: { ...typography.caption, color: colors.textPrimary, textAlign: "center" },
  genderTextActive: { color: colors.green700, fontWeight: "700" },

  goalSelectLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalPlaceholder: { ...typography.caption, color: colors.textMuted },
  goalText: { ...typography.caption, color: colors.textPrimary, fontWeight: "600" },
  goalOptions: { backgroundColor: colors.white, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  goalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalOptionText: { ...typography.caption, color: colors.textPrimary },

  textArea: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 76,
    textAlignVertical: "top",
  },

  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.md },
  checkboxChecked: { backgroundColor: colors.green600, borderColor: colors.green600 },
  termsText: { ...typography.tiny, color: colors.textSecondary, flex: 1 },
  termsLink: { ...typography.tiny, color: colors.green700, fontWeight: "700", textDecorationLine: "underline" },

  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
  submitBtn: { marginTop: 6, marginBottom: spacing.sm },
  footerText: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },

  backText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
};

export const verifyRegistrationStyles = {
  root: { flex: 1, backgroundColor: colors.bgMint },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10, textAlign: "center" },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2 },
  hint: { ...typography.tiny, color: colors.textMuted, marginTop: 6, textAlign: "center" },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: 4 },
};

export const verifyResetPasswordStyles = {
  root: { flex: 1, backgroundColor: colors.bgMint },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 10 },
  email: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2 },
  error: { ...typography.caption, color: colors.danger, marginTop: 4, textAlign: "center" },
  success: { ...typography.caption, color: colors.primary, fontWeight: "700", marginTop: 4, textAlign: "center" },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: 4 },
  linkDisabled: { color: colors.textMuted },
};

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

/**
 * dashboard: includes shortcutRowCompact/stackRow, which used different key
 * names for the exact same rule in native vs. web.
 *
 */
export const dashboardStyles = {
  progressFill: { height: 8, borderRadius: 4 },
  viewAll: { fontSize: 12, fontWeight: "600", color: shellColors.primary },
  stackRow: { flexDirection: "column" },
};

/**
 * food-scanner: includes a few that used different key names for the exact
 * same rule (topBarTitle/heading, detectedRowCompact/stackRow,
 * detectedLeft/flexHalf/flex1) -- unified here under one name each.
 */
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

/**
 * profile: includes a few that used different key names for the exact same
 * rule (nameRow/rowGap, overviewRowCompact/wrapRow, btnDisabled/actionBtnDisabled)
 * -- unified here under one name each
 *
 */
export const profileStyles = {
  flex1: { flex: 1 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrapRow: { flexWrap: "wrap" },
  btnDisabled: { opacity: 0.7 },

  chipActive: { backgroundColor: shellColors.primary, borderColor: shellColors.primary },
  chipTextActive: { color: colors.white },
  selectDisplay: { justifyContent: "center" },
};

/** progress: includes midRowCompact/stackRow, which used different key names
 *  for the exact same rule in native vs. web. */
export const progressStyles = {
  flex1: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alignRight: { alignItems: "flex-end" },
  stackRow: { flexDirection: "column" },
};

export const stepsStyles = {
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: shellColors.primary },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rangeTabActive: { backgroundColor: shellColors.primary },
};

/**
 * workouts: the card grid and modal layout differ a lot between native and
 * web, but the "Recent" row, the "Last performed" info card, and several
 * pill/badge text styles were retyped rule-for-rule in both
 */
export const workoutsStyles = {
  flex1: { flex: 1 },

  recentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  recentBody: { flex: 1, minWidth: 0 },
  recentName: { fontSize: 13, fontWeight: "700" },
  recentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  recentWhen: { fontSize: 11, color: screenTones.light.mutedAlt },

  lastPerformedLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: colors.infoText },
  lastPerformedRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 },
  lastPerformedValue: { fontSize: 14, fontWeight: "800", color: colors.infoTextStrong },
  lastPerformedWhen: { fontSize: 11, color: colors.infoText },

  catPillActive: { backgroundColor: shellColors.primary },
  catPillText: { fontSize: 12, fontWeight: "700" },
  catPillTextActive: { color: colors.white },

  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  exerciseName: { fontSize: 14, fontWeight: "700" },
  metaPillText: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
  loadMoreText: { fontSize: 13, fontWeight: "700", color: shellColors.primary },

  loaderText: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  modalLoader: { alignItems: "center", paddingVertical: 60 },

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
 * admin / superadmin: page chrome shared by the three admin screens
 * (/admin/users, /admin/audit-logs, /superadmin/admins)
 */

export const adminStyles = {
  flex1: { flex: 1 },

  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 },
  pageHeaderNarrow: { flexDirection: "column", alignItems: "stretch" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  pageSubtitle: { fontSize: 13, marginTop: 4, maxWidth: 560, lineHeight: 19 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },

  controls: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  controlsNarrow: { flexDirection: "column", alignItems: "stretch" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 240,
    flexGrow: 1,
    flexBasis: 240,
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

// ===========================================================================
// (public)
// ===========================================================================

export const publicStyles = {
  root: { flex: 1, backgroundColor: colors.bgMint },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint },

  featureTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
  featureBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
};