import PrimaryButton from "@/components/nutrifit/PrimaryButton";
import { scanResult } from "@/data/placeholders";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

//placholder
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80";

export default function ScanScreen() {
  const router = useRouter();
  const [captured, setCaptured] = useState(true);
  const [adding, setAdding] = useState(false);

  const handleCapture = () => {
    //use expo imagepicker
    setCaptured(true);
  };

  const handleAddToMeal = () => {
    setAdding(true);
    setTimeout(() => {
      setAdding(false);
      router.push("/(tabs)/home");
    }, 700);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Food</Text>
        <View style={styles.headerIcons}>
          <Ionicons name="flash-outline" size={22} color={colors.textMuted} style={{ marginRight: 14 }} />
          <Ionicons name="ellipse-outline" size={24} color={colors.textMuted} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: PLACEHOLDER_IMAGE }} style={styles.image} />
          <Pressable style={styles.captureDot} onPress={handleCapture} />
        </View>

        {captured && (
          <>
            <View style={styles.resultRow}>
              <View style={styles.detectedCol}>
                <Text style={styles.sectionTitle}>Detected Food</Text>
                <View style={styles.foodRow}>
                  <View style={styles.foodDot} />
                  <Text style={styles.foodName}>{scanResult.foodName}</Text>
                  <Text style={styles.foodGrams}>{scanResult.grams}g</Text>
                </View>
              </View>

              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionTitle}>Total Nutrition</Text>
                <Text style={styles.nutritionKcal}>{scanResult.calories} kcal</Text>
                <View style={styles.nutritionRow}>
                  <View style={[styles.bar, { backgroundColor: colors.carbs }]} />
                  <Text style={styles.nutritionLabel}>Protein</Text>
                  <Text style={styles.nutritionValue}>{scanResult.protein}g</Text>
                </View>
                <View style={styles.nutritionRow}>
                  <View style={[styles.bar, { backgroundColor: colors.primary }]} />
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                  <Text style={styles.nutritionValue}>{scanResult.carbs}g</Text>
                </View>
                <View style={styles.nutritionRow}>
                  <View style={[styles.bar, { backgroundColor: colors.primary }]} />
                  <Text style={styles.nutritionLabel}>Fat</Text>
                  <Text style={styles.nutritionValue}>{scanResult.fat}g</Text>
                </View>
              </View>
            </View>

            <PrimaryButton title="Add to Meal" onPress={handleAddToMeal} loading={adding} style={styles.addBtn} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgWhite },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: spacing.md },
  headerTitle: { ...typography.h3 },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  container: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  imageWrap: { marginBottom: spacing.lg },
  image: { width: "100%", height: 340, borderRadius: radii.lg },
  captureDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.white, alignSelf: "center", marginTop: -26 },
  resultRow: { flexDirection: "row", gap: 12, marginBottom: spacing.lg },
  detectedCol: { flex: 1 },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  foodRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  foodDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  foodName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  foodGrams: { fontSize: 15, color: colors.textSecondary },
  nutritionCard: { flex: 1, backgroundColor: "#FDEDE3", borderRadius: radii.lg, padding: spacing.md },
  nutritionTitle: { ...typography.bodyBold, marginBottom: 4 },
  nutritionKcal: { fontSize: 22, fontWeight: "800", marginBottom: spacing.sm },
  nutritionRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 8 },
  bar: { width: 3, height: 14, borderRadius: 2 },
  nutritionLabel: { flex: 1, color: colors.textSecondary },
  nutritionValue: { fontWeight: "700", color: colors.textPrimary },
  addBtn: { marginTop: spacing.md },
});