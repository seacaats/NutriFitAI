import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";


export default function DashboardScreen() {
  const { shell: c } = useTheme();
  const router = useRouter();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const trackBg = { backgroundColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, textColor]}>Good Morning,</Text>
          <Text style={[styles.greetingName, textColor]}>Jose!👋</Text>
        </View>
        <Ionicons name="notifications-outline" size={24} color={c.notifIcon} />
      </View>

      {/* Daily Calories */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Daily Calories</Text>

        <View style={styles.rowBetween}>
          <Text style={[styles.bigNum, textColor]}>
            1850<Text style={styles.kcalSuffix}> /2200 kcal</Text>
          </Text>
          <Text style={styles.pctGreen}>84%</Text>
        </View>

        <View style={[styles.progressTrack, trackBg]}>
          <View style={[styles.progressFill, { width: "84%", backgroundColor: "#69bd3e" }]} />
        </View>

        <View style={styles.macroRow}>
          <Macro name="Protein" value="79/120g" color="#00c2b8" pct={66} border={card.borderColor} text={textColor.color} />
          <Macro name="Carbs" value="165/250g" color="#ff9f43" pct={66} border={card.borderColor} text={textColor.color} />
          <Macro name="Fat" value="45/70g" color="#a45ee5" pct={64} border={card.borderColor} text={textColor.color} />
        </View>
      </View>

      {/*  */}
      <View style={styles.shortcutRow}>
        <Pressable onPress={() => router.push("/food-scanner")} style={[styles.shortcutCard, { backgroundColor: "#e7f9df" }]}>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>Scan Food</Text>
            <Text style={styles.shortcutSub}>Analyze your food</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: "#4CAF2F" }]}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/ai-coach")} style={[styles.shortcutCard, { backgroundColor: "#fbe7fb" }]}>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>AI Coach</Text>
            <Text style={styles.shortcutSub}>Chat with your coach</Text>
          </View>
          <View style={[styles.shortcutIconBox, { backgroundColor: "#c86ee0" }]}>
            <Ionicons name="hardware-chip" size={20} color="#fff" />
          </View>
        </Pressable>
      
      <Pressable onPress = {() => router.push("/workouts")} style={[styles.shortcutCard, { backgroundColor: "#e7f9df" }]}>
        <View style={styles.shortcutText}>
          <Text style={styles.shortcutTitle}>Workout Planner</Text>
          <Text style={styles.shortcutSub}>Plan your workouts</Text>
        </View>
        <View style={[styles.shortcutIconBox, { backgroundColor: "#4CAF2F" }]}>
          <Ionicons name="barbell" size={20} color="#fff" />
        </View>
      </Pressable>
      </View>

      {/* Today's Plan */}
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, textColor]}>Today's Plan</Text>
        <Pressable>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.planRow}>
        <View style={[styles.planCard, { backgroundColor: "#fbf6d9" }]}>
          <Ionicons name="restaurant" size={20} color="#c9a227" />
          <Text style={styles.planTitle}>Meal Plan</Text>
          <Text style={styles.planMeta}>2/4 Completed</Text>
        </View>

        <View style={[styles.planCard, card]}>
          <Ionicons name="barbell" size={20} color="#2b7fff" />
          <Text style={[styles.planTitle, textColor]}>Workout</Text>
          <Text style={styles.planMeta}>Upper Body</Text>
          <Text style={styles.planMeta}>35 mins</Text>
        </View>
      </View>
    </DashboardLayout>
  );
}

function Macro({ name, value, color, pct, border, text }) {
  return (
    <View style={[styles.macroBox, { borderColor: border }]}>
      <Text style={[styles.macroName, { color: text }]}>{name}</Text>
      <Text style={styles.macroValue}>{value}</Text>
      <View style={[styles.macroTrack, { backgroundColor: border }]}>
        <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "700" },
  greetingName: { fontSize: 26, fontWeight: "800", marginTop: 2 },

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bigNum: { fontSize: 26, fontWeight: "800" },
  kcalSuffix: { fontSize: 13, fontWeight: "500", color: "#6a7282" },
  pctGreen: { fontSize: 15, fontWeight: "700", color: "#4CAF2F" },

  progressTrack: { marginTop: 10, height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },

  macroRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  macroBox: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 8 },
  macroName: { fontSize: 12, fontWeight: "700" },
  macroValue: { fontSize: 11, color: "#6a7282", marginTop: 2 },
  macroTrack: { marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden" },
  macroFill: { height: 4, borderRadius: 2 },

  shortcutRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  shortcutCard: { flex: 1, borderRadius: radii.sm, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutText: { flexShrink: 1 },
  shortcutTitle: { fontSize: 12, fontWeight: "700", color: "#1a1a1a" },
  shortcutSub: { fontSize: 10, color: "#4b5563", marginTop: 2 },
  shortcutIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  sectionTitle: { fontSize: 18, fontWeight: "700" },
  viewAll: { fontSize: 12, fontWeight: "600", color: "#4CAF2F" },

  planRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  planCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, borderColor: "transparent", padding: 12 },
  planTitle: { fontSize: 13, fontWeight: "700", marginTop: 8, color: "#1a1a1a" },
  planMeta: { fontSize: 11, color: "#6a7282", marginTop: 2 },
});