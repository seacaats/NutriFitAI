import { RingField } from "@/shared/components/ui/FormInput";
import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { StyleSheet, Text, TextInput } from "react-native";

// A number box with its unit inside on the right, like the Food screen's
// Daily Goals card. Used by the onboarding and the target weight dialog.
// `decimal` allows one decimal point ("72.5"); otherwise digits only
export default function NumberBox({ value, onChangeText, unit, label, onSubmit, decimal = false, placeholder = "Not set", maxLength = 5, darkMode, style }) {
  const tone = getScreenTones(darkMode);
  const clean = (t) => (decimal ? t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") : t.replace(/[^0-9]/g, ""));
  return (
    <RingField style={[styles.box, { borderColor: tone.border, backgroundColor: tone.card }, style]}>
      {(ring) => (
        <>
          <TextInput
            {...ring.handlers}
            value={value}
            onChangeText={(t) => onChangeText(clean(t))}
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={tone.muted}
            keyboardType={decimal ? "decimal-pad" : "number-pad"}
            returnKeyType="next"
            maxLength={maxLength}
            style={[styles.input, ring.input, { color: tone.text }]}
            accessibilityLabel={label}
          />
          {!!unit && <Text style={[styles.unit, { color: tone.muted }]}>{unit}</Text>}
        </>
      )}
    </RingField>
  );
}

const styles = StyleSheet.create({
  // minWidth 0 on the box and the input lets them shrink with the card, so
  // the unit never pushes out past its edge
  box: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, minHeight: 44 },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600", paddingVertical: 10 },
  unit: { flexShrink: 0, fontSize: 12, fontWeight: "700" },
});
