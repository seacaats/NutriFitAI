import { OptionField } from "@/features/auth/components/OptionSelect";
import WorkoutPrefsPicker, { describeWorkoutPrefs } from "@/features/workouts/components/WorkoutPrefsPicker";
import Skeleton from "@/shared/components/Skeleton";
import { RingInput } from "@/shared/components/ui/FormInput";
import { colors, radii } from "@/shared/theme/nutrifitai";
import { profileStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// The Profile form's fields, shared by the web and phone screens. Web lays
// them out as a two-column grid and wraps the chips; the phone stacks them
// and scrolls the chips sideways
const isWeb = Platform.OS === "web";

// A field without onChangeText (e.g. email) stays read-only while editing
export function ProfileInput({ label, required, value, onChangeText, editing, card, textColor, inputBg, disabledBg, keyboardType = "default", placeholder, multiline = false, loading }) {
  const editable = editing && !!onChangeText;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, textColor]}>{label}{editable && required && <RequiredMark />}</Text>
      {loading ? <FieldSkeleton card={card} disabledBg={disabledBg} /> : (
      <RingInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { borderColor: card.borderColor },
          editable ? inputBg : disabledBg,
          textColor,
        ]}
      />
      )}
    </View>
  );
}

// Red asterisk after a required field's label, shown only while editing
function RequiredMark() {
  return <Text style={styles.required}> *</Text>;
}

// A quiet one-line hint under a field (Health Conditions' allergies note)
function FieldNote({ note }) {
  if (!note) return null;
  return (
    <View style={styles.noteRow}>
      <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
      <Text style={styles.noteText}>{note}</Text>
    </View>
  );
}

export function ProfileSelect({ label, value, options, onSelect, editing, card, textColor, disabledBg, loading, note, style }) {
  const chips = options.map((opt) => {
    const active = opt === value;
    return (
      <Pressable
        key={opt}
        onPress={() => onSelect(opt)}
        style={[styles.chip, { borderColor: card.borderColor }, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active ? styles.chipTextActive : textColor]}>{opt}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      {loading ? (
        <FieldSkeleton card={card} disabledBg={disabledBg} />
      ) : editing ? (
        isWeb ? (
          <View style={styles.chips}>{chips}</View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips}
          </ScrollView>
        )
      ) : (
        <View style={[styles.input, { borderColor: card.borderColor }, disabledBg, styles.selectDisplay]}>
          <Text style={[styles.selectDisplayText, textColor]}>{value || "Not set"}</Text>
        </View>
      )}
      <FieldNote note={note} />
    </View>
  );
}

// Read-only shows the stored text; editing swaps in the registration dropdown
export function ProfilePlanField({ label, required, value, options, multiple = false, exclusive, onChange, editing, card, textColor, disabledBg, palette, icon, placeholder, otherPlaceholder, loading, note }) {
  if (!editing || loading) {
    return <ProfileSelect label={label} value={value} options={[]} editing={false} card={card} textColor={textColor} disabledBg={disabledBg} loading={loading} note={note} />;
  }
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, textColor]}>{label}{required && <RequiredMark />}</Text>
      <OptionField
        value={value}
        onChange={onChange}
        options={options}
        multiple={multiple}
        exclusive={exclusive}
        icon={icon}
        placeholder={placeholder}
        otherPlaceholder={otherPlaceholder}
        palette={palette}
      />
      <FieldNote note={note} />
    </View>
  );
}

// Workout preferences: a summary line, or the onboarding's picker while
// editing. Full width, the chips need the room
export function ProfileWorkoutPrefs({ label, value, onChange, options, editing, card, textColor, disabledBg, loading, darkMode }) {
  if (!editing || loading || options.loading) {
    // Styled directly rather than wrapped: inside a plain View the grid
    // field's flexBasis applied to its height and left a tall empty gap
    return (
      <ProfileSelect
        label={label}
        value={describeWorkoutPrefs(value, options) || "No preference"}
        options={[]}
        editing={false}
        card={card}
        textColor={textColor}
        disabledBg={disabledBg}
        loading={loading || options.loading}
        style={styles.wideField}
      />
    );
  }
  return (
    <View style={[styles.field, styles.wideField]}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>
      <View style={styles.pickerWrap}>
        <WorkoutPrefsPicker value={value} onChange={onChange} options={options} darkMode={darkMode} />
      </View>
    </View>
  );
}

// Loading stand-in for a field's box: the same bordered box at the same
// height (an invisible line of text holds it), with a bar where the value goes
function FieldSkeleton({ card, disabledBg }) {
  return (
    <View style={[styles.input, { borderColor: card.borderColor }, disabledBg, styles.selectDisplay]}>
      <Text style={[styles.selectDisplayText, styles.invisible]}> </Text>
      {/* Border color for the bar, the box's own fill is the skeleton tone */}
      <View style={styles.fieldSkeletonBar}>
        <Skeleton width="45%" height={12} style={{ backgroundColor: card.borderColor }} />
      </View>
    </View>
  );
}

const shared = {
  ...profileStyles,
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10 },
  invisible: { opacity: 0 },
  required: { color: colors.danger },
  // Spans the box's height and centers the bar in it. A percentage `top`
  // resolved against the wrong height on Android and left it at the top
  fieldSkeletonBar: { position: "absolute", left: 12, right: 12, top: 0, bottom: 0, justifyContent: "center" },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 6 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  pickerWrap: { marginTop: 8 },
};

const phone = {
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { ...shared.input, fontSize: 14 },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: "600" },
  selectDisplayText: { fontSize: 14 },
  wideField: {},
};

const web = {
  field: { flexGrow: 1, flexBasis: 260, minWidth: 0 }, // responsive two-column grid
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  input: { ...shared.input, marginTop: 8, fontSize: 13 },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontSize: 11, fontWeight: "600" },
  selectDisplayText: { fontSize: 13 },
  // Takes a whole row of the grid
  wideField: { flexBasis: "100%" },
};

const styles = StyleSheet.create({ ...shared, ...(isWeb ? web : phone) });