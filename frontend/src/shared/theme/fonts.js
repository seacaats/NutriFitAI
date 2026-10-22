// App typography configuration using Inter font family
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { StyleSheet, Text, TextInput } from "react-native";

export const appFonts = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

// Custom fonts map weights directly to font files
const FAMILY_BY_WEIGHT = {
  100: "Inter_400Regular",
  200: "Inter_400Regular",
  300: "Inter_400Regular",
  400: "Inter_400Regular",
  500: "Inter_500Medium",
  600: "Inter_600SemiBold",
  700: "Inter_700Bold",
  800: "Inter_800ExtraBold",
  900: "Inter_800ExtraBold",
};

const familyFor = (weight) => {
  if (weight === "bold") return FAMILY_BY_WEIGHT[700];
  return FAMILY_BY_WEIGHT[Number(weight) || 400] || FAMILY_BY_WEIGHT[400];
};

// Global Text and TextInput wrapper to apply Inter font family while preserving custom fonts
export function applyAppFont() {
  [Text, TextInput].forEach((Comp) => {
    if (!Comp?.render || Comp.__inter) return;
    const render = Comp.render;
    Comp.render = function (props, ref) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily) return render.call(this, props, ref);
      // Reset fontWeight to normal to avoid simulated bolding on Android
      const style = [props.style, { fontFamily: familyFor(flat.fontWeight), fontWeight: "normal" }];
      return render.call(this, { ...props, style }, ref);
    };
    Comp.__inter = true;
  });
}
