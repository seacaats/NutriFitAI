import { CoachDemo, FoodDemo, ProgressDemo, ScanCard, StepPreview, WorkoutDemo } from "@/features/landing/components/LandingWidgets";
import PublicFooter from "@/shared/components/layout/PublicFooter";
import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { FEATURES, HERO, STEPS } from "@/shared/constants/publicContent";
import { AUTH_STATUS, homeFor, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getChipTint, getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Side by side above this width, stacked below
const WIDE = 900;
// Section links hide below this width, leaving just the logo and buttons
const NAV_LINKS = 720;
const NAV_HEIGHT = 64;
// The Android build: a file in public/ by default, or a link to wherever it is hosted
const APK_URL = process.env.EXPO_PUBLIC_APK_URL || "/NutriFitAI.apk";

// The feature cards' demos, in the order of FEATURES
const DEMOS = [FoodDemo, CoachDemo, WorkoutDemo, ProgressDemo];

// A temporary link is the way to save a file from a button, the browser then downloads it
const downloadApk = () => {
  const a = document.createElement("a");
  a.href = APK_URL;
  a.download = "NutriFitAI.apk";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
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
  // Each section's top and height, so the nav links can scroll to it and the scroll can drive the page
  const offsets = useRef({});
  const cardRefs = useRef([]);
  const frame = useRef(0);
  const runRef = useRef(null);
  // Feature cards that have come into view. Each fades in once and stays
  const [shown, setShown] = useState([]);
  // Shared by the hero chip, the progress card and the step preview
  const [water, setWater] = useState(6);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("Build Muscle");
  const [diet, setDiet] = useState("High Protein");
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const { darkMode } = useTheme();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);

  // Position everything once the page is up, and again when the window changes size
  useEffect(() => {
    if (gate.pending) return undefined;
    const kick = () => requestAnimationFrame(() => runRef.current?.());
    kick();
    window.addEventListener("resize", kick);
    return () => window.removeEventListener("resize", kick);
  }, [gate.pending]);

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  // Signed-in users can visit too; the buttons take them back in instead
  const signedIn = isAuthenticated && emailVerified;
  const home = homeFor(role);

  const mark = (key) => (e) => { offsets.current[key] = e.nativeEvent.layout; };
  const jumpTo = (key) => scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[key]?.y ?? 0) - NAV_HEIGHT), animated: true });

  // One pass per frame: which feature cards have come into
  // view. The bar is set on the DOM directly, so scrolling never re-renders the page
  runRef.current = () => {
    const node = scrollRef.current?.getScrollableNode?.();
    if (!node) return;
    const vh = node.clientHeight || 1;

    // A card is shown once its top is well inside the screen, and stays shown.
    // People who ask for less motion get them all at once
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = cardRefs.current.map((el, i) => shown[i] || still || (!!el && el.getBoundingClientRect().top < vh * 0.88));
    if (next.some((v, i) => v !== !!shown[i])) setShown(next);
  };
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(runRef.current);
  };

  return (
    <View style={styles.root}>
      {/* The nav is the first child, so it is the one that sticks */}
      <ScrollView ref={scrollRef} stickyHeaderIndices={[0]} contentContainerStyle={styles.scroll} onScroll={onScroll} scrollEventThrottle={16}>
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
            <View style={styles.overlineRow}>
              <View style={styles.pingDot} />
              <Text style={styles.overline}>{HERO.tagline}</Text>
            </View>
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
            <Pressable
              onPress={downloadApk}
              accessibilityLabel="Download the Android app"
              accessibilityRole="link"
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={({ hovered }) => [styles.apkBtn, hovered && styles.apkBtnHover]}
            >
              <Ionicons name="logo-android" size={20} color={p.accent} />
              <View>
                <Text style={styles.apkTitle}>Download for Android</Text>
                <Text style={styles.apkNote}>APK, Android 8 or newer</Text>
              </View>
              <Ionicons name="download-outline" size={18} color={p.muted} />
            </Pressable>
          </View>

          <ScanCard p={p} />
        </View>

        {/* Features: the scanner leads, the rest support it. Each card has a small working demo */}
        <View onLayout={mark("features")} style={styles.band}>
          <View style={styles.section}>
            <Text style={styles.heading}>Everything you need, in one app</Text>
            <Text style={[styles.subheading, styles.subTight]}>Log it once and it shows up everywhere, from your dashboard to your coach.</Text>

            <View style={styles.grid}>
              {FEATURES.map((f, i) => {
                const tint = getChipTint(f.tint, darkMode);
                const Demo = DEMOS[i];
                const lead = i === 0 && wide;
                return (
                  <Pressable key={f.title} accessible={false} ref={(el) => { cardRefs.current[i] = el; }} style={({ hovered }) => [styles.card, lead && styles.cardLead, !shown[i] && styles.cardHidden, shown[i] && hovered && styles.cardHover]}>
                    <View style={lead && styles.leadText}>
                      <View style={styles.cardTop}>
                        <View style={[styles.cardIcon, { backgroundColor: tint.backgroundColor }]}>
                          <Ionicons name={f.icon} size={22} color={tint.icon} />
                        </View>
                        <Text style={styles.cardTag}>{f.tag}</Text>
                      </View>
                      <Text style={styles.cardTitle}>{f.title}</Text>
                      <Text style={styles.cardBody}>{f.body}</Text>
                    </View>
                    <View style={lead && styles.leadDemo}>
                      <Demo p={p} water={water} setWater={setWater} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* How it works: tap a step and the preview shows it */}
        <View onLayout={mark("steps")} style={styles.section}>
          <Text style={styles.heading}>How it works</Text>
          <Text style={styles.subheading}>Three steps from signing up to knowing what to do next.</Text>
          <View style={[styles.stepsRow, wide && styles.stepsRowWide]}>
            <View style={[styles.steps, wide && styles.stepsWide]}>
              {STEPS.map((s, i) => (
                <Pressable key={s.title} ref={(el) => { cardRefs.current[FEATURES.length + i] = el; }} onPress={() => setStep(i)} accessibilityRole="button" style={({ hovered }) => [styles.step, i === step && styles.stepOn, !shown[FEATURES.length + i] && styles.cardHidden, shown[FEATURES.length + i] && hovered && styles.cardHover]}>
                  <Text style={styles.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.cardBody}>{s.body}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={wide && styles.flex}>
              <StepPreview p={p} step={step} goal={goal} setGoal={setGoal} diet={diet} setDiet={setDiet} water={water} />
            </View>
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

// Colors come from the public palette, so the page follows the light/dark theme
const createStyles = (p) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },
  scroll: { flexGrow: 1 },
  center: { textAlign: "center" },
  flex: { flex: 1 },

  nav: { backgroundColor: p.nav, borderBottomWidth: 1, borderBottomColor: p.line, backdropFilter: "blur(10px)", zIndex: 10 },
  navInner: { height: NAV_HEIGHT, width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  navLinks: { flexDirection: "row", gap: spacing.sm },
  navActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navLink: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  navLinkHover: { backgroundColor: p.hover },
  navLinkText: { ...typography.body, fontSize: 14, fontWeight: "600", color: p.ink },
  navBtn: { height: 38, minWidth: 0 },

  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: 88 },
  overlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
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

  band: { backgroundColor: p.bandMint },
  subTight: { marginBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { flexGrow: 1, flexBasis: 300, backgroundColor: p.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: p.line, padding: spacing.xl, opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], transitionProperty: "opacity, transform, box-shadow", transitionDuration: "400ms" },
  cardHover: { transform: [{ translateY: -4 }, { scale: 1.03 }], shadowColor: p.shadow, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  // Before the card has scrolled into view
  cardHidden: { opacity: 0, transform: [{ translateY: 40 }, { scale: 0.96 }] },
  cardLead: { flexBasis: "100%", flexDirection: "row", alignItems: "center", gap: spacing.xl },
  leadText: { flex: 1.15 },
  leadDemo: { flex: 0.85 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  cardTag: { ...typography.caption, fontWeight: "800", letterSpacing: 1, color: p.accent, backgroundColor: p.soft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  cardIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...typography.h3, color: p.ink, marginBottom: spacing.sm },
  cardBody: { ...typography.body, color: p.text, lineHeight: 23 },

  stepsRow: { gap: spacing.xl },
  stepsRowWide: { flexDirection: "row", alignItems: "center" },
  steps: { gap: spacing.md },
  stepsWide: { flex: 1 },
  step: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: "transparent", opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], transitionProperty: "opacity, transform, box-shadow", transitionDuration: "400ms" },
  stepOn: { backgroundColor: p.surface, borderColor: colors.primary },
  stepNum: { fontSize: 14, fontWeight: "800", color: p.accent, letterSpacing: 1, width: 24 },
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