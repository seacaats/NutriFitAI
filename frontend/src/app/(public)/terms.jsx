import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { SECTIONS, splitTitle, TERMS_INTRO, TERMS_UPDATED } from "@/shared/constants/publicContent";
import { useTheme } from "@/shared/context/ThemeContext";
import { getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={back} hitSlop={12} style={styles.side} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={p.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms &amp; Privacy</Text>
        <View style={styles.sideEnd}>
          <ThemeToggle />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={30} color={p.accent} />
          </View>
          <Text style={styles.title}>Terms of Service &amp; Privacy Policy</Text>
          <Text style={styles.intro}>{TERMS_INTRO}</Text>
          <View style={styles.updated}>
            <Ionicons name="time-outline" size={13} color={p.accent} />
            <Text style={styles.updatedText}>Last updated {TERMS_UPDATED}</Text>
          </View>
        </View>

        {/* One card per section */}
        {SECTIONS.map((s) => {
          const [num, title] = splitTitle(s.title);
          return (
            <View key={s.title} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}>
                  <Ionicons name={s.icon || "document-text-outline"} size={20} color={p.accent} />
                </View>
                <View style={styles.flex1}>
                  {!!num && <Text style={styles.cardNum}>SECTION {num}</Text>}
                  <Text style={styles.cardTitle}>{title}</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>{s.body}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Colors come from the public palette, so the page follows the light/dark theme
const createStyles = (p) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg },
  flex1: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  side: { width: 40, padding: spacing.xs },
  sideEnd: { width: 40, alignItems: "flex-end" },
  headerTitle: { ...typography.bodyBold, color: p.ink, flex: 1, textAlign: "center" },

  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md },

  hero: { alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: p.tint, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { ...typography.h2, fontSize: 22, color: p.title, textAlign: "center" },
  intro: { ...typography.body, color: p.text, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 },
  updated: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: p.surface },
  updatedText: { ...typography.caption, fontWeight: "700", color: p.accent },

  card: { backgroundColor: p.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: p.tint, alignItems: "center", justifyContent: "center" },
  cardNum: { ...typography.tiny, fontWeight: "800", letterSpacing: 1, color: p.accent },
  cardTitle: { ...typography.bodyBold, fontSize: 16, color: p.ink, marginTop: 1 },
  cardBody: { ...typography.body, fontSize: 14, color: p.text, lineHeight: 22 },
});