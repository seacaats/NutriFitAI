import { FoodCamera, NutritionGoalsCard, RecentMealsCard, RecentScansCard, ScanResultCard } from "@/features/food/components/FoodScanCards";
import { RESULT_CARD_MIN_HEIGHT, ScanImage } from "@/features/food/components/FoodScanParts";
import { useFoodScanner } from "@/features/food/hooks/useFoodScanner";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, radii, shellColors } from "@/shared/theme/nutrifitai";
import { foodScannerStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function FoodScannerScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { darkMode, shell: c } = useTheme();
  const router = useRouter();
  const { meals, scanner, cameraOpen, setCameraOpen, takePhoto, pickImage, newScan, openRecent, first, scanning, imageUri } = useFoodScanner();

  const { card, textColor, mutedText } = getScreenPalette(darkMode);
  // Side by side, both cards of a row fill its height so their edges line up
  const fill = narrow ? null : styles.fill;

  return (
    <DashboardLayout>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: c.sidebarText }]}>Food Scanner</Text>
        <Text style={[styles.pageSubtitle, mutedText]}>Scan your food and get personalized nutrition insights.</Text>
      </View>

      {/* Recent first: Recent Meals | Recent Scans */}
      <View style={[styles.row, narrow && styles.stackRow]}>
        <View style={[styles.flex1, narrow && styles.stackItem]}>
          <RecentMealsCard meals={meals} darkMode={darkMode} onViewAll={() => router.push("/food-scanner/meal-history")} style={fill} loading={first} />
        </View>
        <View style={[styles.flex1, narrow && styles.stackItem]}>
          <RecentScansCard
            scans={scanner.recent}
            loading={first}
            darkMode={darkMode}
            onOpen={openRecent}
            onViewAll={() => router.push("/food-scanner/scan-history")}
            onDelete={scanner.removeScan}
            style={fill}
          />
        </View>
      </View>

      {/* The day's targets, under what's been eaten against them */}
      <NutritionGoalsCard meals={meals} darkMode={darkMode} loading={first} style={styles.goalsCard} />

      {/* Then Scan Food | Detected Food */}
      <View style={[styles.row, styles.rowGap, narrow && styles.stackRow]}>
        {/* Scan Area */}
        <View style={[styles.card, styles.scanCard, card, styles.flex1, narrow && styles.stackItem]}>
          <Text style={[styles.heading, textColor]}>Scan Food</Text>
          <Text style={[styles.subheading, mutedText]}>Use your camera or upload an image of your food.</Text>

          {first ? (
            // Scan area and its two buttons, at their real sizes
            <>
              <Skeleton width="100%" height={285} style={styles.cameraWrap} />
              <View style={styles.actions}>
                <Skeleton width="100%" height={44} style={styles.flex1} />
                <Skeleton width="100%" height={44} style={styles.flex1} />
              </View>
            </>
          ) : (
          <>
          {cameraOpen ? (
            <View style={styles.cameraWrap}>
              <FoodCamera onCapture={takePhoto} onCancel={() => setCameraOpen(false)} darkMode={darkMode} height={320} />
            </View>
          ) : (
            <View style={[styles.scanArea, { backgroundColor: darkMode ? "#253522" : "#f0ffe9" }]}>
              {imageUri ? (
                <View style={styles.previewWrap}>
                  <ScanImage uri={imageUri} style={styles.previewImage} contentFit="contain" />

                  {scanning && (
                    <View style={styles.scanningOverlay}>
                      <ActivityIndicator color={colors.white} size="large" />
                      <Text style={styles.scanningText}>Analyzing your food...</Text>
                    </View>
                  )}

                  {!!scanner.staged?.name && <Text style={[styles.fileName, mutedText]}>{scanner.staged.name}</Text>}
                </View>
              ) : (
                <>
                  <View style={styles.scanIconCircle}>
                    <Ionicons name="camera" size={30} color={colors.white} />
                  </View>

                  <Text style={styles.scanTitle}>Scan or Upload Food</Text>

                  <Text style={[styles.scanDesc, mutedText]}>
                    Take a photo with your camera or webcam, or upload one.
                  </Text>
                </>
              )}
            </View>
          )}

          <ScreenError message={scanner.scan ? "" : scanner.error} onDismiss={scanner.clearError} />

          {/* Staged: nothing has been sent yet, so the photo can still be swapped */}
          {!cameraOpen && scanner.staged && (
            <>
              <Pressable onPress={scanner.analyze} style={[styles.cameraBtn, styles.analyzeBtn, scanning && styles.disabled]}>
                <Ionicons name="sparkles-outline" size={17} color={colors.white} />
                <Text style={styles.cameraBtnText}>{scanning ? "Analyzing..." : "Analyze & Save"}</Text>
              </Pressable>
              <View style={styles.actions}>
                <SecondaryButton icon="camera-outline" label="Retake" onPress={() => setCameraOpen(true)} disabled={scanning} card={card} darkMode={darkMode} />
                <SecondaryButton icon="images-outline" label="Reupload" onPress={pickImage} disabled={scanning} card={card} darkMode={darkMode} />
              </View>
            </>
          )}

          {/* Saved scan on screen: start over */}
          {!cameraOpen && !scanner.staged && scanner.scan && (
            <View style={styles.actions}>
              <SecondaryButton icon="add-circle-outline" label="New Scan" onPress={newScan} card={card} darkMode={darkMode} />
            </View>
          )}

          {/* Nothing yet: choose a source */}
          {!cameraOpen && !imageUri && (
            <View style={styles.actions}>
              <Pressable onPress={() => setCameraOpen(true)} style={[styles.cameraBtn, styles.flex1]}>
                <Ionicons name="camera-outline" size={17} color={colors.white} />
                <Text style={styles.cameraBtnText}>Use Camera</Text>
              </Pressable>
              <SecondaryButton icon="cloud-upload-outline" label="Upload Image" onPress={pickImage} card={card} darkMode={darkMode} />
            </View>
          )}
          </>
          )}
        </View>

        {/* Always on the page, filled in once a scan is analyzed. "Ask AI
            Coach" there opens the coach about this scan or the logged meal */}
        <View style={[styles.flex1, narrow && styles.stackItem]}>
          <ScanResultCard scanner={scanner} darkMode={darkMode} onScanAnother={newScan} style={fill} loading={first} />
        </View>
      </View>
    </DashboardLayout>
  );
}

function SecondaryButton({ icon, label, onPress, disabled, card, darkMode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.uploadBtn,
        styles.flex1,
        styles.actionUpload,
        { borderColor: card.borderColor, backgroundColor: darkMode ? "#252525" : colors.white },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={17} color={shellColors.primary} />
      <Text style={styles.uploadBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 13 },
  ...foodScannerStyles,

  row: { flexDirection: "row", gap: 16 },
  fill: { flex: 1 },
  // Same floor as the Detected Food card next to it
  scanCard: { minHeight: RESULT_CARD_MIN_HEIGHT },
  rowGap: { marginTop: 16 },
  goalsCard: { marginTop: 16 },
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 },
  disabled: { opacity: 0.5 },

  subheading: { fontSize: 12, marginTop: 4 },

  // Scan area
  scanArea: {
    marginTop: 20,
    minHeight: 285,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: shellColors.primary,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraWrap: { marginTop: 20 },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: shellColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  previewWrap: { width: "100%", position: "relative" },
  previewImage: { width: "100%", height: 230, borderRadius: radii.sm },
  scanningOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 230,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanningText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  fileName: { marginTop: 12, textAlign: "center", fontSize: 12 },
  alert: { marginTop: 12 },

  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  // uploadBtn carries its own marginTop for when it stands alone
  actionUpload: { marginTop: 0 },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.sm,
    backgroundColor: shellColors.primary,
    paddingVertical: 12,
  },
  analyzeBtn: { marginTop: 16 },
  cameraBtnText: { fontSize: 14, fontWeight: "700", color: colors.white },

  // Stacked (narrow) children size to their content. With flex: n they get a
  // zero basis in a column, collapse, and the next card draws over them
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
});