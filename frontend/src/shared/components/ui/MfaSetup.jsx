import { apiClient } from "@/shared/api/apiClient";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PlanButton from "@/shared/components/ui/PlanButton";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Two-factor authentication (2FA), from Settings and the onboarding.
// method "email": regular users get a code by email at sign-in, and turn it on and
// off here.
// method "totp": admins and superadmins always have it on. Scanning the
// authenticator app in happens at their first sign-in (the login screen), so here
// there's only the status and new recovery codes. Every change re-asks the
// password, and the server checks it again, so nothing here is trusted on its own
//
// step: idle | password | code | recovery | regen

export default function MfaSetup({ method, enabled, recoveryCodesLeft = 0, onChange, darkMode }) {
  const tone = getScreenTones(darkMode);
  const email = method === "email";
  // Phone-width: the buttons go below the text instead of squeezing beside it
  const narrow = useWindowDimensions().width < 600;
  const [step, setStep] = useState("idle");
  const [intent, setIntent] = useState("enable"); // enable | disable, for the email flow
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reset = () => {
    setStep("idle");
    setPassword("");
    setShowPassword(false);
    setCode("");
    setError("");
  };

  // Runs one request with the busy flag and inline error handling
  async function run(task) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Starting a change ------------------------------------------------------
  const begin = (nextStep, nextIntent = "enable") => {
    setNotice("");
    setIntent(nextIntent);
    setStep(nextStep);
  };

  // Email users: the password first, then it sends the code
  const submitPassword = () => run(async () => {
    if (!password) throw new Error("Please enter your password.");
    await apiClient.post("/auth/mfa/email/request", { password }, { auth: true });
    setPassword("");
    setStep("code");
  });

  const confirmEmail = () => run(async () => {
    if (!code.trim()) throw new Error("Please enter the code we emailed you.");
    const enable = intent === "enable";
    await apiClient.post("/auth/mfa/email/confirm", { code: code.trim(), enable }, { auth: true });
    reset();
    setNotice(enable ? "Two-factor authentication is on." : "Two-factor authentication is off.");
    onChange?.(enable);
  });

  // App users: new recovery codes take the password and a code
  const submitRecoveryCodes = () => run(async () => {
    if (!password) throw new Error("Please enter your password.");
    if (!code.trim()) throw new Error("Please enter a code from your app, or a recovery code.");
    const data = await apiClient.post("/auth/mfa/recovery-codes", { password, code: code.trim() }, { auth: true });
    setRecovery(data.recoveryCodes || []);
    reset();
    setStep("recovery");
    onChange?.(true);
  });

  const status = (
    <View style={styles.statusRow}>
      <Ionicons
        name={enabled ? "shield-checkmark" : "shield-outline"}
        size={18}
        color={enabled ? shellColors.primary : tone.muted}
      />
      <Text style={[styles.status, { color: tone.text }]}>
        {enabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}
      </Text>
    </View>
  );

  const passwordInput = (
    <FormInput
      icon="lock-closed-outline"
      placeholder="Your password"
      value={password}
      onChangeText={setPassword}
      secureTextEntry
      showToggle
      visible={showPassword}
      onToggleVisible={() => setShowPassword((v) => !v)}
      autoCapitalize="none"
    />
  );

  const codeInput = (placeholder, numeric = true) => (
    <FormInput
      icon="shield-checkmark-outline"
      placeholder={placeholder}
      value={code}
      onChangeText={setCode}
      keyboardType={numeric ? "number-pad" : "default"}
      autoCapitalize="none"
      maxLength={24}
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
    />
  );

  const actions = (primary, secondary) => (
    <View style={styles.actions}>
      <PlanButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
      {primary && <PlanButton compact label={primary.label} onPress={primary.onPress} loading={busy} darkMode={darkMode} />}
      {secondary}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {/* The status and its button share a row, like Change password. On a phone the buttons drop below */}
      <View style={styles.inline}>
        <View style={[styles.info, narrow && styles.infoFull]}>
          {status}
          <Text style={[styles.hint, { color: tone.muted }]}>
            {email
              ? "When on, we email you a code each time you sign in with your password."
              : "Required for admin accounts: signing in with your password also needs a code from your authenticator app."}
            {!email && !enabled ? " You'll scan the QR code the next time you sign in." : ""}
            {enabled && !email ? ` ${recoveryCodesLeft} recovery code${recoveryCodesLeft === 1 ? "" : "s"} left.` : ""}
          </Text>
        </View>

        {step === "idle" && (email || enabled) && (
          <View style={[styles.actions, narrow && styles.actionsStart]}>
            {email && (enabled
              ? <PlanButton compact variant="secondary" label="Turn off" onPress={() => begin("password", "disable")} darkMode={darkMode} />
              : <PlanButton compact label="Turn on" onPress={() => begin("password")} darkMode={darkMode} />)}
            {!email && <PlanButton compact variant="secondary" label="New recovery codes" onPress={() => begin("regen")} darkMode={darkMode} />}
          </View>
        )}
      </View>

      <FormAlert message={notice} tone="success" onDismiss={() => setNotice("")} />

      {step === "password" && (
        <View style={styles.form}>
          <Text style={[styles.hint, { color: tone.muted }]}>
            {intent === "disable" ? "Enter your password to turn it off." : "Enter your password to continue."}
          </Text>
          {passwordInput}
          <FormAlert message={error} onDismiss={() => setError("")} />
          {actions({ label: "Continue", onPress: submitPassword })}
        </View>
      )}

      {step === "code" && (
        <View style={styles.form}>
          <Text style={[styles.hint, { color: tone.muted }]}>Enter the code we just emailed you.</Text>
          {codeInput("Code")}
          <FormAlert message={error} onDismiss={() => setError("")} />
          {actions({ label: intent === "enable" ? "Turn on" : "Turn off", onPress: confirmEmail })}
        </View>
      )}

      {step === "recovery" && (
        <View style={styles.form}>
          <Text style={[styles.hint, { color: tone.text }]}>
            Save these recovery codes somewhere safe. Each works once if you lose your phone, and they won&apos;t be shown again.
          </Text>
          <View style={[styles.codes, { borderColor: tone.border }]}>
            {recovery.map((c) => (
              <Text key={c} selectable style={[styles.code, { color: tone.text }]}>{c}</Text>
            ))}
          </View>
          <View style={styles.actions}>
            <PlanButton compact label="I've saved them" onPress={() => { setRecovery([]); setStep("idle"); }} darkMode={darkMode} />
          </View>
        </View>
      )}

      {step === "regen" && (
        <View style={styles.form}>
          <Text style={[styles.hint, { color: tone.muted }]}>
            To get new recovery codes (the old ones stop working), enter your password and a code from your app, or a recovery code.
          </Text>
          {passwordInput}
          {codeInput("Code or recovery code", false)}
          <FormAlert message={error} onDismiss={() => setError("")} />
          {actions({ label: "Generate", onPress: submitRecoveryCodes })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  info: { flex: 1, minWidth: 180, gap: 6 },
  infoFull: { flexBasis: "100%" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 17 },
  form: { gap: 10, maxWidth: 420 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  actionsStart: { justifyContent: "flex-start" },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderWidth: 1, borderRadius: radii.sm, padding: 10 },
  code: { width: "47%", fontSize: 14, fontWeight: "700", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
});