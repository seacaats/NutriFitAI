import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { colors } from "@/shared/theme/nutrifit";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";


export default function PublicLayout() {
  const { status } = useAuth();

  if (status === AUTH_STATUS.LOADING) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMint }}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}