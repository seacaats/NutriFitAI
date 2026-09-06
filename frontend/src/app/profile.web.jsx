import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const GOAL_OPTIONS = ["Lose Weight", "Maintain Weight", "Gain Muscle", "Improve Fitness"];
const ACTIVITY_OPTIONS = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active"];

export default function ProfileScreen() {
  const { darkMode } = useTheme();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "John",
    lastName: "Lim",
    email: "john@example.com",
    age: "21",
    height: "170",
    weight: "70",
    goal: "Lose Weight",
    activity: "Moderately Active",
  });

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb", // border-gray-200 dark:border-gray-700
  };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };
  const inputBg = { backgroundColor: darkMode ? "#181818" : "#ffffff" };
  const disabledBg = { backgroundColor: darkMode ? "#333333" : "#f3f4f6" };

  // Input Handler
  const handleChange = (name, value) => {
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
    setSaved(false);
  };

  // Profile Save
  const handleSave = () => {
    setEditing(false);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, textColor]}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal information and fitness goals.</Text>
        </View>

        {!editing ? (
          <Pressable onPress={() => setEditing(true)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={15} color="#fff" />
            <Text style={styles.actionBtnText}>Edit Profile</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSave} style={styles.actionBtn}>
            <Ionicons name="save-outline" size={15} color="#fff" />
            <Text style={styles.actionBtnText}>Save Changes</Text>
          </Pressable>
        )}
      </View>

      {/* Save Message */}
      {saved && (
        <View style={[styles.savedBanner, { backgroundColor: darkMode ? "#263322" : "#f0faeb", borderColor: darkMode ? "#14532d" : "#bbf7d0" }]}>
          <Text style={styles.savedText}>Profile updated successfully! ✓</Text>
        </View>
      )}

      {/* Profile Content */}
      <View style={styles.contentRow}>
        <View style={[styles.card, card, styles.flex1]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarCircle, { backgroundColor: darkMode ? "#364153" : "#e5e7eb" }]}>
              <Ionicons name="person" size={45} color="#6a7282" />
            </View>

            <Text style={[styles.profileName, textColor]}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.profileTag}>NutriFit AI Member</Text>
          </View>

          <View style={styles.profileInfoList}>
            <ProfileInfo icon="mail" label="Email" value={profile.email} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="calendar" label="Age" value={`${profile.age} years old`} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="resize" label="Height" value={`${profile.height} cm`} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="barbell" label="Weight" value={`${profile.weight} kg`} darkMode={darkMode} textColor={textColor} />
          </View>
        </View>

        {/* Personal Information */}
        <View style={[styles.card, card, styles.flex2]}>
          <Text style={[styles.sectionTitle, textColor]}>Personal Information</Text>
          <Text style={styles.sectionSubtitle}>Your basic personal details</Text>

          <View style={styles.fieldsGrid}>
            <InputField label="First Name" value={profile.firstName} onChangeText={(v) => handleChange("firstName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
            <InputField label="Last Name" value={profile.lastName} onChangeText={(v) => handleChange("lastName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
            <InputField label="Email" value={profile.email} onChangeText={(v) => handleChange("email", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="email-address" />
            <InputField label="Age" value={profile.age} onChangeText={(v) => handleChange("age", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
            <InputField label="Height (cm)" value={profile.height} onChangeText={(v) => handleChange("height", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
            <InputField label="Weight (kg)" value={profile.weight} onChangeText={(v) => handleChange("weight", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
          </View>
        </View>
      </View>

      {/* Fitness Goals */}
      <View style={[styles.card, card, styles.sectionSpacing]}>
        <View style={styles.rowGap}>
          <Ionicons name="locate" size={21} color="#4CAF2F" />
          <View>
            <Text style={[styles.sectionTitle, textColor]}>Fitness Goals</Text>
            <Text style={styles.sectionSubtitle}>Customize your fitness preferences</Text>
          </View>
        </View>

        <View style={styles.fieldsGrid}>
          <SelectField
            label="Primary Goal"
            value={profile.goal}
            options={GOAL_OPTIONS}
            onSelect={(v) => handleChange("goal", v)}
            editing={editing}
            card={card}
            textColor={textColor}
            disabledBg={disabledBg}
          />

          <SelectField
            label="Activity Level"
            value={profile.activity}
            options={ACTIVITY_OPTIONS}
            onSelect={(v) => handleChange("activity", v)}
            editing={editing}
            card={card}
            textColor={textColor}
            disabledBg={disabledBg}
          />
        </View>
      </View>

      {/* Fitness Summary */}
      <View style={[styles.card, card, styles.sectionSpacing]}>
        <Text style={[styles.sectionTitle, textColor]}>Fitness Summary</Text>

        <View style={styles.summaryRow}>
          <SummaryCard icon="locate" title="Current Goal" value={profile.goal} card={card} textColor={textColor} />
          <SummaryCard icon="pulse" title="Activity Level" value={profile.activity} card={card} textColor={textColor} />
          <SummaryCard icon="barbell" title="Current Weight" value={`${profile.weight} kg`} card={card} textColor={textColor} />
        </View>
      </View>
    </DashboardLayout>
  );
}



function ProfileInfo({ icon, label, value, darkMode, textColor }) {
  return (
    <View style={[styles.infoRow, { borderColor: darkMode ? "#364153" : "#e5e7eb" }]}>
      <View style={[styles.infoIcon, { backgroundColor: darkMode ? "#2c3a28" : "#f0faeb" }]}>
        <Ionicons name={icon} size={15} color="#4CAF2F" />
      </View>

      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, textColor]}>{value}</Text>
      </View>
    </View>
  );
}

function InputField({ label, value, onChangeText, editing, card, textColor, inputBg, disabledBg, keyboardType = "default" }) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editing}
        keyboardType={keyboardType}
        style={[styles.input, { borderColor: card.borderColor }, editing ? inputBg : disabledBg, textColor]}
        placeholderTextColor="#6a7282"
      />
    </View>
  );
}

function SelectField({ label, value, options, onSelect, editing, card, textColor, disabledBg }) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      {editing ? (
        <View style={styles.chipsWrap}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <Pressable
                key={opt}
                onPress={() => onSelect(opt)}
                style={[
                  styles.chip,
                  { borderColor: card.borderColor },
                  active && styles.chipActive,
                ]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : textColor]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={[styles.input, { borderColor: card.borderColor }, disabledBg, styles.selectDisplay]}>
          <Text style={[styles.selectDisplayText, textColor]}>{value}</Text>
        </View>
      )}
    </View>
  );
}

function SummaryCard({ icon, title, value, card, textColor }) {
  return (
    <View style={[styles.summaryCard, { borderColor: card.borderColor }]}>
      <View style={styles.rowGap}>
        <Ionicons name={icon} size={18} color="#4CAF2F" />
        <Text style={[styles.summaryTitle, textColor]}>{title}</Text>
      </View>

      <Text style={[styles.summaryValue, textColor]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-5 approx
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Header
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, // mb-5
  pageTitle: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  pageSubtitle: { marginTop: 4, fontSize: 13, color: "#6a7282" }, // mt-1 text-sm

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.sm,
    backgroundColor: "#4CAF2F",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // Saved banner
  savedBanner: { marginBottom: 16, borderRadius: radii.sm, borderWidth: 1, padding: 12, alignItems: "center" },
  savedText: { fontSize: 12, fontWeight: "600", color: "#4CAF2F" },

  // Profile content
  contentRow: { flexDirection: "row", gap: 12 },

  avatarWrap: { alignItems: "center" },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  profileName: { marginTop: 16, fontSize: 18, fontWeight: "700" }, // mt-4 text-lg font-bold
  profileTag: { marginTop: 4, fontSize: 11, color: "#6a7282" },

  profileInfoList: { marginTop: 24, gap: 12 }, // mt-6 space-y-3

  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.sm, borderWidth: 1, padding: 12 },
  infoIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 9, color: "#6a7282" },
  infoValue: { marginTop: 2, fontSize: 12, fontWeight: "600" },

  // Sections
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 12, color: "#6a7282" },
  sectionSpacing: { marginTop: 12 }, // mt-3

  // Fields
  fieldsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }, // mt-5 gap-4
  fieldHalf: { width: "47%" }, // grid-cols-2
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  input: {
    marginTop: 8, // mt-2
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },

  // Select
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  chipActive: { backgroundColor: "#4CAF2F", borderColor: "#4CAF2F" },
  chipText: { fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  selectDisplay: { justifyContent: "center" },
  selectDisplayText: { fontSize: 13 },

  // Summary
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 16 }, // mt-4 gap-3
  summaryCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 16 },
  summaryTitle: { fontSize: 12, fontWeight: "600" },
  summaryValue: { marginTop: 12, fontSize: 13, fontWeight: "700" }, // mt-3
});