import FormInput from "@/shared/components/ui/FormInput";
import {
  CUSTOM_OPTION_MAX,
  joinChoice,
  joinMulti,
  OTHER_OPTION,
  splitChoice,
  splitMulti,
} from "@/shared/constants/profileOptions";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Dropdown used by the register screen for Diet Preference, Health
 * Conditions, Activity Level and Fitness Goal.
 *
 * - Single-select by default; `multiple` for health conditions and diet.
 * - Picking "Other" reveals a free-text field (the only place custom input
 *   is accepted). Open/close and selection state live in useRegisterForm
 */
export default function OptionSelect({
  icon,
  placeholder,
  options,
  value,
  multiple = false,
  open,
  onToggle,
  onSelect,
  otherValue,
  onOtherChange,
  otherPlaceholder,
  size,
  style,
  // Optional { surface, border, text } for dark surfaces (the profile page)
  palette,
}) {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selected = multiple ? value : value ? [value] : [];
  const display = selected.join(", ");
  const otherSelected = selected.includes(OTHER_OPTION);
  const box = palette ? { backgroundColor: palette.surface, borderColor: palette.border } : null;
  const ink = palette ? { color: palette.text } : null;

  return (
    <View style={style}>
      <Pressable style={[styles.select, box]} onPress={onToggle} accessibilityRole="button">
        <View style={styles.selectLeft}>
          <Ionicons name={icon} size={16} color={colors.green600} />
          <Text style={display ? [styles.valueText, ink] : styles.placeholder} numberOfLines={1}>
            {display || placeholder}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.green600} />
      </Pressable>

      {open && (
        <View style={[styles.options, box]}>
          {options.map((label) => {
            const isOn = selected.includes(label);
            return (
              <Pressable key={label} style={[styles.option, palette && { borderBottomColor: palette.border }]} onPress={() => onSelect(label)}>
                <Text style={[styles.optionText, ink]}>{label}</Text>
                {multiple ? (
                  <Ionicons name={isOn ? "checkbox" : "square-outline"} size={16} color={isOn ? colors.primary : colors.textMuted} />
                ) : (
                  isOn && <Ionicons name="checkmark" size={16} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
          {multiple && (
            <Pressable style={styles.doneRow} onPress={onToggle}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}

      {otherSelected && (
        <FormInput
          size={size}
          icon="create-outline"
          placeholder={otherPlaceholder}
          value={otherValue}
          onChangeText={onOtherChange}
          style={styles.otherInput}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.inputBg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  selectLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 },
  placeholder: { ...typography.caption, color: colors.textMuted, flex: 1 },
  valueText: { ...typography.caption, color: colors.textPrimary, fontWeight: "600", flex: 1 },
  options: {
    marginTop: 6,
    backgroundColor: colors.inputBg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { ...typography.caption, color: colors.textPrimary },
  doneRow: { paddingVertical: 10, alignItems: "center" },
  doneText: { ...typography.caption, color: colors.green700, fontWeight: "700" },
  otherInput: { marginTop: 6 },
});

// OptionSelect for a field stored as one plain string (the profile page).
// Splits the string into option + "Other" text, and joins it back on change

// `exclusive` is the multi-select option that clears the rest ("None" for
// health conditions, "No Preference" for diet)
export function OptionField({ value, onChange, options, multiple = false, exclusive = "None", ...selectProps }) {
  const split = () => (multiple ? splitMulti(value, options) : splitChoice(value, options));
  const [state, setState] = useState(split);
  const [open, setOpen] = useState(false);
  const lastEmitted = useRef(value);

  // Re-sync when the value changes from outside (e.g. Cancel restores it)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setState(split());
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(next) {
    setState(next);
    const joined = multiple ? joinMulti(next.choices, next.other) : joinChoice(next.choice, next.other);
    lastEmitted.current = joined;
    onChange(joined);
  }

  function select(label) {
    if (!multiple) {
      emit({ choice: label, other: state.other });
      setOpen(false);
      return;
    }
    const { choices } = state;
    const next = choices.includes(label) ? choices.filter((c) => c !== label) : [...choices, label];
    // The exclusive option stands alone, same as registration
    const cleaned = label === exclusive ? (next.includes(exclusive) ? [exclusive] : []) : next.filter((c) => c !== exclusive);
    emit({ choices: cleaned, other: state.other });
  }

  return (
    <OptionSelect
      {...selectProps}
      options={options}
      multiple={multiple}
      value={multiple ? state.choices : state.choice}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onSelect={select}
      otherValue={state.other}
      onOtherChange={(text) => emit({ ...state, other: text.slice(0, multiple ? 2000 : CUSTOM_OPTION_MAX) })}
    />
  );
}