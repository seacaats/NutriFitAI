import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getPublicTones } from "@/shared/theme/nutrifitai";
import { Stack } from "expo-router";


export default function PublicLayout() {
  const { status } = useAuth();
  const { darkMode } = useTheme();
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);

  if (gate.pending) return <LoadingScreen visible={gate.visible} />;

  return <Stack screenOptions={{ headerShown: false, animation: "ios_from_right", contentStyle: { backgroundColor: getPublicTones(darkMode).bg } }} />;
}