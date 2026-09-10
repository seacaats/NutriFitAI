import { Text, View } from "react-native";

// Expo Router requires a platform-neutral sibling for web-only routes.
export default function StepsFallbackScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Steps is currently available on the web dashboard.</Text>
    </View>
  );
}
