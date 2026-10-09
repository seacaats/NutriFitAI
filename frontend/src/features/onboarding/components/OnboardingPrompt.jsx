import { useAuth } from "@/shared/context/AuthContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Who the wizard was already opened for this session. Module-level so it
// outlives the dashboard remounting: going Back from /onboarding lands here again,
// and opening it a second time would bounce them straight back
let openedFor = null;

// Top of both dashboards. Opens the onboarding once per session for a user
// who hasn't finished or skipped it, on top of the dashboard so Back returns
// here. Otherwise a small dismissible banner while it's unfinished or every
// answer is still empty. Dismissing hides it until the dashboard opens again
export default function OnboardingPrompt({ darkMode }) {
  const { role, user, onboarded, setupPending } = useAuth();
  const router = useRouter();
  const tone = getScreenTones(darkMode);
  const [dismissed, setDismissed] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (role !== "user" || onboarded || !userId || openedFor === userId) return;
    openedFor = userId;
    router.push("/onboarding");
  }, [role, onboarded, userId, router]);

  if (role !== "user" || dismissed || (onboarded && !setupPending)) return null;

  return (
    <View style={[styles.banner, { backgroundColor: tone.soft, borderColor: tone.border }]}>
      <Ionicons name="sparkles-outline" size={18} color={shellColors.primary} />
      <Pressable onPress={() => router.push("/onboarding")} style={styles.flex1} accessibilityRole="button">
        <Text style={[styles.title, { color: tone.text }]}>Finish setting up your plan</Text>
        <Text style={[styles.body, { color: tone.muted }]}>Goals, workouts you like and your coach&apos;s tone. About a minute.</Text>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={tone.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.md, padding: 12, marginBottom: 12 },
  flex1: { flex: 1 },
  title: { fontSize: 13, fontWeight: "800" },
  body: { fontSize: 12, marginTop: 2, lineHeight: 17 },
});
