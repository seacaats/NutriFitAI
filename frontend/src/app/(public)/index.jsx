import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { FEATURES, HERO } from "@/shared/constants/publicContent";
import { AUTH_STATUS, homeFor, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getChipTint, getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Onboarding: a welcome page, then one page per feature, swiped or stepped
// through with Next. Always starts on the welcome page, including when a
// signed-out user comes back to the app (useLandingOnResume)
const SLIDES = [{ key: "welcome" }, ...FEATURES.map((f) => ({ key: f.title, ...f }))];
const LAST = SLIDES.length - 1;

export default function LandingScreen() {
  const { status, isAuthenticated, emailVerified, role } = useAuth();
  const router = useRouter();
  // Opened from the app's menu (?from=app): show the page instead of skipping it
  const { from } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { darkMode } = useTheme();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const signedIn = isAuthenticated && emailVerified;

  // Back from the background while signed out: start over on the first page
  const previous = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const resumed = previous.current === "background" && next === "active";
      previous.current = next;
      if (!resumed || signedIn) return;
      setPage(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
    return () => sub.remove();
  }, [signedIn]);

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  // App launch still goes straight in
  if (signedIn && from !== "app") return <Redirect href={homeFor(role)} />;

  const goTo = (i) => {
    setPage(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) setPage(i);
  };

  const leave = (route) => router.push(route);

  const last = page === LAST;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Skip jumps to the last page */}
      <View style={styles.topBar}>
        {from === "app" ? (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={p.text} />
          </Pressable>
        ) : <View />}
        <View style={styles.topEnd}>
          {!last && (
            <Pressable onPress={() => goTo(LAST)} hitSlop={10}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
          <ThemeToggle />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            {slide.key === "welcome" ? <Welcome styles={styles} p={p} /> : <Feature slide={slide} styles={styles} darkMode={darkMode} />}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Pressable key={s.key} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Page ${i + 1}`}>
            <View style={[styles.dot, i === page && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* Actions stay in thumb reach */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        {signedIn ? (
          <PrimaryButton title="Back to NutriFitAI" onPress={() => router.replace(homeFor(role))} style={styles.fullBtn} />
        ) : last ? (
          <>
            <PrimaryButton title="Create an Account" onPress={() => leave("/register")} style={styles.fullBtn} />
            <Pressable onPress={() => leave("/login")} style={styles.outlineBtn}>
              <Text style={styles.outlineText}>Log In</Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton title="Next" onPress={() => goTo(page + 1)} style={styles.fullBtn} />
            <View style={styles.loginRow}>
              <Text style={styles.muted}>Already have an account? </Text>
              <Pressable onPress={() => leave("/login")} hitSlop={8}>
                <Text style={styles.link}>Log In</Text>
              </Pressable>
            </View>
          </>
        )}

        <Pressable onPress={() => router.push("/terms")} hitSlop={8} style={styles.termsLink}>
          <Text style={styles.terms}>Terms of Service & Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Welcome({ styles, p }) {
  return (
    <View style={styles.slideInner}>
      <View style={[styles.art, { backgroundColor: p.surface }]}>
        <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.logo} contentFit="contain" />
      </View>
      <Text style={styles.brand}>NutriFitAI</Text>
      <Text style={styles.title}>{HERO.title}</Text>
      <Text style={styles.body}>{HERO.body}</Text>
    </View>
  );
}

function Feature({ slide, styles, darkMode }) {
  const tint = getChipTint(slide.tint, darkMode);
  return (
    <View style={styles.slideInner}>
      <View style={[styles.art, { backgroundColor: tint.backgroundColor }]}>
        <Ionicons name={slide.icon.replace(/-outline$/, "")} size={72} color={tint.icon} />
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>
  );
}

// Colors come from the public palette, so the page follows the light/dark theme
const createStyles = (p) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },

  topBar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  topEnd: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  skip: { ...typography.bodyBold, color: p.text },

  pager: { flex: 1 },
  slide: { flex: 1, justifyContent: "center" },
  slideInner: { alignItems: "center", paddingHorizontal: spacing.xl },
  // Big round "illustration" each page leads with
  art: { width: 200, height: 200, borderRadius: 100, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  logo: { width: 110, height: 122 },
  brand: { ...typography.bodyBold, color: p.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  title: { ...typography.h1, color: p.title, textAlign: "center" },
  body: { ...typography.body, color: p.text, textAlign: "center", marginTop: spacing.md, lineHeight: 22, maxWidth: 340 },

  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.border },
  dotActive: { width: 24, backgroundColor: colors.primary },

  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  fullBtn: { width: "100%" },
  outlineBtn: { height: 48, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  outlineText: { ...typography.button, color: p.accent },
  loginRow: { flexDirection: "row", justifyContent: "center", paddingVertical: spacing.sm },
  muted: { ...typography.body, color: p.text },
  link: { ...typography.bodyBold, color: p.accent },
  termsLink: { alignItems: "center", paddingVertical: spacing.xs },
  terms: { ...typography.caption, color: p.muted },
});