import { colors, spacing, typography } from "@/shared/theme/nutrifit";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const BREAKPOINT = 640;

export default function PublicFooter() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stacked = width < BREAKPOINT;

  return (
    <View style={styles.footer}>
      <View style={[styles.row, stacked && styles.rowStacked]}>
        <View style={[styles.links, stacked && styles.linksStacked]}>
          <Pressable onPress={() => router.push("/terms")} hitSlop={8}>
            <Text style={styles.link}>Terms of Service &amp; Privacy Policy</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.copyright}>© {new Date().getFullYear()} NutriFitAI. All rights reserved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: colors.brandPanel, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, },
  rowStacked: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  brandCol: { gap: 6, maxWidth: 320 },
  tagline: { ...typography.caption, color: colors.quoteText },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, alignItems: "flex-start" },
  linksStacked: { gap: spacing.sm },
  link: { ...typography.caption, color: colors.white, fontWeight: "600" },
  divider: { height: 1, marginVertical: spacing.lg },
  copyright: { ...typography.tiny, color: colors.quoteText, textAlign: "center" },
});