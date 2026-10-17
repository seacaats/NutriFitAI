import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors, useTheme } from "@/shared/context/ThemeContext";
import { spacing, radii as staticRadii, typography } from "@/shared/theme/nutrifitai";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function OtpInputRow({ otp, variant = "green500" }) {
  const { tokens } = useTheme();
  const { radii } = tokens;
  const colors = useAuthColors(tokens.colors);
  const styles = useMemo(() => createStyles(colors, radii), [colors, radii]);

  const [focusedIndex, setFocusedIndex] = useState(null);
  const ringColor = variant === "primaryBorder" ? colors.primary : colors.focusRing;

  return (
    <View style={styles.row}>
      {otp.code.map((digit, index) => {
        const isFocused = focusedIndex === index;
        return (
          <TextInput
            key={index}
            ref={otp.setInputRef(index)}
            style={[
              styles.box,
              isFocused && getFocusStyle(ringColor, variant === "primaryBorder"),
            ]}
            value={digit}
            onChangeText={(val) => otp.handleChange(val, index)}
            onKeyPress={(e) => otp.handleKeyPress(e, index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((cur) => (cur === index ? null : cur))}
            keyboardType="number-pad"
            maxLength={1}
          />
        );
      })}
    </View>
  );
}

/**
 * Second sign-in step, after the password was right. Regular users enter the
 * code emailed to them; admins the code from their authenticator app, or one
 * of their recovery codes. `form` is useLoginForm's return, `styles` the
 * login screen's own (link, alert and spacing)
 */
export function MfaChallenge({ form, styles }) {
  const mfaStyles = useMfaStyles();
  if (form.recoveryCodes) return <RecoveryCodesStep form={form} />;
  if (form.mfa.setupRequired) return <AuthenticatorSetupStep form={form} styles={styles} />;

  const email = form.mfa.method === "email";
  return (
    <View>
      {/* Darker and bolder, like the setup step, so the instructions are easy to read */}
      <Text style={[mfaStyles.lead, mfaStyles.leadStrong]}>
        {email
          ? "Enter the code we sent to your email to finish signing in."
          : "Enter the 6-digit code from your authenticator app. Lost your phone? Use a recovery code instead."}
      </Text>

      {email ? (
        // The same code boxes as verifying an email or resetting a password
        <View style={mfaStyles.otp}>
          <OtpInputRow otp={form.otp} variant="primaryBorder" />
        </View>
      ) : (
        // Authenticator and recovery codes are letters and digits, so a text field
        <FormInput
          label="Authenticator or recovery code"
          icon="shield-checkmark-outline"
          placeholder="123456 or xxxxx-xxxxx"
          value={form.mfaCode}
          onChangeText={form.setMfaCode}
          autoCapitalize="none"
          maxLength={24}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
          onSubmitEditing={form.handleMfaSubmit}
          style={styles.fieldSpacing}
        />
      )}

      {/* Space below too, so they don't sit on the Verify button */}
      <FormAlert message={form.mfaNotice} tone="success" onDismiss={form.dismissMfaNotice} style={[styles.alert, mfaStyles.alertAbove]} />
      <FormAlert message={form.error} onDismiss={form.dismissError} style={[styles.alert, mfaStyles.alertAbove]} />

      <PrimaryButton title="Verify" onPress={form.handleMfaSubmit} loading={form.loading} />

      {/* Same help line as the register and reset screens, with the countdown */}
      {email && (
        <OtpHelpLine onResend={form.handleMfaResend} resending={form.resending} cooldown={form.cooldown} style={mfaStyles.leadStrong} />
      )}

      <View style={mfaStyles.links}>
        <Pressable onPress={form.cancelMfa} hitSlop={6}>
          <Text style={styles.link}>Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * First sign-in of an admin or superadmin: 2FA is already on, so the
 * authenticator app is scanned in here, on the login screen, before any session
 * exists. The first code from the app finishes the setup and the sign-in
 */
function AuthenticatorSetupStep({ form, styles }) {
  const mfaStyles = useMfaStyles();
  const setup = form.mfaSetup;
  return (
    <View>
      <Text style={[mfaStyles.lead, mfaStyles.leadStrong]}>
        Two-factor authentication (2FA) is required for admin accounts. Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password...), then enter the 6-digit code it shows.
      </Text>

      {setup ? (
        <>
          <View style={mfaStyles.qrBox}>
            <Image source={{ uri: setup.qrDataUrl }} style={mfaStyles.qr} contentFit="contain" accessibilityLabel="QR code for your authenticator app" />
          </View>
          <Text style={[mfaStyles.keyHint, mfaStyles.leadStrong]}>Can't scan? Type this key into your app:</Text>
          <Text selectable style={mfaStyles.key}>{setup.secret}</Text>

          <FormInput
            label="6-digit code"
            icon="shield-checkmark-outline"
            placeholder="123456"
            value={form.mfaCode}
            onChangeText={form.setMfaCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            onSubmitEditing={form.handleMfaSubmit}
            style={styles.fieldSpacing}
          />
        </>
      ) : null}

      <FormAlert message={form.error} onDismiss={form.dismissError} style={[styles.alert, mfaStyles.alertAbove]} />

      {setup ? <PrimaryButton title="Turn on and sign in" onPress={form.handleMfaSubmit} loading={form.loading} /> : null}

      <View style={mfaStyles.links}>
        <Pressable onPress={form.cancelMfa} hitSlop={6}>
          <Text style={styles.link}>Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Shown once, right after the setup, before the session is opened */
function RecoveryCodesStep({ form }) {
  const mfaStyles = useMfaStyles();
  return (
    <View>
      <Text style={[mfaStyles.lead, mfaStyles.leadStrong]}>
        Save these recovery codes somewhere safe. Each works once if you lose your phone, and they won't be shown again.
      </Text>
      <View style={mfaStyles.codes}>
        {form.recoveryCodes.map((code) => (
          <Text key={code} selectable style={mfaStyles.code}>{code}</Text>
        ))}
      </View>
      <PrimaryButton title="I've saved them" onPress={form.finishMfaSetup} loading={form.loading} />
    </View>
  );
}

const createMfaStyles = (colors) => StyleSheet.create({
  lead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" },
  // The setup and recovery steps carry instructions people must not miss, so darker and bolder than the muted caption
  leadStrong: { color: colors.textPrimary, fontWeight: "600" },
  alertAbove: { marginBottom: spacing.md },
  otp: { marginBottom: spacing.md },
  links: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  qrBox: { alignSelf: "center", backgroundColor: "#ffffff", padding: 8, borderRadius: staticRadii.sm, marginBottom: spacing.md },
  qr: { width: 200, height: 200 },
  keyHint: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm },
  key: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    // The light gray border disappeared on the green card, so a darker, thicker one
    borderWidth: 2,
    borderColor: colors.green700,
    borderRadius: staticRadii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, borderWidth: 2, borderColor: colors.green700, borderRadius: staticRadii.sm, padding: spacing.md, marginBottom: spacing.md },
  code: {
    ...typography.caption,
    width: "47%",
    color: colors.textPrimary,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
});

// Auth palette, so the sign-in steps follow the light/dark theme
const useMfaStyles = () => {
  const colors = useAuthColors();
  return useMemo(() => createMfaStyles(colors), [colors]);
};

function getFocusStyle(ringColor, alsoChangeBorder) {
  if (Platform.OS === "web") {
    return {
      boxShadow: `0 0 0 2px ${ringColor}`,
      // The gray 1px border would otherwise show as a dark line inside the ring
      borderColor: alsoChangeBorder ? ringColor : "transparent",
    };
  }
  return { borderColor: ringColor, borderWidth: 2 };
}

function createStyles(colors, radii) {
  return StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "center", gap: 12 },
    box: {
      width: 56,
      height: 56,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      // The browser's own focus outline drew a black ring inside the green
      // one; the ring from getFocusStyle is the only focus mark
      ...(Platform.OS === "web" ? { outlineStyle: "none" } : null),
    },
  });
}

/**
 * "Didn't get the code? Resend it or update your email address."
 * Both actions are inline links. Shared by the registration, password-reset
 * and sign-in OTP screens (web + native)
 */
export function OtpHelpLine({ onResend, onUpdateEmail, resending = false, cooldown = 0, style }) {
  const helpLineStyles = useHelpLineStyles();
  const resendDisabled = resending || cooldown > 0;
  const resendLabel = resending ? "Sending..." : cooldown > 0 ? `Resend it (${cooldown}s)` : "Resend it";

  return (
    <Text style={[helpLineStyles.line, style]}>
      Didn't get the code?{" "}
      <Text
        onPress={resendDisabled ? undefined : onResend}
        style={[helpLineStyles.link, resendDisabled && helpLineStyles.linkDisabled]}
        accessibilityRole="link"
      >
        {resendLabel}
      </Text>
      {/* No email to change on the sign-in screen, so that part is optional */}
      {onUpdateEmail ? (
        <>
          {" "}or{" "}
          <Text onPress={onUpdateEmail} style={helpLineStyles.link} accessibilityRole="link">
            update your email address
          </Text>
        </>
      ) : null}
      .
    </Text>
  );
}

const createHelpLineStyles = (colors) => StyleSheet.create({
  line: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", textDecorationLine: "underline" },
  linkDisabled: { color: colors.textMuted, textDecorationLine: "none" },
});

const useHelpLineStyles = () => {
  const colors = useAuthColors();
  return useMemo(() => createHelpLineStyles(colors), [colors]);
};