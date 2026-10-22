import OtpInputRow, { OtpHelpLine } from "@/features/auth/components/OtpInputRow";
import Skeleton from "@/shared/components/Skeleton";
import FormInput, { FormAlert } from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { spacing, radii as staticRadii, typography } from "@/shared/theme/nutrifitai";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Second sign-in step after password verification. Regular users enter an emailed
 * OTP code; admins enter an authenticator app code or a recovery code.
 */
export function MfaChallenge({ form, styles }) {
  const mfaStyles = useMfaStyles();
  if (form.recoveryCodes) return <RecoveryCodesStep form={form} />;
  if (form.mfa.setupRequired) return <AuthenticatorSetupStep form={form} styles={styles} />;

  const email = form.mfa.method === "email";
  return (
    <View>
      <Text style={[mfaStyles.lead, mfaStyles.leadStrong]}>
        {email
          ? "Enter the code we sent to your email to finish signing in."
          : "Enter the 6-digit code from your authenticator app. Lost your phone? Use a recovery code instead."}
      </Text>

      {email ? (
        <View style={mfaStyles.otp}>
          <OtpInputRow otp={form.otp} variant="primaryBorder" onSubmit={form.handleMfaSubmit} />
        </View>
      ) : (
        // Authenticator and recovery codes may contain alphanumeric characters and hyphens
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

      <FormAlert message={form.mfaNotice} tone="success" onDismiss={form.dismissMfaNotice} style={[styles.alert, mfaStyles.alertAbove]} />
      <FormAlert message={form.error} onDismiss={form.dismissError} style={[styles.alert, mfaStyles.alertAbove]} />

      <PrimaryButton title="Verify" onPress={form.handleMfaSubmit} loading={form.loading} />

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
 * First-time admin sign-in step: requires enrolling an authenticator app via QR code
 * or setup key and verifying the initial 6-digit code before opening a session.
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
      ) : (
        !form.error && <SetupSkeleton />
      )}

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

// Placeholder matching the authenticator setup layout using the auth border color for contrast
function SetupSkeleton() {
  const mfaStyles = useMfaStyles();
  const fill = { backgroundColor: useAuthColors().border };
  return (
    <View>
      <Skeleton width={216} height={216} style={[fill, mfaStyles.skelCenter, mfaStyles.skelGap]} />
      <Skeleton width="60%" height={14} style={[fill, mfaStyles.skelCenter, mfaStyles.skelGap]} />
      <Skeleton height={40} style={[fill, mfaStyles.skelGap]} />
      <Skeleton height={44} style={[fill, mfaStyles.skelGap]} />
      <Skeleton height={44} style={fill} />
    </View>
  );
}

/** Displays one-time recovery codes immediately after authenticator enrollment. */
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
  leadStrong: { color: colors.textPrimary, fontWeight: "600" },
  alertAbove: { marginBottom: spacing.md },
  otp: { marginBottom: spacing.md },
  links: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  qrBox: { alignSelf: "center", backgroundColor: "#ffffff", padding: 8, borderRadius: staticRadii.sm, marginBottom: spacing.md },
  qr: { width: 200, height: 200 },
  skelCenter: { alignSelf: "center" },
  skelGap: { marginBottom: spacing.md },
  keyHint: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm },
  key: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
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

const useMfaStyles = () => {
  const colors = useAuthColors();
  return useMemo(() => createMfaStyles(colors), [colors]);
};
