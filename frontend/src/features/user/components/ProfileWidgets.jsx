import Skeleton from "@/shared/components/Skeleton";
import { colors, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

// Shared by the web and phone Profile screens

// "September 2026", from the account's creation date
export function joinedLabel(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Age, height, weight and BMI at a glance. `large` is the web card,
// `compact` wraps them two per row on narrow phones
export function OverviewBoxes({ form, bmi, bmiLabel, card, textColor, loading, large = false, compact = false }) {
  const s = large ? largeStyles : styles;
  const boxes = [
    { icon: "calendar-outline", label: "Age", value: form.age, unit: "yrs" },
    { icon: "resize-outline", label: "Height", value: form.height, unit: "cm" },
    { icon: "barbell-outline", label: "Weight", value: form.weight, unit: "kg" },
    { icon: "body-outline", label: "BMI", value: bmi, note: bmiLabel },
  ];

  return (
    <View style={[s.row, compact && s.rowCompact]}>
      {boxes.map((b) => (
        <View key={b.label} style={[s.box, compact && s.boxCompact, { borderColor: card.borderColor }]}>
          <View style={s.labelRow}>
            <Ionicons name={b.icon} size={large ? 15 : 13} color={shellColors.primary} />
            <Text style={[s.label, textColor]}>{b.label}</Text>
          </View>
          {loading ? (
            <Skeleton width="55%" height={large ? 18 : 16} style={s.skeleton} />
          ) : (
            <>
              <Text style={[s.value, textColor]} numberOfLines={1}>
                {b.value || "—"}
                {b.value && b.unit ? <Text style={s.unit}> {b.unit}</Text> : null}
              </Text>
              {!!b.note && <Text style={s.note}>{b.note}</Text>}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  rowCompact: { flexWrap: "wrap" },
  box: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 8 },
  boxCompact: { flexBasis: "47%" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  label: { fontSize: 10, fontWeight: "600" },
  value: { fontSize: 15, fontWeight: "800", marginTop: 8 },
  unit: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
  note: { fontSize: 10, fontWeight: "700", color: shellColors.primary, marginTop: 2 },
  skeleton: { marginTop: 10 },
});

const largeStyles = StyleSheet.create({
  ...styles,
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  box: { flexGrow: 1, flexBasis: 180, minWidth: 0, borderRadius: radii.sm, borderWidth: 1, padding: 14 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 12, fontWeight: "600" },
  value: { marginTop: 10, fontSize: 22, fontWeight: "800" },
  unit: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  note: { marginTop: 2, fontSize: 11, fontWeight: "700", color: shellColors.primary },
  skeleton: { marginTop: 12 },
});