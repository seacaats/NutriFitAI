import { colors, spacing, typography } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.docTitle}>Terms of Service &amp; Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last updated: September 2026</Text>

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { padding: spacing.xs, width: 40 },
  headerTitle: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, textAlign: "center" },
  headerSpacer: { width: 40 },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  docTitle: { ...typography.h1, color: colors.brandDark },
  lastUpdated: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },

  section: { marginTop: spacing.xl },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  sectionBody: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
});