import { FoodCamera, NutritionGoalsCard, RecentMealsCard, RecentScansCard, ScanResultCard } from "@/features/food/components/FoodScanCards";
import { useFoodScanner } from "@/features/food/hooks/useFoodScanner";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { MenuButton } from "@/shared/components/layout/ScreenHeader";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { colors, radii, shellColors } from "@/shared/theme/nutrifitai";
import { foodScannerStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Image as RNImage, StyleSheet, Text, View } from "react-native";

// Saved scans come back as /uploads/... paths, staged photos as file:// uris
const previewSource = (uri) => (uri.startsWith("/uploads/") ? resolveMediaUrl(uri) : uri);

export default function FoodScannerScreen() {
  const { darkMode, shell: c } = useTheme();
  const { meals, scanner, cameraOpen, setCameraOpen, takePhoto, pickImage, newScan, openRecent, first, scanning, imageUri } = useFoodScanner();
  // Measured width of the photo box. The photo gets it as a plain number,
  // since Android's image view drew nothing with stretch or % widths here
  const [imageWidth, setImageWidth] = useState(0);

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const mutedText = { color: colors.textMuted };

  return (
    <DashboardLayout hideTabBar>
      {/* Top Bar*/}
      <View style={styles.topBar}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={c.sidebarText} />
        </Pressable>

        <View style={styles.headingWrap}>
          <Text style={[styles.heading, textColor]}>Scan Food</Text>
          <Text style={styles.headingSub}>Snap a meal for its nutrition</Text>
        </View>

        <View style={styles.topBarSpacer}><MenuButton /></View>
      </View>

      {/* Recent first, so what's already logged is the first thing seen */}
      <RecentMealsCard meals={meals} darkMode={darkMode} onViewAll={() => router.push("/food-scanner/meal-history")} loading={first} />
      {/* Recent scans next to recent meals, so both histories sit together */}
      <View style={styles.section}>
        <RecentScansCard
          scans={scanner.recent}
          loading={first}
          darkMode={darkMode}
          onOpen={openRecent}
          onViewAll={() => router.push("/food-scanner/scan-history")}
          onDelete={scanner.removeScan}
        />
      </View>
      {/* The day's targets, after what's been eaten against them */}
      <View style={styles.section}>
        <NutritionGoalsCard meals={meals} darkMode={darkMode} loading={first} />
      </View>

      {/* Scan Area */}
      <Text style={[styles.sectionTitle, textColor]}>Scan Food</Text>
      {first ? (
        // Scan zone and its two buttons, at their real sizes
        <>
          <Skeleton width="100%" height={260} />
          <Skeleton width="100%" height={44} style={styles.buttonSkeleton} />
          <Skeleton width="100%" height={44} style={styles.buttonSkeleton} />
        </>
      ) : (
      <>
      {cameraOpen ? (
        <FoodCamera onCapture={takePhoto} onCancel={() => setCameraOpen(false)} darkMode={darkMode} height={420} />
      ) : imageUri ? (
        <View style={styles.imageWrap} onLayout={(e) => setImageWidth(Math.round(e.nativeEvent.layout.width))}>
          {/* React Native's own Image here, not expo-image. Keyed by the
              uri so a new photo or an opened scan always mounts a fresh view */}
          {imageWidth > 0 && (
            <RNImage
              key={imageUri}
              source={{ uri: previewSource(imageUri), headers: { "ngrok-skip-browser-warning": "true" } }}
              style={{ width: imageWidth, height: 260, borderRadius: radii.sm }}
              resizeMode="cover"
            />
          )}
          {scanning && (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator color={colors.white} size="large" />
              <Text style={styles.scanningText}>Analyzing your food...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.scanZone, { backgroundColor: c.activeNavBg }]}>
          <View style={styles.scanIconCircle}>
            <Ionicons name="camera" size={30} color={colors.white} />
          </View>

          <Text style={styles.scanTitle}>Scan or Upload Food</Text>
          <Text style={[styles.scanDesc, mutedText]}>Take a photo of your food or upload from your gallery.</Text>
        </View>
      )}

      {/* Staged: nothing has been sent yet, so the photo can still be swapped */}
      {!cameraOpen && scanner.staged && (
        <>
          <ScreenError message={scanner.error} onDismiss={scanner.clearError} />
          <Pressable onPress={scanner.analyze} disabled={scanning} style={[styles.cameraBtn, scanning && styles.disabled]}>
            <Ionicons name="sparkles-outline" size={17} color={colors.white} />
            <Text style={styles.cameraBtnText}>{scanning ? "Analyzing..." : "Analyze & Save"}</Text>
          </Pressable>
          <View style={styles.btnRow}>
            <Pressable onPress={() => setCameraOpen(true)} disabled={scanning} style={[styles.uploadBtn, styles.flex1, card]}>
              <Ionicons name="camera-outline" size={17} color={shellColors.primary} />
              <Text style={styles.uploadBtnText}>Retake</Text>
            </Pressable>
            <Pressable onPress={pickImage} disabled={scanning} style={[styles.uploadBtn, styles.flex1, card]}>
              <Ionicons name="images-outline" size={17} color={shellColors.primary} />
              <Text style={styles.uploadBtnText}>Reupload</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Saved scan on screen: start over */}
      {!cameraOpen && !scanner.staged && scanner.scan && (
        <Pressable onPress={newScan} style={[styles.uploadBtn, card]}>
          <Ionicons name="add-circle-outline" size={17} color={shellColors.primary} />
          <Text style={styles.uploadBtnText}>New Scan</Text>
        </Pressable>
      )}

      {/* Nothing yet: choose a source */}
      {!cameraOpen && !imageUri && (
        <>
          <ScreenError message={scanner.error} onDismiss={scanner.clearError} />
          <Pressable onPress={() => setCameraOpen(true)} style={styles.cameraBtn}>
            <Ionicons name="camera-outline" size={17} color={colors.white} />
            <Text style={styles.cameraBtnText}>Take Photo</Text>
          </Pressable>

          <Pressable onPress={pickImage} style={[styles.uploadBtn, card]}>
            <Ionicons name="cloud-upload-outline" size={17} color={shellColors.primary} />
            <Text style={styles.uploadBtnText}>Upload Image</Text>
          </Pressable>
        </>
      )}
      </>
      )}

      {/* Always on the page, filled in once a scan is analyzed. "Ask AI
          Coach" there opens the coach about this scan or the logged meal */}
      <View style={styles.lastSection}>
        <ScanResultCard scanner={scanner} darkMode={darkMode} onScanAnother={newScan} loading={first} />
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headingWrap: { alignItems: "center" },
  headingSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ...foodScannerStyles,

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  topBarSpacer: { width: 24, alignItems: "flex-end" },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  disabled: { opacity: 0.5 },

  // Empty state
  scanZone: {
    minHeight: 260,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: shellColors.primary,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: shellColors.primary, alignItems: "center", justifyContent: "center" },
  cameraBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.sm,
    backgroundColor: shellColors.primary,
    paddingVertical: 12,
  },
  cameraBtnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  btnRow: { flexDirection: "row", gap: 8 },

  // Photo
  // Holds the 260 height itself, the photo inside is sized from onLayout
  // No overflow:hidden + borderRadius here. On Android that clip left the
  // photo undrawn until something remounted it (same for the camera box),
  // so the image and the overlay round their own corners instead
  imageWrap: { alignSelf: "stretch", minHeight: 260 },
  scanningOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, height: 260,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanningText: { color: colors.white, fontSize: 13, fontWeight: "600" },

  section: { marginTop: 16 },
  buttonSkeleton: { marginTop: 16 },
  lastSection: { marginTop: 16, marginBottom: 16 },
});