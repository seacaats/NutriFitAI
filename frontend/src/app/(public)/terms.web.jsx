import PublicFooter from "@/shared/components/layout/PublicFooter";
import PublicHeader from "@/shared/components/layout/PublicHeader";
import { useAuth } from "@/shared/context/AuthContext";
import { colors, spacing, typography } from "@/shared/theme/nutrifit";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const SECTIONS = [
  {
    title: "1. Using NutriFit AI",
    body: "NutriFit AI provides fitness tracking, nutrition guidance, and an AI coaching assistant. By creating an account, you agree to use the service honestly and to keep your login credentials secure.",
  },
  {
    title: "2. Health & Dietary Information",
    body:
      "During registration and while using your profile, you may choose to share information such as your diet " +
      "preference and any health conditions. We collect and store this information only to personalize your " +
      "nutrition and fitness recommendations -- for example, adjusting meal guidance around a food allergy or a " +
      "medical condition you tell us about.\n\n" +
      "This information is optional. Checking the consent box on the registration form means you agree to let " +
      "NutriFit AI collect, store, and use the dietary and health details you provide for this purpose. You can " +
      "review, edit, or remove this information at any time from your Profile page.",
  },
  {
    title: "3. Other Account & Activity Data",
    body: "We also store the account details you provide (name, email, age, height, weight) and the activity you log (workouts, weight entries, chats with your AI coach) so the app can show your history and progress over time.",
  },
  {
    title: "4. Data Sharing",
    body: "We do not sell your personal or health information. Data is used only to operate and improve NutriFit AI, and is shared with service providers solely as needed to run the app (for example, hosting and email delivery).",
  },
  {
    title: "5. Your Choices",
    body: "You can update your profile information, change your consent preferences, or request that your account and its data be deleted, at any time from within the app.",
  },
  {
    title: "6. Changes to This Policy",
    body: "We may update these terms as NutriFit AI evolves. Continuing to use the app after a change means you accept the updated terms.",
  },
];

export default function TermsScreen() {
  const { isAuthenticated } = useAuth();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PublicHeader isAuthenticated={isAuthenticated} />

        <View style={styles.hero}>
          <Text style={styles.heroHeading}>Terms of Service &amp; Privacy Policy</Text>
          <Text style={styles.heroSubheading}>Last updated: September 2026</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.copyWrap}>
            {SECTIONS.map((s, i) => (
              <View key={s.title} style={[styles.section, i > 0 && styles.sectionDivider]}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
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
  root: { flex: 1, backgroundColor: colors.bgMint },
  scroll: { flexGrow: 1 },

  hero: { alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  heroHeading: { ...typography.h1, color: colors.brandDark, textAlign: "center" },
  heroSubheading: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  // Full-bleed white panel -- no maxWidth here on purpose.
  panel: { width: "100%", backgroundColor: colors.white, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  copyWrap: { width: "100%", maxWidth: 1160, alignSelf: "center" },

  section: { paddingVertical: spacing.md },
  sectionDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 8 },
  sectionBody: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});