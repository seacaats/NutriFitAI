import PublicFooter from "@/shared/components/layout/PublicFooter";
import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { FEATURES, HERO, STEPS } from "@/shared/constants/publicContent";
import { AUTH_STATUS, homeFor, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { chipTints, colors, getChipTint, getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Side by side above this width, stacked below
const WIDE = 900;
// Section links hide below this width, leaving just the logo and buttons
const NAV_LINKS = 720;
const NAV_HEIGHT = 64;
// The Android build: a file in public/ by default, or a link to wherever it is hosted
const APK_URL = process.env.EXPO_PUBLIC_APK_URL || "/NutriFitAI.apk";

// An example of what a scan returns, for the hero. Not real user data
const SAMPLE_SCAN = {
  name: "Chicken Adobo",
  serving: "1 cup",
  kcal: 280,
  macros: [
    { label: "Protein", grams: 28, share: 0.61, color: colors.primary },
    { label: "Carbs", grams: 4, share: 0.09, color: colors.orange400 },
    { label: "Fat", grams: 16, share: 0.35, color: chipTints.blue.icon },
  ],
};

// A temporary link is the way to save a file from a button, the browser then downloads it
const downloadApk = () => {
  const a = document.createElement("a");
  a.href = APK_URL;
  a.download = "NutriFitAI.apk";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export default function LandingScreen() {
  const { status, isAuthenticated, emailVerified, role } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const scrollRef = useRef(null);
  // Each section's top, so the nav links can scroll to it
  const offsets = useRef({});
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const { darkMode } = useTheme();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  // Signed-in users can visit too; the buttons take them back in instead
  const signedIn = isAuthenticated && emailVerified;
  const home = homeFor(role);

  const mark = (key) => (e) => { offsets.current[key] = e.nativeEvent.layout.y; };
  const jumpTo = (key) => scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[key] ?? 0) - NAV_HEIGHT), animated: true });

  return (
    <View style={styles.root}>
      {/* The nav is the first child, so it is the one that sticks */}
      <ScrollView ref={scrollRef} stickyHeaderIndices={[0]} contentContainerStyle={styles.scroll}>
        <View style={styles.nav}>
          <View style={styles.navInner}>
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} hitSlop={8}>
              <NutriFitLogo small={!wide} />
            </Pressable>

            {width >= NAV_LINKS && (
              <View style={styles.navLinks}>
                <NavLink styles={styles} label="Features" onPress={() => jumpTo("features")} />
                <NavLink styles={styles} label="How it works" onPress={() => jumpTo("steps")} />
              </View>
            )}

            <View style={styles.navActions}>
              {signedIn ? (
                <PrimaryButton title="Dashboard" onPress={() => router.push(home)} style={styles.navBtn} />
              ) : (
                <>
                  <NavLink styles={styles} label="Log in" onPress={() => router.push("/login")} />
                  <PrimaryButton title="Get started" onPress={() => router.push("/register")} style={styles.navBtn} />
                </>
              )}
              <ThemeToggle />
            </View>
          </View>
        </View>

        {/* Hero: the pitch, and what a scan gives back */}
        <View style={[styles.section, styles.hero, wide && styles.heroWide]}>
          <View style={[styles.heroText, wide && styles.heroTextWide]}>
            <Text style={styles.overline}>{HERO.tagline}</Text>
            <Text style={[styles.heroTitle, wide && styles.heroTitleWide, !wide && styles.center]}>{HERO.title}</Text>
            <Text style={[styles.heroBody, !wide && styles.center]}>{HERO.body}</Text>
            <View style={[styles.actions, !wide && styles.actionsCenter]}>
              {signedIn ? (
                <PrimaryButton title="Go to Dashboard" onPress={() => router.push(home)} style={styles.btn} />
              ) : (
                <PrimaryButton title="Get started free" onPress={() => router.push("/register")} style={styles.btn} />
              )}
              <Pressable onPress={() => jumpTo("steps")} style={({ hovered }) => [styles.ghostBtn, hovered && styles.ghostBtnHover]}>
                <Text style={styles.ghostText}>See how it works</Text>
              </Pressable>
            </View>

            {/* The app itself, for Android phones */}
            <Pressable onPress={downloadApk} accessibilityLabel="Download the Android app" style={({ hovered }) => [styles.apkBtn, hovered && styles.apkBtnHover]}>
              <Ionicons name="logo-android" size={20} color={p.accent} />
              <View>
                <Text style={styles.apkTitle}>Download for Android</Text>
                <Text style={styles.apkNote}>APK, Android 8 or newer</Text>
              </View>
              <Ionicons name="download-outline" size={18} color={p.muted} />
            </Pressable>
          </View>

          <ScanMock styles={styles} p={p} />
        </View>

        {/* Features: the scanner leads, the rest support it */}
        <View onLayout={mark("features")} style={styles.band}>
          <View style={styles.section}>
            <Text style={styles.heading}>Everything you need, in one app</Text>
            <Text style={styles.subheading}>Log it once and it shows up everywhere, from your dashboard to your coach.</Text>
            <View style={styles.grid}>
              {FEATURES.map((f, i) => {
                const tint = getChipTint(f.tint, darkMode);
                return (
                  <View key={f.title} style={[styles.card, i === 0 && wide && styles.cardLead]}>
                    <View style={[styles.cardIcon, { backgroundColor: tint.backgroundColor }]}>
                      <Ionicons name={f.icon} size={22} color={tint.icon} />
                    </View>
                    <Text style={styles.cardTitle}>{f.title}</Text>
                    <Text style={styles.cardBody}>{f.body}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* How it works */}
        <View onLayout={mark("steps")} style={styles.section}>
          <Text style={styles.heading}>How it works</Text>
          <Text style={styles.subheading}>Three steps from signing up to knowing what to do next.</Text>
          <View style={[styles.steps, wide && styles.stepsWide]}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <Text style={styles.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={styles.stepRule} />
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.cardBody}>{s.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Closing call to action */}
        {!signedIn && (
          <View style={styles.section}>
            <View style={styles.cta}>
              <Text style={styles.ctaTitle}>Ready to start?</Text>
              <Text style={styles.ctaBody}>Create your account and set your goals.</Text>
              <Pressable onPress={() => router.push("/register")} style={({ hovered }) => [styles.ctaBtn, hovered && styles.ctaBtnHover]}>
                <Text style={styles.ctaBtnText}>Create your account</Text>
              </Pressable>
              <Pressable onPress={downloadApk} style={styles.ctaLink}>
                <Ionicons name="logo-android" size={16} color={colors.quoteText} />
                <Text style={styles.ctaLinkText}>Or download the Android app</Text>
              </Pressable>
            </View>
          </View>
        )}

        <PublicFooter />
      </ScrollView>
    </View>
  );
}

function NavLink({ label, onPress, styles }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ hovered }) => [styles.navLink, hovered && styles.navLinkHover]}>
      <Text style={styles.navLinkText}>{label}</Text>
    </Pressable>
  );
}

// A food scan result: the photo with its detected label, then the breakdown
function ScanMock({ styles, p }) {
  return (
    <View style={styles.mock}>
      <View style={styles.viewfinder}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
        <Ionicons name="restaurant-outline" size={56} color={p.accent} />
        <View style={styles.detectTag}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          <Text style={styles.detectText}>{SAMPLE_SCAN.name}</Text>
        </View>
      </View>

      <View style={styles.result}>
        <View style={styles.resultHead}>
          <View>
            <Text style={styles.resultName}>{SAMPLE_SCAN.name}</Text>
            <Text style={styles.resultServing}>{SAMPLE_SCAN.serving} · sample result</Text>
          </View>
          <Text style={styles.resultKcal}>{SAMPLE_SCAN.kcal} <Text style={styles.resultUnit}>kcal</Text></Text>
        </View>

        {SAMPLE_SCAN.macros.map((m) => (
          <View key={m.label} style={styles.macroRow}>
            <Text style={styles.macroLabel}>{m.label}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${m.share * 100}%`, backgroundColor: m.color }]} />
            </View>
            <Text style={styles.macroGrams}>{m.grams}g</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Colors come from the public palette, so the page follows the light/dark theme
const createStyles = (p) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },
  scroll: { flexGrow: 1 },
  center: { textAlign: "center" },

  nav: { backgroundColor: p.nav, borderBottomWidth: 1, borderBottomColor: p.line, backdropFilter: "blur(10px)", zIndex: 10 },
  navInner: { height: NAV_HEIGHT, width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  navLinks: { flexDirection: "row", gap: spacing.sm },
  navActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navLink: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  navLinkHover: { backgroundColor: p.hover },
  navLinkText: { ...typography.body, fontSize: 14, fontWeight: "600", color: p.ink },
  navBtn: { height: 38, minWidth: 0 },

  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: 88 },
  overline: { ...typography.caption, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: p.accent },
  heading: { ...typography.h1, fontSize: 32, letterSpacing: -0.5, color: p.ink, textAlign: "center" },
  subheading: { ...typography.body, fontSize: 17, color: p.text, textAlign: "center", marginTop: spacing.sm, marginBottom: 56 },

  hero: { gap: 56, alignItems: "center", paddingTop: 72 },
  heroWide: { flexDirection: "row", justifyContent: "space-between" },
  heroText: { alignItems: "center", maxWidth: 560 },
  heroTextWide: { alignItems: "flex-start", flex: 1 },
  heroTitle: { ...typography.brandHeading, letterSpacing: -1, color: p.ink, marginTop: spacing.md, lineHeight: 46 },
  heroTitleWide: { fontSize: 56, lineHeight: 62, letterSpacing: -1.5 },
  heroBody: { ...typography.body, fontSize: 18, color: p.text, marginTop: spacing.lg, lineHeight: 28 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  actionsCenter: { justifyContent: "center" },
  btn: { minWidth: 180, height: 48 },
  ghostBtn: { height: 48, paddingHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderColor: p.accent, alignItems: "center", justifyContent: "center" },
  ghostBtnHover: { backgroundColor: p.hover },
  ghostText: { ...typography.button, color: p.ink },
  apkBtn: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.lg, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line },
  apkBtnHover: { backgroundColor: p.soft },
  apkTitle: { ...typography.body, fontSize: 14, fontWeight: "700", color: p.ink },
  apkNote: { ...typography.caption, color: p.muted, marginTop: 1 },

  // The hero's scan result
  mock: { width: "100%", maxWidth: 420, backgroundColor: p.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: p.line, overflow: "hidden", shadowColor: p.shadow, shadowOpacity: 0.1, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
  viewfinder: { height: 220, backgroundColor: p.soft, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 22, height: 22, borderColor: p.accent },
  cornerTL: { top: 20, left: 20, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 20, right: 20, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 20, left: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 20, right: 20, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  detectTag: { position: "absolute", bottom: 34, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: p.tag, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  detectText: { ...typography.caption, fontWeight: "700", color: p.ink },
  result: { padding: spacing.lg, gap: spacing.md },
  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  resultName: { ...typography.h3, color: p.ink },
  resultServing: { ...typography.caption, color: p.muted, marginTop: 2 },
  resultKcal: { fontSize: 28, fontWeight: "800", color: p.ink },
  resultUnit: { ...typography.caption, fontWeight: "600", color: p.muted },
  macroRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  macroLabel: { ...typography.caption, fontSize: 13, color: p.text, width: 52 },
  track: { flex: 1, height: 8, borderRadius: radii.pill, backgroundColor: p.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill },
  macroGrams: { ...typography.caption, fontSize: 13, fontWeight: "700", color: p.ink, width: 32, textAlign: "right" },

  band: { backgroundColor: p.bandMint },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { flexGrow: 1, flexBasis: 300, backgroundColor: p.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: p.line, padding: spacing.xl },
  cardLead: { flexBasis: "100%" },
  cardIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  cardTitle: { ...typography.h3, color: p.ink, marginBottom: spacing.sm },
  cardBody: { ...typography.body, color: p.text, lineHeight: 23 },

  steps: { gap: spacing.xl },
  stepsWide: { flexDirection: "row" },
  step: { flex: 1 },
  stepNum: { fontSize: 14, fontWeight: "800", color: p.accent, letterSpacing: 1 },
  stepRule: { height: 2, backgroundColor: p.rule, marginVertical: spacing.md },
  stepTitle: { ...typography.h3, color: p.ink, marginBottom: spacing.sm },

  cta: { backgroundColor: colors.brandPanel, borderRadius: radii.xl, paddingVertical: 64, paddingHorizontal: spacing.lg, alignItems: "center" },
  ctaTitle: { ...typography.h1, fontSize: 32, letterSpacing: -0.5, color: colors.white, textAlign: "center" },
  ctaBody: { ...typography.body, fontSize: 17, color: colors.quoteText, marginTop: spacing.sm, textAlign: "center" },
  ctaBtn: { marginTop: spacing.xl, minWidth: 220, height: 48, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ctaBtnHover: { backgroundColor: colors.greenTint },
  ctaBtnText: { ...typography.button, color: colors.brandPanel },
  ctaLink: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg },
  ctaLinkText: { ...typography.body, fontSize: 14, fontWeight: "600", color: colors.quoteText },
});