import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { publicStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2, 300);
const CARD_SPACING = spacing.md;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

export default function LandingScreen() {
  const { status, isAuthenticated, emailVerified } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef(null);

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

  const handleScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP_INTERVAL);
    if (index !== activeSlide) setActiveSlide(index);
  };

  return (
    <View style={styles.root}>
      {/* Compact top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <NutriFitLogo small />
      </View>

      <View style={styles.body}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={require("@/assets/images/nutrifit-logo.png")} style={styles.heroLogo} contentFit="contain" />
          <Text style={styles.heroHeading}>Your Food. Your Fitness.{"\n"}Your Future.</Text>
          <Text style={styles.heroSubhead}>Scan meals, chat with an AI coach, and track it all in one app.</Text>
        </View>

        {/* Feature carousel */}
        <View style={styles.carouselSection}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            snapToAlignment="start"
            contentContainerStyle={styles.carouselContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.featureCard, { width: CARD_WIDTH }]}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={24} color={colors.green700} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {FEATURES.map((f, i) => (
              <View key={f.title} style={[styles.dot, i === activeSlide && styles.dotActive]} />
            ))}
          </View>
        </View>
      </View>

      {/* Bottom-anchored primary action */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton title="Get Started" onPress={() => router.push("/register")} style={styles.ctaBtn} />
        <Pressable onPress={() => router.push("/login")} hitSlop={8} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>I Already Have an Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...publicStyles,

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topBarLogin: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },

  body: { flex: 1, justifyContent: "center" },

  hero: { alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  heroLogo: { width: 64, height: 64, marginBottom: spacing.md },
  heroHeading: { ...typography.h1, color: colors.brandDark, textAlign: "center" },
  heroSubhead: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
    maxWidth: 320,
  },

  carouselSection: { marginTop: spacing.xl },
  carouselContent: { paddingHorizontal: spacing.lg, gap: CARD_SPACING },
  featureCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 168,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  bottomBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  ctaBtn: { width: "100%" },
  secondaryLink: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  secondaryLinkText: { ...typography.bodyBold, color: colors.green700 },
});