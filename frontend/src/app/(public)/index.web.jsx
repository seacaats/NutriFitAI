import PublicFooter from "@/shared/components/layout/PublicFooter";
import PublicHeader from "@/shared/components/layout/PublicHeader";
import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { FEATURES, HERO, STEPS } from "@/shared/constants/publicContent";
import { AUTH_STATUS, homeFor, useAuth } from "@/shared/context/AuthContext";
import { chipTints, colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Side by side above this width, stacked below
const WIDE = 900;

export default function LandingScreen() {
  const { status, isAuthenticated, emailVerified, role } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  // Signed-in users can visit too; the buttons take them back in instead
  const signedIn = isAuthenticated && emailVerified;
  const home = homeFor(role);

  const actions = signedIn ? (
    <PrimaryButton title="Go to Dashboard" onPress={() => router.push(home)} style={styles.btn} />
  ) : (
    <>
      <PrimaryButton title="Get Started" onPress={() => router.push("/register")} style={styles.btn} />
      <Pressable onPress={() => router.push("/login")} style={[styles.btn, styles.outlineBtn]}>
        <Text style={styles.outlineText}>I Already Have an Account</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PublicHeader isAuthenticated={signedIn} />

        {/* Hero: pitch on the left, the features at a glance on the right */}
        <View style={[styles.section, styles.hero, wide && styles.heroWide]}>
          <View style={[styles.heroText, wide && styles.heroTextWide]}>
            <Text style={styles.tagline}>{HERO.tagline}</Text>
            <Text style={[styles.heroTitle, !wide && styles.center]}>{HERO.title}</Text>
            <Text style={[styles.heroBody, !wide && styles.center]}>{HERO.body}</Text>
            <View style={[styles.actions, !wide && styles.actionsCenter]}>{actions}</View>
          </View>

          <View style={styles.preview}>
            <View style={styles.previewHead}>
              <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.previewLogo} contentFit="contain" />
              <Text style={styles.previewBrand}>NutriFitAI</Text>
            </View>
            {FEATURES.map((f) => {
              const tint = chipTints[f.tint] || chipTints.green;
              return (
                <View key={f.title} style={styles.previewRow}>
                  <View style={[styles.previewIcon, { backgroundColor: tint.light }]}>
                    <Ionicons name={f.icon} size={18} color={tint.icon} />
                  </View>
                  <Text style={styles.previewText}>{f.title}</Text>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                </View>
              );
            })}
          </View>
        </View>

        {/* Features */}
        <View style={styles.band}>
          <View style={styles.section}>
            <Text style={styles.heading}>Everything you need, in one app</Text>
            <View style={styles.grid}>
              {FEATURES.map((f) => {
                const tint = chipTints[f.tint] || chipTints.green;
                return (
                  <View key={f.title} style={styles.card}>
                    <View style={[styles.cardIcon, { backgroundColor: tint.light }]}>
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
        <View style={styles.section}>
          <Text style={styles.heading}>How it works</Text>
          <View style={styles.grid}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Ionicons name={s.icon} size={26} color={colors.green700} style={styles.stepIcon} />
                <Text style={[styles.cardTitle, styles.center]}>{s.title}</Text>
                <Text style={[styles.cardBody, styles.center]}>{s.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Closing call to action */}
        {!signedIn && (
          <View style={styles.cta}>
            <Text style={styles.ctaTitle}>Ready to start?</Text>
            <Text style={styles.ctaBody}>Create your account and set your goals.</Text>
            <Pressable onPress={() => router.push("/register")} style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>Create Your Account</Text>
            </Pressable>
          </View>
        )}

        <PublicFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
  scroll: { flexGrow: 1 },
  center: { textAlign: "center" },

  section: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  heading: { ...typography.h2, fontSize: 26, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.xl },

  hero: { gap: spacing.xl, alignItems: "center" },
  heroWide: { flexDirection: "row", justifyContent: "space-between" },
  heroText: { alignItems: "center", maxWidth: 560 },
  heroTextWide: { alignItems: "flex-start", flex: 1 },
  tagline: { ...typography.bodyBold, color: colors.green700, letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { ...typography.brandHeading, color: colors.brandDark, marginTop: spacing.sm, lineHeight: 48 },
  heroBody: { ...typography.body, fontSize: 17, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 26 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  actionsCenter: { justifyContent: "center" },
  btn: { minWidth: 210 },
  outlineBtn: { height: 44, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  outlineText: { ...typography.button, color: colors.green700 },

  // A small "app card" standing in for a screenshot
  preview: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  previewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  previewLogo: { width: 32, height: 36 },
  previewBrand: { ...typography.h3, color: colors.brandDark },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.bgMint },
  previewIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  previewText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },

  band: { backgroundColor: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  card: { flexGrow: 1, flexBasis: 220, maxWidth: 260, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cardIcon: { width: 44, height: 44, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
  cardBody: { ...typography.caption, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  step: { flexGrow: 1, flexBasis: 240, maxWidth: 320, alignItems: "center", padding: spacing.lg },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  stepIcon: { marginVertical: spacing.md },

  cta: { backgroundColor: colors.primary, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" },
  ctaTitle: { ...typography.h2, fontSize: 26, color: colors.white, textAlign: "center" },
  ctaBody: { ...typography.body, color: colors.white, opacity: 0.9, marginTop: spacing.sm, textAlign: "center" },
  ctaBtn: { marginTop: spacing.lg, minWidth: 220, height: 46, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ctaBtnText: { ...typography.button, color: colors.green700 },
});