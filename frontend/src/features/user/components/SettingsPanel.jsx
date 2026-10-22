import { useLogout } from "@/features/auth/hooks/useLogout";
import { disableDevice, getPushState, registerDevice } from "@/features/notifications/push";
import { useSettings } from "@/features/user/hooks/useSettings";
import Skeleton from "@/shared/components/Skeleton";
import ActionButton from "@/shared/components/ui/ActionButton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import MfaSetup from "@/shared/components/ui/MfaSetup";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import TimeStepper, { formatTime, QUIET_END, QUIET_START } from "@/shared/components/ui/TimeStepper";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { isValidEmail, validatePassword } from "@/shared/utils/formValidators";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// Settings body, shared by the web and mobile pages:
// Appearance, Notifications, Region, Account & security

// Device zone, the same one the app sends as X-Timezone
function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function Section({ icon, title, children, darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={[styles.section, { backgroundColor: tone.card, borderColor: tone.border }]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={18} color={shellColors.primary} />
        <Text style={[styles.sectionTitle, { color: tone.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// One label/description row with a control on the right
function Row({ label, hint, children, darkMode, last = false }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={[styles.row, !last && { borderBottomColor: tone.border, borderBottomWidth: 1 }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tone.text }]}>{label}</Text>
        {!!hint && <Text style={[styles.rowHint, { color: tone.muted }]}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

// Light | Dark
function ThemeSwitch({ darkMode, onChange }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={[styles.segment, { borderColor: tone.border }]}>
      {[
        { key: false, label: "Light", icon: "sunny-outline" },
        { key: true, label: "Dark", icon: "moon-outline" },
      ].map((o) => {
        const active = darkMode === o.key;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segBtn, active && { backgroundColor: shellColors.primary }]}
          >
            <Ionicons name={o.icon} size={14} color={active ? "#ffffff" : tone.text} />
            <Text style={[styles.segText, { color: active ? "#ffffff" : tone.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Change password ------------------------------------------------------------
//
// 1. current password, checked on its own before anything else shows
// 2. new password + confirmation
// 3. "are you sure?" before it's saved
// The current password is sent again on save, the server re-checks it

function ChangePassword({ settings, darkMode }) {
  const tone = getScreenTones(darkMode);
  const [step, setStep] = useState("idle"); // idle | verify | form
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setStep("idle");
    setCurrent("");
    setNext("");
    setConfirm("");
    setShow(false);
    setError("");
    setConfirming(false);
  };

  async function verify() {
    if (!current) {
      setError("Please enter your current password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await settings.verifyPassword(current);
      setStep("form");
    } catch (err) {
      setError(err?.message || "Couldn't check your password.");
    } finally {
      setBusy(false);
    }
  }

  // Local checks first, then the confirmation dialog
  function review() {
    const problem = validatePassword(next);
    if (problem) return setError(problem);
    if (next !== confirm) return setError("Passwords don't match.");
    if (next === current) return setError("Your new password must be different from your current password.");
    setError("");
    return setConfirming(true);
  }

  async function save() {
    setBusy(true);
    try {
      await settings.changePassword(current, next);
      reset();
      setDone("Your password was changed.");
    } catch (err) {
      setConfirming(false);
      setError(err?.message || "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.row, styles.column, { borderBottomColor: tone.border, borderBottomWidth: 1 }]}>
      <View style={styles.inline}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: tone.text }]}>Password</Text>
          <Text style={[styles.rowHint, { color: tone.muted }]}>
            {step === "idle" ? "Change the password you sign in with." : step === "verify"
              ? "First, enter your current password."
              : "Now choose a new password."}
          </Text>
        </View>
        {step === "idle" && (
          <ActionButton
            compact
            variant="secondary"
            label="Change password"
            onPress={() => { setDone(""); setStep("verify"); }}
            darkMode={darkMode}
          />
        )}
      </View>

      <FormAlert message={done} tone="success" onDismiss={() => setDone("")} />

      {step === "verify" && (
        <View style={styles.form}>
          <FormInput
            icon="lock-closed-outline"
            placeholder="Current password"
            value={current}
            maxLength={200}
            onChangeText={setCurrent}
            secureTextEntry
            showToggle
            visible={show}
            onToggleVisible={() => setShow((v) => !v)}
            autoCapitalize="none"
          />
          <ScreenError message={error} onDismiss={() => setError("")} />
          <View style={styles.formActions}>
            <ActionButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
            <ActionButton compact label="Continue" onPress={verify} loading={busy} darkMode={darkMode} />
          </View>
        </View>
      )}

      {step === "form" && (
        <View style={styles.form}>
          <FormInput
            icon="lock-closed-outline"
            placeholder="New password"
            value={next}
            maxLength={64}
            onChangeText={setNext}
            secureTextEntry
            showToggle
            visible={show}
            onToggleVisible={() => setShow((v) => !v)}
            autoCapitalize="none"
          />
          <FormInput
            icon="lock-closed-outline"
            placeholder="Confirm new password"
            value={confirm}
            maxLength={64}
            onChangeText={setConfirm}
            secureTextEntry
            visible={show}
            autoCapitalize="none"
          />
          <ScreenError message={error} onDismiss={() => setError("")} />
          <View style={styles.formActions}>
            <ActionButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
            <ActionButton compact label="Save password" onPress={review} darkMode={darkMode} />
          </View>
        </View>
      )}

      <ConfirmModal
        visible={confirming}
        tone="confirm"
        title="Change your password?"
        message="You'll use the new password the next time you sign in. Other devices stay signed in until their session ends."
        confirmLabel="Update"
        loading={busy}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

// ---- Change email (regular users) -------------------------------------------------
//
// 1. the new address and the current password
// 2. the code sent to the new address
// Other devices are signed out once it's done (server side)

function ChangeEmail({ settings, email, darkMode }) {
  const tone = getScreenTones(darkMode);
  const { refresh } = useAuth();
  const [step, setStep] = useState("idle"); // idle | form | code
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const reset = () => {
    setStep("idle");
    setNewEmail("");
    setPassword("");
    setCode("");
    setShow(false);
    setError("");
  };

  async function sendCode() {
    if (!isValidEmail(newEmail)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    setError("");
    try {
      await settings.requestEmailChange(newEmail.trim().toLowerCase(), password);
      setStep("code");
    } catch (err) {
      setError(err?.message || "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
    return null;
  }

  async function confirm() {
    if (!/^\d{4,8}$/.test(code.trim())) return setError("Enter the code from your email.");
    setBusy(true);
    setError("");
    try {
      await settings.confirmEmailChange(code.trim());
      reset();
      setDone("Your email was changed. Your other devices were signed out.");
      settings.reload();
      refresh();
    } catch (err) {
      setError(err?.message || "Couldn't change your email.");
    } finally {
      setBusy(false);
    }
    return null;
  }

  return (
    <View style={[styles.row, styles.column, { borderBottomColor: tone.border, borderBottomWidth: 1 }]}>
      <View style={styles.inline}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: tone.text }]}>Email</Text>
          <Text numberOfLines={1} style={[styles.value, { color: tone.text }]}>{email}</Text>
          {step === "code" && <Text style={[styles.rowHint, { color: tone.muted }]}>Enter the code we sent to {newEmail.trim().toLowerCase()}.</Text>}
        </View>
        {step === "idle" && (
          <ActionButton compact variant="secondary" label="Change email" onPress={() => { setDone(""); setStep("form"); }} darkMode={darkMode} />
        )}
      </View>

      <FormAlert message={done} tone="success" onDismiss={() => setDone("")} />

      {step === "form" && (
        <View style={styles.form}>
          <FormInput
            icon="mail-outline"
            placeholder="New email"
            value={newEmail}
            maxLength={254}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            icon="lock-closed-outline"
            placeholder="Current password"
            value={password}
            maxLength={200}
            onChangeText={setPassword}
            secureTextEntry
            showToggle
            visible={show}
            onToggleVisible={() => setShow((v) => !v)}
            autoCapitalize="none"
          />
          <ScreenError message={error} onDismiss={() => setError("")} />
          <View style={styles.formActions}>
            <ActionButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
            <ActionButton compact label="Send code" onPress={sendCode} loading={busy} darkMode={darkMode} />
          </View>
        </View>
      )}

      {step === "code" && (
        <View style={styles.form}>
          <FormInput
            icon="keypad-outline"
            placeholder="Code"
            value={code}
            maxLength={8}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoCapitalize="none"
          />
          <ScreenError message={error} onDismiss={() => setError("")} />
          <View style={styles.formActions}>
            <ActionButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
            <ActionButton compact label="Confirm" onPress={confirm} loading={busy} darkMode={darkMode} />
          </View>
        </View>
      )}
    </View>
  );
}

// ---- Notifications ---------------------------------------------------------------
//
// The master switch, then per-category switches under it, quiet hours, and
// push for this phone. Account notices ignore all of these (server side).
// Admins only get account notices, so they see just that row

const PUSH_STATUS_TEXT = {
  granted: "Push is on for this device.",
  off: "Push is off for this device.",
  denied: "Push is blocked. Turn it on for NutriFitAI in your phone's settings.",
  unavailable: "Push isn't available on this device.",
};

function NotificationSettings({ settings, loading, darkMode }) {
  const tone = getScreenTones(darkMode);
  const { role } = useAuth();
  const profile = settings.profile || {};
  const prefs = profile.notificationPrefs || {};
  const enabled = profile.notificationsEnabled ?? true;
  const [pushStatus, setPushStatus] = useState(null);

  // Whether this device is already on, so the button reads Turn off
  useEffect(() => {
    getPushState().then((state) => state && setPushStatus(state));
  }, []);

  const toggle = (value, onChange, disabled = false) => (loading ? (
    <Skeleton width={46} height={26} borderRadius={13} />
  ) : (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: shellColors.primary, false: tone.border }}
      thumbColor="#ffffff"
    />
  ));

  if (role !== "user") {
    return (
      <Row label="Account notices" hint="Password, sign-in and account changes always reach you, by email and here." darkMode={darkMode} last />
    );
  }

  return (
    <>
      <Row label="Allow notifications" hint="Turns off reminders, achievements and coach replies together." darkMode={darkMode}>
        {toggle(enabled, settings.setNotifications)}
      </Row>
      <Row label="Reminders" hint="Workouts coming up, water, meals and steps." darkMode={darkMode}>
        {toggle(enabled && (prefs.reminders ?? true), (v) => settings.setNotificationPrefs({ reminders: v }), !enabled)}
      </Row>
      <Row label="Achievements" hint="Daily goals reached and logging streaks." darkMode={darkMode}>
        {toggle(enabled && (prefs.achievements ?? true), (v) => settings.setNotificationPrefs({ achievements: v }), !enabled)}
      </Row>
      <Row
        label="Quiet hours"
        hint={prefs.quietStart
          ? `Nothing but account notices from ${formatTime(prefs.quietStart)} to ${formatTime(prefs.quietEnd)}.`
          : "Pause notifications overnight. Account notices still arrive."}
        darkMode={darkMode}
      >
        {toggle(
          Boolean(prefs.quietStart),
          (v) => settings.setNotificationPrefs(v ? { quietStart: QUIET_START, quietEnd: QUIET_END } : { quietStart: null, quietEnd: null }),
          !enabled,
        )}
      </Row>
      {!loading && Boolean(prefs.quietStart) && (
        <>
          <Row label="From" darkMode={darkMode}>
            <TimeStepper value={prefs.quietStart} onChange={(t) => settings.setNotificationPrefs({ quietStart: t })} disabled={!enabled} darkMode={darkMode} />
          </Row>
          <Row label="To" darkMode={darkMode}>
            <TimeStepper value={prefs.quietEnd} onChange={(t) => settings.setNotificationPrefs({ quietEnd: t })} disabled={!enabled} darkMode={darkMode} />
          </Row>
        </>
      )}
      {/* Web has no push; the inbox and email still work there */}
      {Platform.OS !== "web" && (
        <Row
          label="Push on this device"
          hint={pushStatus ? PUSH_STATUS_TEXT[pushStatus] : "Get notifications on this phone even when the app is closed."}
          darkMode={darkMode}
        >
          <ActionButton
            compact
            variant="secondary"
            label={pushStatus === "granted" ? "Turn off" : "Turn on"}
            onPress={async () => setPushStatus(pushStatus === "granted" ? await disableDevice() : await registerDevice({ prompt: true }))}
            darkMode={darkMode}
          />
        </Row>
      )}
      <Row label="Account notices" hint="Password, sign-in and account changes always reach you, by email and here." darkMode={darkMode} last />
    </>
  );
}

// ---- Delete account ------------------------------------------------------------
//
// Typed DELETE, plus the current password, then a final
// "are you sure?". Signs out once the server confirms

function DeleteAccount({ settings, onDeleted, isAdmin, darkMode }) {
  const tone = getScreenTones(darkMode);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  // Admins also enter an authenticator or recovery code
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setOpen(false);
    setTyped("");
    setPassword("");
    setCode("");
    setError("");
    setConfirming(false);
  };

  function review() {
    if (typed !== "DELETE") return setError('Type DELETE to confirm.');
    if (!password) return setError("Please enter your current password.");
    if (isAdmin && !code.trim()) return setError("Enter your authenticator code or a recovery code.");
    setError("");
    return setConfirming(true);
  }

  async function remove() {
    setBusy(true);
    try {
      await settings.deleteAccount(password, isAdmin ? code.trim() : undefined);
      await onDeleted();
    } catch (err) {
      setConfirming(false);
      setError(err?.message || "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <View style={[styles.row, styles.column]}>
      <View style={styles.inline}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: tone.text }]}>Delete account</Text>
          <Text style={[styles.rowHint, { color: tone.muted }]}>
            Permanently removes your account and all of your data. This can&apos;t be undone.
          </Text>
        </View>
        {/* Right-aligned, even when the long hint pushes it onto its own line */}
        {!open && (
          <View style={styles.endAction}>
            <ActionButton compact variant="danger" label="Delete account" onPress={() => setOpen(true)} darkMode={darkMode} />
          </View>
        )}
      </View>

      {open && (
        <View style={styles.form}>
          <FormInput
            icon="alert-circle-outline"
            placeholder="Type DELETE"
            value={typed}
            maxLength={6}
            onChangeText={setTyped}
            autoCapitalize="characters"
          />
          <FormInput
            icon="lock-closed-outline"
            placeholder="Current password"
            value={password}
            maxLength={200}
            onChangeText={setPassword}
            secureTextEntry
            showToggle
            visible={show}
            onToggleVisible={() => setShow((v) => !v)}
            autoCapitalize="none"
          />
          {isAdmin && (
            <FormInput
              icon="shield-checkmark-outline"
              placeholder="Authenticator or recovery code"
              value={code}
              maxLength={24}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <ScreenError message={error} onDismiss={() => setError("")} />
          <View style={styles.formActions}>
            <ActionButton compact variant="secondary" label="Cancel" onPress={reset} darkMode={darkMode} />
            <ActionButton compact variant="danger" label="Delete my account" onPress={review} darkMode={darkMode} />
          </View>
        </View>
      )}

      <ConfirmModal
        visible={confirming}
        tone="danger"
        title="Delete your account?"
        message={isAdmin
          ? "Your account is deleted. Your admin activity (audit notes, holds, suspensions and logged actions) stays on record under your name."
          : "Your meals, scans, workouts, steps, water and coach chats are deleted with it."}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

// ---- Page body -----------------------------------------------------------------

export default function SettingsPanel() {
  const { darkMode, setDarkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const settings = useSettings();
  const logout = useLogout();
  const { role } = useAuth();

  // The page renders in full right away. Only the values that come from the
  // account are placeholders while it loads, each the size of what replaces it
  const loading = settings.loading;

  const profile = settings.profile || {};
  const timeZone = profile.timezone || deviceTimeZone();
  const googleLinked = (profile.linkedProviders || []).includes("google");

  return (
    <View style={styles.page}>
      <ScreenError message={settings.error} onDismiss={settings.clearError} />

      <Section icon="color-palette-outline" title="Appearance" darkMode={darkMode}>
        <Row label="Theme" hint="How NutriFitAI looks on this device." darkMode={darkMode} last>
          <ThemeSwitch darkMode={darkMode} onChange={setDarkMode} />
        </Row>
      </Section>

      <Section icon="notifications-outline" title="Notifications" darkMode={darkMode}>
        <NotificationSettings settings={settings} loading={loading} darkMode={darkMode} />
      </Section>

      <Section icon="globe-outline" title="Region" darkMode={darkMode}>
        <Row
          label="Time zone"
          hint="Picked up from your device automatically. Days, goals and reminders follow it."
          darkMode={darkMode}
          last
        >
          {loading
            ? <Skeleton width={120} height={16} />
            : <Text style={[styles.value, { color: tone.text }]}>{timeZone || "Unknown"}</Text>}
        </Row>
      </Section>

      <Section icon="shield-checkmark-outline" title="Account & security" darkMode={darkMode}>
        {/* Regular users can change it; an admin's address stays as set */}
        {!loading && role === "user" ? (
          <ChangeEmail settings={settings} email={profile.email} darkMode={darkMode} />
        ) : (
          <Row label="Email" darkMode={darkMode}>
            {loading
              ? <Skeleton width={170} height={16} />
              : <Text numberOfLines={1} style={[styles.value, { color: tone.text }]}>{profile.email}</Text>}
          </Row>
        )}

        {loading ? (
          <Row label="Password" hint="Change the password you sign in with." darkMode={darkMode}>
            <Skeleton width={160} height={32} borderRadius={radii.pill} />
          </Row>
        ) : (
          <ChangePassword settings={settings} darkMode={darkMode} />
        )}

        {/* Regular users: a code by email. Admins: an authenticator app */}
        <View style={[styles.row, styles.column, { borderBottomColor: tone.border, borderBottomWidth: 1 }]}>
          <Text style={[styles.rowLabel, { color: tone.text }]}>Two-Factor Authentication</Text>
          {loading ? (
            // Same shape as MfaSetup: its status line, then the button
            <View style={styles.inline}>
              <Skeleton width={220} height={14} />
              <View style={styles.endAction}>
                <Skeleton width={150} height={32} borderRadius={radii.pill} />
              </View>
            </View>
          ) : (
            <MfaSetup
              method={role === "user" ? "email" : "totp"}
              enabled={Boolean(profile.mfaEnabled)}
              recoveryCodesLeft={profile.recoveryCodesLeft}
              onChange={settings.reload}
              darkMode={darkMode}
            />
          )}
        </View>

        <Row label="Google account" hint="Linked accounts can't be changed here." darkMode={darkMode}>
          {loading ? <Skeleton width={90} height={26} borderRadius={radii.pill} /> : (
          <View style={[styles.badge, { backgroundColor: googleLinked ? tone.soft : tone.surfaceMuted }]}>
            <Ionicons
              name={googleLinked ? "checkmark-circle" : "remove-circle-outline"}
              size={14}
              color={googleLinked ? shellColors.primary : tone.muted}
            />
            <Text style={[styles.badgeText, { color: googleLinked ? shellColors.primary : tone.muted }]}>
              {googleLinked ? "Linked" : "Not linked"}
            </Text>
          </View>
          )}
        </Row>

        <Row label="Sign out" hint="Sign out of NutriFitAI on this device." darkMode={darkMode} last>
          <ActionButton compact variant="danger" label="Sign out" onPress={logout} darkMode={darkMode} />
        </Row>
      </Section>

      <Section icon="warning-outline" title="Danger zone" darkMode={darkMode}>
        {loading ? (
          // Same shape as Delete account: its label and hint, then the button
          <Row label="Delete account" hint="Permanently removes your account and all of your data. This can't be undone." darkMode={darkMode} last>
            <View style={styles.endAction}>
              <Skeleton width={140} height={32} borderRadius={radii.pill} />
            </View>
          </Row>
        ) : (
          <DeleteAccount settings={settings} onDeleted={logout} isAdmin={role !== "user"} darkMode={darkMode} />
        )}
      </Section>

    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, width: "100%", maxWidth: 960, alignSelf: "center" },
  section: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, paddingVertical: 14 },
  // nowrap: a wrapping column sizes its line to the widest child, so children
  // stopped stretching to full width (Delete account sat beside its text)
  column: { flexDirection: "column", alignItems: "stretch", flexWrap: "nowrap" },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  rowText: { flex: 1, minWidth: 180 },
  rowLabel: { fontSize: fs(15, 14), fontWeight: "700" },
  rowHint: { fontSize: fs(14, 12), marginTop: 2, lineHeight: 17 },
  value: { fontSize: fs(14, 13), fontWeight: "700", maxWidth: 260 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: radii.pill, overflow: "hidden" },
  segBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  segText: { fontSize: fs(14, 13), fontWeight: "700" },
  form: { gap: 10, maxWidth: 420 },
  endAction: { marginLeft: "auto" },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: fs(14, 12), fontWeight: "700" },
});