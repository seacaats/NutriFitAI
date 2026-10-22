import Skeleton from "@/shared/components/Skeleton";
import { radii } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text, View } from "react-native";

// `loading` is the first load only: placeholders where the numbers go. Without
// it, a missing value counts as loading
export default function StatCard({ label, value, hint, tone, loading = value == null }) {
  return (
    <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
      <Text style={[styles.label, { color: tone.muted }]}>{label}</Text>
      {loading ? <Skeleton width={70} height={26} /> : <Text style={[styles.value, { color: tone.text }]}>{value}</Text>}
      {loading ? <Skeleton width={90} height={11} /> : !!hint && <Text style={[styles.hint, { color: tone.muted }]}>{hint}</Text>}
    </View>
  );
}

// Roomier padding and gaps so label, value and hint read as separate lines
const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 150, borderWidth: 1, borderRadius: radii.md, padding: 18, gap: 6 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  value: { fontSize: 26, fontWeight: "800" },
  hint: { fontSize: 12, fontWeight: "600" },
});