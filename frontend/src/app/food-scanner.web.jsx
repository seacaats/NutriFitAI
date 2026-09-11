import DashboardLayout from "@components/nutrifit/DashboardLayout";
import FoodAnalysisChat from "@components/nutrifit/FoodAnalysisChat";
import { useTheme } from "@context/ThemeContext";
import { radii, spacing } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const RECENT_SCANS = [
  { name: "Mixed Fruits", calories: "250 kcal", time: "Today, 12:45 PM" },
  { name: "Vegetable Macaroni", calories: "450 kcal", time: "Today, 8:15 AM" },
  { name: "Vegetable Salad", calories: "320 kcal", time: "Today, 7:30 AM" },
];

const DETECTED_FOOD = { name: "Lasagna", grams: "250g" };
const NUTRITION = { kcal: 520, protein: "26.4g", carbs: "51.8g", fat: "23.8g" };

export default function FoodScannerScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { darkMode } = useTheme();

  const [selectedImage, setSelectedImage] = useState(null);
  const [fileName, setFileName] = useState("");

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb",
  };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };
  const mutedText = { color: "#6a7282" };

  // Select image
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    setSelectedImage(asset.uri);
    setFileName(asset.fileName || asset.uri.split("/").pop() || "photo.jpg");
  };

  // Remove image
  const removeImage = () => {
    setSelectedImage(null);
    setFileName("");
  };

  return (
    <DashboardLayout>
      <View style={[styles.row, narrow && styles.stackRow]}>
        {/* Scan Area */}
        <View style={[styles.card, card, styles.flexHalf]}>
          <Text style={[styles.heading, textColor]}>Scan Food</Text>
          <Text style={[styles.subheading, mutedText]}>Take a photo or upload an image of your food.</Text>

          <View style={[styles.scanArea, { backgroundColor: darkMode ? "#253522" : "#f0ffe9" }]}>
            {selectedImage ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} contentFit="contain" />

                <Pressable onPress={removeImage} style={styles.removeBtn}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>

                <Text style={[styles.fileName, mutedText]}>{fileName}</Text>
              </View>
            ) : (
              <>
                <View style={styles.scanIconCircle}>
                  <Ionicons name="camera" size={30} color="#fff" />
                </View>

                <Text style={styles.scanTitle}>Scan or Upload Food</Text>

                <Text style={[styles.scanDesc, mutedText]}>
                  Take a photo of your food or upload from your gallery.
                </Text>
              </>
            )}
          </View>

          {/* Upload Button */}
          <Pressable
            onPress={pickImage}
            style={[styles.uploadBtn, { borderColor: card.borderColor, backgroundColor: darkMode ? "#252525" : "#ffffff" }]}
          >
            <Ionicons name="cloud-upload-outline" size={17} color="#4CAF2F" />
            <Text style={styles.uploadBtnText}>Upload Image</Text>
          </Pressable>
        </View>

        {/* Scan History */}
        <View style={[styles.card, card, styles.flexHalf]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.heading, textColor]}>Recent Scans</Text>
            <Pressable>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.scansList}>
            {RECENT_SCANS.map((scan) => (
              <RecentScan key={scan.name} {...scan} dark={darkMode} borderColor={card.borderColor} textColor={textColor} />
            ))}
          </View>
        </View>
      </View>

      {selectedImage && (
        <View style={[styles.analysisRow, narrow && styles.stackRow]}>
          <View style={[styles.card, card, styles.resultCard]}>
            <View style={styles.resultHeader}>
              <View style={styles.detectedIcon}><Ionicons name="checkmark" size={18} color="#ffffff" /></View>
              <View>
                <Text style={[styles.resultEyebrow, mutedText]}>DETECTED FOOD</Text>
                <Text style={[styles.resultName, textColor]}>{DETECTED_FOOD.name}</Text>
                <Text style={[styles.resultServing, mutedText]}>Estimated serving: {DETECTED_FOOD.grams}</Text>
              </View>
            </View>
            <Text style={[styles.nutritionTitle, textColor]}>Nutrition estimate</Text>
            <View style={styles.nutritionGrid}>
              <NutritionMetric label="Calories" value={`${NUTRITION.kcal}`} suffix="kcal" color="#fb923c" textColor={textColor} />
              <NutritionMetric label="Protein" value={NUTRITION.protein} color="#4CAF2F" textColor={textColor} />
              <NutritionMetric label="Carbs" value={NUTRITION.carbs} color="#60a5fa" textColor={textColor} />
              <NutritionMetric label="Fat" value={NUTRITION.fat} color="#f59e0b" textColor={textColor} />
            </View>
          </View>
          <View style={styles.chatWrap}>
            <FoodAnalysisChat food={DETECTED_FOOD} nutrition={NUTRITION} darkMode={darkMode} />
          </View>
        </View>
      )}
    </DashboardLayout>
  );
}

function NutritionMetric({ label, value, suffix, color, textColor }) {
  return (
    <View style={styles.nutritionMetric}>
      <View style={[styles.metricLine, { backgroundColor: color }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, textColor]}>{value}<Text style={styles.metricSuffix}> {suffix}</Text></Text>
    </View>
  );
}

function RecentScan({ name, calories, time, dark, borderColor, textColor }) {
  return (
    <Pressable style={[styles.scanRow, { borderColor }]}>
      <View style={[styles.scanThumb, { backgroundColor: dark ? "#364153" : "#e5e7eb" }]} />

      <View style={styles.flex1}>
        <Text style={[styles.scanName, textColor]}>{name}</Text>
        <Text style={styles.scanCalories}>{calories}</Text>
        <Text style={styles.scanTime}>{time}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 16 },
  stackRow: { flexDirection: "column" },
  flexHalf: { flex: 1 },
  flex1: { flex: 1 },
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  heading: { fontSize: 17, fontWeight: "700" },
  subheading: { fontSize: 12, marginTop: 4 },
  viewAll: { fontSize: 12, fontWeight: "600", color: "#4CAF2F" },

  // Scan area
  scanArea: {
    marginTop: 20,
    minHeight: 285,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4CAF2F",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4CAF2F",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: { marginTop: 16, fontSize: 14, fontWeight: "700", color: "#4CAF2F" },
  scanDesc: { marginTop: 4, maxWidth: 260, textAlign: "center", fontSize: 12 },

  previewWrap: { width: "100%", position: "relative" },
  previewImage: { width: "100%", height: 230, borderRadius: radii.sm },
  removeBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fb2c36",
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { marginTop: 12, textAlign: "center", fontSize: 12 },

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

  // Scan history
  scansList: { marginTop: 16, gap: spacing.sm },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 8,
  },
  scanThumb: { width: 64, height: 64, borderRadius: 6 },
  scanName: { fontSize: 14, fontWeight: "600" },
  scanCalories: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#4CAF2F" },
  scanTime: { marginTop: 4, fontSize: 10, color: "#6a7282" },

  // Scan result and result-aware assistant
  analysisRow: { flexDirection: "row", gap: 16, marginTop: 16, alignItems: "stretch" },
  resultCard: { flex: 0.75 },
  chatWrap: { flex: 1.25 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  detectedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#4CAF2F", alignItems: "center", justifyContent: "center" },
  resultEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  resultName: { marginTop: 2, fontSize: 20, fontWeight: "800" },
  resultServing: { marginTop: 2, fontSize: 10 },
  nutritionTitle: { marginTop: 22, marginBottom: 10, fontSize: 12, fontWeight: "700" },
  nutritionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nutritionMetric: { width: "48%", minHeight: 68, borderRadius: 8, backgroundColor: "rgba(127,127,127,0.07)", padding: 10 },
  metricLine: { width: 22, height: 3, borderRadius: 2, marginBottom: 7 },
  metricLabel: { color: "#6a7282", fontSize: 9 },
  metricValue: { marginTop: 2, fontSize: 15, fontWeight: "800" },
  metricSuffix: { color: "#6a7282", fontSize: 9, fontWeight: "500" },
});
