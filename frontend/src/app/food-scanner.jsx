import DashboardLayout from "@components/nutrifit/DashboardLayout";
import FoodAnalysisChat from "@components/nutrifit/FoodAnalysisChat";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


const DETECTED_FOOD = { name: "Lasagna", grams: "250g" };
const NUTRITION = { kcal: 520, protein: "26.4g", carbs: "51.8g", fat: "23.8g" };

export default function FoodScannerScreen() {
  const { darkMode, shell: c } = useTheme();

  const [selectedImage, setSelectedImage] = useState(null);

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const mutedText = { color: "#6a7282" };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    setSelectedImage(result.assets[0].uri);
  };

  const retake = () => setSelectedImage(null);

  return (
    <DashboardLayout hideTabBar>
      {/* Top Bar*/}
      <View style={styles.topBar}>
        <Pressable hitSlop={8} onPress={selectedImage ? retake : undefined}>
          <Ionicons name="chevron-back" size={22} color={c.sidebarText} />
        </Pressable>

        <Text style={[styles.topBarTitle, textColor]}>Scan Food</Text>

        <View style={styles.topBarIcons}>
          <Ionicons name="flash-outline" size={20} color={c.notifIcon} />
          <Ionicons name="ellipse-outline" size={20} color={c.notifIcon} />
        </View>
      </View>

      {selectedImage ? (
        <>
          {/* Image Preview */}
          <View style={styles.imageWrap}>
            <Image source={{ uri: selectedImage }} style={styles.image} contentFit="cover" />
            <View style={styles.markerDot} />
          </View>

          {/* Detected Food */}
          <View style={styles.detectedRow}>
            <View style={styles.detectedLeft}>
              <Text style={[styles.detectedHeading, textColor]}>Detected Food</Text>
              <View style={styles.detectedItemRow}>
                <View style={styles.detectedDot} />
                <Text style={[styles.detectedItemText, textColor]}>{DETECTED_FOOD.name}</Text>
                <Text style={styles.detectedItemGrams}>{DETECTED_FOOD.grams}</Text>
              </View>
            </View>

            {/* Total Nutrition */}
            {/* No orange token exists in shellColors, so this pastel stays bespoke */}
            <View style={[styles.nutritionCard, { backgroundColor: darkMode ? "#2c2620" : "#fdf1ea" }]}>
              <Text style={[styles.nutritionHeading, textColor]}>Total Nutrition</Text>
              <Text style={[styles.nutritionKcal, textColor]}>{NUTRITION.kcal} kcal</Text>

              <NutritionRow label="Protein" value={NUTRITION.protein} color="#fb923c" textColor={textColor} />
              <NutritionRow label="Carbs" value={NUTRITION.carbs} color="#4CAF2F" textColor={textColor} />
              <NutritionRow label="Fat" value={NUTRITION.fat} color="#4CAF2F" textColor={textColor} />
            </View>
          </View>

          {/* Add to Meal */}
          <Pressable style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add to Meal</Text>
          </Pressable>

          <View style={styles.chatSection}>
            <FoodAnalysisChat food={DETECTED_FOOD} nutrition={NUTRITION} darkMode={darkMode} />
          </View>
        </>
      ) : (
        <>
          {/* Empty State */}
          <View style={[styles.scanZone, { backgroundColor: c.activeNavBg }]}>
            <View style={styles.scanIconCircle}>
              <Ionicons name="camera" size={30} color="#fff" />
            </View>

            <Text style={styles.scanTitle}>Scan or Upload Food</Text>
            <Text style={[styles.scanDesc, mutedText]}>Take a photo of your food or upload from your gallery.</Text>
          </View>

          <Pressable
            onPress={pickImage}
            style={[styles.uploadBtn, { borderColor: card.borderColor, backgroundColor: c.cardBg }]}
          >
            <Ionicons name="cloud-upload-outline" size={17} color="#4CAF2F" />
            <Text style={styles.uploadBtnText}>Upload Image</Text>
          </Pressable>
        </>
      )}
    </DashboardLayout>
  );
}

function NutritionRow({ label, value, color, textColor }) {
  return (
    <View style={styles.nutritionRow}>
      <View style={[styles.nutritionBar, { backgroundColor: color }]} />
      <Text style={[styles.nutritionLabel, textColor]}>{label}</Text>
      <Text style={[styles.nutritionValue, textColor]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  topBarTitle: { fontSize: 17, fontWeight: "700" },
  topBarIcons: { flexDirection: "row", gap: 12 },

  // Empty state
  scanZone: {
    minHeight: 260,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4CAF2F",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#4CAF2F", alignItems: "center", justifyContent: "center" },
  scanTitle: { marginTop: 16, fontSize: 14, fontWeight: "700", color: "#4CAF2F" },
  scanDesc: { marginTop: 4, maxWidth: 260, textAlign: "center", fontSize: 12 },

  uploadBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingVertical: 12,
  },
  uploadBtnText: { fontSize: 14, fontWeight: "600", color: "#4CAF2F" },

  // Result state
  imageWrap: { borderRadius: radii.sm, overflow: "visible" },
  image: { width: "100%", height: 260, borderRadius: radii.sm },
  markerDot: {
    position: "absolute",
    bottom: -14,
    alignSelf: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4CAF2F",
    borderWidth: 3,
    borderColor: "#ffffff",
  },

  detectedRow: { flexDirection: "row", gap: 12, marginTop: 28, alignItems: "flex-start" },
  detectedLeft: { flex: 1 },
  detectedHeading: { fontSize: 15, fontWeight: "700" },
  detectedItemRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  detectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF2F" },
  detectedItemText: { fontSize: 13, fontWeight: "500" },
  detectedItemGrams: { fontSize: 13, color: "#6a7282" },

  nutritionCard: { flex: 1, borderRadius: radii.sm, padding: 14 },
  nutritionHeading: { fontSize: 13, fontWeight: "700" },
  nutritionKcal: { fontSize: 20, fontWeight: "800", marginTop: 4, marginBottom: 8 },
  nutritionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  nutritionBar: { width: 3, height: 12, borderRadius: 2 },
  nutritionLabel: { flex: 1, fontSize: 11 },
  nutritionValue: { fontSize: 11, fontWeight: "700" },

  addBtn: { marginTop: 28, borderRadius: radii.sm, backgroundColor: "#4CAF2F", paddingVertical: 14, alignItems: "center" },
  addBtnText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  chatSection: { marginTop: 16, marginBottom: 16 },
});
