import { getSavedSince, hasNoConnection, onConnectionChange } from "@/shared/api/connection";
import { colors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// Shown while screens are running on saved data: says whether the phone has
// no connection or the server is the one that can't be reached
export default function OfflineBanner({ style }) {
  const [since, setSince] = useState(getSavedSince);
  const [noConnection, setNoConnection] = useState(hasNoConnection);
  useEffect(
    () =>
      onConnectionChange(() => {
        setSince(getSavedSince());
        setNoConnection(hasNoConnection());
      }),
    [],
  );
  if (!since) return null;

  const time = new Date(since).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <View style={[styles.bar, style]} accessibilityRole="alert">
      <Ionicons name={noConnection ? "wifi-outline" : "cloud-offline-outline"} size={15} color={colors.white} />
      <Text style={styles.text} numberOfLines={1}>
        {noConnection ? "No internet connection" : "We're having trouble connecting"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#475569" },
  text: { color: colors.white, fontSize: 12, fontWeight: "700" },
});