import { useTheme } from "@/shared/context/ThemeContext";
import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function NutriFitLogo({ light = false, small = false, source = require("@/assets/images/nutrifit-logo.png") }) {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Image source={source} style={small ? styles.imageSmall : styles.image} contentFit="contain" />
      <Text style={[styles.text, small ? styles.textSmall : styles.textLarge, light ? styles.textLight : styles.textDefault]}>
        NutriFitAI
      </Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    image: { width: 40, height: 40 },
    imageSmall: { width: 32, height: 32 },
    text: { fontWeight: "800" },
    textLarge: { fontSize: 20 },
    textSmall: { fontSize: 14 },
    textDefault: { color: colors.green500 },
    textLight: { color: colors.brandDark },
  });
}