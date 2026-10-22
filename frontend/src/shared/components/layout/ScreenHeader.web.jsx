import { useTheme } from "@/shared/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Web page title. Sidebar pages get the title alone (the sidebar entry
// supplies the description); sub-pages pass `fallback`, their parent page,
// and get a back arrow. `subtitle` is mobile-only; `description` is the web
// line under the title, as on the other sidebar screens
export default function ScreenHeader({ title, description = null, fallback = null }) {
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
      <View>
        <Text style={[styles.pageTitle, { color: c.sidebarText }]}>{title}</Text>
        {!!description && <Text style={[styles.pageSubtitle, { color: c.headerDescText }]}>{description}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  pageSubtitle: { marginTop: 4, fontSize: 14 },
});