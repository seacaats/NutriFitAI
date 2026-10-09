import PublicFooter from "@/shared/components/layout/PublicFooter";
import PublicHeader from "@/shared/components/layout/PublicHeader";
import { SECTIONS, splitTitle, TERMS_INTRO, TERMS_UPDATED } from "@/shared/constants/publicContent";
import { useAuth } from "@/shared/context/AuthContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Contents list beside the sections above this width, hidden below
const WIDE = 900;

export default function TermsScreen() {
  const { isAuthenticated, emailVerified } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const scrollRef = useRef(null);
  // Each section's offset in the page, for the contents links
  const offsets = useRef({});
  const bodyTop = useRef(0);
  const [hovered, setHovered] = useState(null);

  const jump = (key) => {
    // The band's top padding sits between its edge and the first card
    const y = bodyTop.current + spacing.xxl + (offsets.current[key] ?? 0) - spacing.md;
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <PublicHeader isAuthenticated={isAuthenticated && emailVerified} />

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={34} color={colors.green700} />
          </View>
          <Text style={styles.title}>Terms of Service &amp; Privacy Policy</Text>
          <Text style={styles.intro}>{TERMS_INTRO}</Text>
          <View style={styles.updated}>
            <Ionicons name="time-outline" size={14} color={colors.green700} />
            <Text style={styles.updatedText}>Last updated {TERMS_UPDATED}</Text>
          </View>
        </View>

        <View style={styles.band} onLayout={(e) => { bodyTop.current = e.nativeEvent.layout.y; }}>
          <View style={[styles.body, wide && styles.bodyWide]}>
            {/* Contents */}
            {wide && (
              <View style={styles.toc}>
                <Text style={styles.tocLabel}>ON THIS PAGE</Text>
                {SECTIONS.map((s) => {
                  const [num, title] = splitTitle(s.title);
                  const on = hovered === s.title;
                  return (
                    <Pressable
                      key={s.title}
                      onPress={() => jump(s.title)}
                      onHoverIn={() => setHovered(s.title)}
                      onHoverOut={() => setHovered(null)}
                      style={[styles.tocItem, on && styles.tocItemOn]}
                    >
                      <Text style={[styles.tocNum, on && styles.tocTextOn]}>{num}</Text>
                      <Text style={[styles.tocText, on && styles.tocTextOn]} numberOfLines={1}>{title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Sections */}
            <View style={styles.sections}>
              {SECTIONS.map((s) => {
                const [num, title] = splitTitle(s.title);
                return (
                  <View
                    key={s.title}
                    style={styles.card}
                    onLayout={(e) => { offsets.current[s.title] = e.nativeEvent.layout.y; }}
                  >
                    <View style={styles.cardHead}>
                      <View style={styles.cardIcon}>
                        <Ionicons name={s.icon || "document-text-outline"} size={22} color={colors.green700} />
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
            </View>
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
  flex1: { flex: 1 },

  hero: { alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl, maxWidth: 720, alignSelf: "center", width: "100%" },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { ...typography.h1, fontSize: 32, color: colors.brandDark, textAlign: "center" },
  intro: { ...typography.body, fontSize: 17, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 26 },
  updated: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white },
  updatedText: { ...typography.caption, fontSize: 13, fontWeight: "700", color: colors.green700 },

  band: { backgroundColor: colors.white, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  body: { width: "100%", maxWidth: 1040, alignSelf: "center", gap: spacing.xl },
  bodyWide: { flexDirection: "row", alignItems: "flex-start" },

  // Sticks beside the sections while they scroll past (web CSS)
  toc: { width: 240, position: "sticky", top: spacing.lg, gap: 2 },
  tocLabel: { ...typography.tiny, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted, marginBottom: spacing.sm, paddingHorizontal: 10 },
  tocItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.sm },
  tocItemOn: { backgroundColor: colors.greenTint },
  tocNum: { width: 18, fontSize: 13, fontWeight: "800", color: colors.textMuted },
  tocText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  tocTextOn: { color: colors.green700 },

  sections: { flex: 1, gap: spacing.md },
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.white },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: spacing.md },
  cardIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" },
  cardNum: { ...typography.tiny, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.green700 },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 2 },
  cardBody: { ...typography.body, color: colors.textSecondary, lineHeight: 25 },
});