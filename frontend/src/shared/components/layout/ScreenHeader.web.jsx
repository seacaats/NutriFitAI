import { useTheme } from "@/shared/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Web page title. Sidebar pages get the title alone (the sidebar entry
// supplies the description); sub-pages pass `fallback`, their parent page,
// and get a back arrow. `subtitle` is mobile-only
export default function ScreenHeader({ title, fallback = null }) {
  const router = useRouter();
  const { shell: c } = useTheme();

  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  return (
    <View style={styles.head}>
      {!!fallback && (
        <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={c.sidebarText} />
        </Pressable>
      )}
      <Text style={[styles.pageTitle, { color: c.sidebarText }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
});
