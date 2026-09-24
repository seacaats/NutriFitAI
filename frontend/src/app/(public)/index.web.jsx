import PublicFooter from "@/shared/components/layout/PublicFooter";
import PublicHeader from "@/shared/components/layout/PublicHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { publicStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const FEATURES = [
  {
    icon: "scan-outline",
    title: "Food Scanner",
    body: "Point your camera at a meal and get an instant breakdown of calories, protein, carbs, and fat.",
  },
  {
    icon: "chatbubbles-outline",
    title: "AI Coach",
    body: "Chat with a coach that knows your goals, your diet preference, and any health conditions you've shared.",
  },
  {
    icon: "barbell-outline",
    title: "Workout Tracking",
    body: "Log sessions from a curated routine or a single exercise, and see your history at a glance.",
  },
  {
    icon: "trending-up-outline",
    title: "Progress Tracking",
    body: "Weight, steps, and water intake over time -- so you can see what's actually trending, not just today.",
  },
];

export default function LandingScreen() {
  const { status, isAuthenticated, emailVerified } = useAuth();
  const router = useRouter();

  if (status === AUTH_STATUS.LOADING) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  if (isAuthenticated && emailVerified) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PublicHeader isAuthenticated={isAuthenticated} />

        {/* Hero */}
        <View style={styles.hero}>
          <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.heroLogo} contentFit="contain" />
          <Text style={styles.heroHeading}>NutriFitAI</Text>
          <Text style={styles.heroQuote}>
            Your Food. Your Fitness. Your Future.{"\n"}Scan. Understand. Improve.
          </Text>
          <Text style={styles.heroBody}>
            One app to scan your meals, chat with an AI coach that actually knows your goals, and track workouts,
            weight, and water -- all in one place.
          </Text>

          <View style={styles.heroActions}>
            <PrimaryButton title="Get Started" onPress={() => router.push("/register")} style={styles.heroBtn} />
            <Pressable style={[styles.heroBtn, styles.heroBtnSecondary]} onPress={() => router.push("/login")}>
              <Text style={styles.heroBtnSecondaryText}>I Already Have an Account</Text>
            </Pressable>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionHeading}>Everything you need, in one app</Text>

          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={22} color={colors.green700} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            ))}
          </View>
        </View>
        <PublicFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ...publicStyles,

  scroll: { flexGrow: 1 },

  hero: { alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl, maxWidth: 640, alignSelf: "center", width: "100%" },
  heroLogo: { width: 96, height: 96, marginBottom: spacing.md },
  heroHeading: { ...typography.brandHeading, color: colors.brandDark, textAlign: "center" },
  heroQuote: { ...typography.h3, color: colors.green700, textAlign: "center", marginTop: spacing.sm },
  heroBody: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl, justifyContent: "center" },
  heroBtn: { minWidth: 200 },
  heroBtnSecondary: {
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 12,
  },
  heroBtnSecondaryText: { ...typography.button, color: colors.green700 },

  featuresSection: { backgroundColor: colors.white, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  sectionHeading: { ...typography.h2, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.xl },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center",
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
  },
  featureCard: {
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: 260,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  ctaBanner: { backgroundColor: colors.primary, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" },
  ctaHeading: { ...typography.h2, color: colors.white, textAlign: "center" },
  ctaBody: { ...typography.body, color: colors.white, textAlign: "center", marginTop: spacing.sm, opacity: 0.9 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    minWidth: 220,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
  },
  ctaBtnIcon: { marginRight: 8 },
  ctaBtnText: { ...typography.button, color: colors.primary },
});