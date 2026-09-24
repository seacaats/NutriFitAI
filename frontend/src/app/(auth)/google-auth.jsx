import { ApiClientError, useAuth } from "@/shared/context/AuthContext";
import {
  exchangeGoogleToken,
  GOOGLE_AUTH_ACK_TYPE,
  GOOGLE_AUTH_CHANNEL,
  GOOGLE_AUTH_MESSAGE_TYPE,
  googleErrorMessage,
} from "@/shared/services/googleAuth";
import { colors, spacing, typography } from "@/shared/theme/nutrifit";
import { setAccessToken } from "@/shared/utils/authStorage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * How long to wait for the opener to acknowledge the result before giving up
 * on the handshake. Delivery is normally sub-millisecond; this only covers a
 * busy or unresponsive opener tab
 */
const ACK_TIMEOUT_MS = 2000;

function isPopup(params) {
  if (typeof window === "undefined") return false;

  const popupParam = Array.isArray(params?.popup) ? params.popup[0] : params?.popup;

  if (popupParam === "1") return true;
  if (popupParam === "0") return false;

  return !!window.opener && window.opener !== window;
}

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Publishes the sign-in result to the opener and resolves once the opener has
 * acknowledged it or the wait times out
 *
 * The channel is deliberately NOT closed on the same tick as postMessage:
 * BroadcastChannel dispatch is asynchronous, so closing the channel and the
 * window immediately afterwards destroys the popup before the message is
 * flushed, and the opener never receives anything
 */
function publishResult(result) {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") {
      resolve(false);
      return;
    }

    let channel;
    try {
      channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    let timer = null;

    function settle(delivered) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        channel.close();
      } catch {
        // already closed — nothing to do
      }
      resolve(delivered);
    }

    channel.onmessage = (event) => {
      if (event?.data?.type === GOOGLE_AUTH_ACK_TYPE) settle(true);
    };

    timer = setTimeout(() => settle(false), ACK_TIMEOUT_MS);

    channel.postMessage({ type: GOOGLE_AUTH_MESSAGE_TYPE, ...result });
  });
}

export default function GoogleAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refresh } = useAuth();
  const ranOnce = useRef(false);

  // Set only when the popup could not hand the result back to the opener, so
  // the window explains itself instead of closing silently
  const [stranded, setStranded] = useState(null);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    async function finishSignIn() {
      const popup = isPopup(params);

      async function finish(result) {
        if (!popup) {
          if (result.success) {
            router.replace("/dashboard");
          } else {
            router.replace({
              pathname: "/login",
              params: {
                googleError: result.error || "exchange_failed",
                googleMessage: result.message || "",
                // Carried so the login screen can prefill the OTP screen for
                // an unverified account (error=email_not_verified). Empty for
                // every other failure, which the login screen ignores
                googleEmail: result.email || "",
              },
            });
          }
          return;
        }

        const delivered = await publishResult(result);

        if (delivered) {
          window.close();
          return;
        }

        // Nothing is listening (opener navigated away, channel unsupported,
        // popups isolated). Never close silently — the user would be left on
        // the login screen with no explanation
        if (result.success && result.accessToken) {
          try {
            await setAccessToken(result.accessToken);
            await refresh();  // status becomes AUTHENTICATED before the nav
            setStranded({ success: true });
          } catch {
            setStranded({ success: false, message: googleErrorMessage("storage_failed") });
          }
        } else {
          setStranded({ success: false, message: googleErrorMessage(result.error, result.message) });
        }
      }

      const errorParam = firstParam(params.error);
      const exchangeToken = firstParam(params.exchangeToken);

      if (errorParam) {
        // `email` accompanies error=email_not_verified only
        await finish({ success: false, error: errorParam, email: firstParam(params.email) || "" });
        return;
      }

      if (!exchangeToken) {
        await finish({ success: false, error: "missing_exchange_token" });
        return;
      }

      try {
        const data = await exchangeGoogleToken(exchangeToken);

        if (popup) {
          await finish({ success: true, accessToken: data.accessToken });
        } else {
          await setAccessToken(data.accessToken);
          await refresh();
          await finish({ success: true }); // → router.replace("/dashboard")
        }
      } catch (err) {
        // Forward the server's own message ("Invalid or expired sign-in
        // session…", rate-limit copy, etc.)
        await finish({
          success: false,
          error: "exchange_failed",
          message: err instanceof ApiClientError ? err.message : undefined,
        });
      }
    }

    finishSignIn();
  }, [params.exchangeToken, params.error, params.popup]);

  if (stranded) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{stranded.success ? "You're signed in" : "Sign-in failed"}</Text>
        <Text style={styles.message}>
          {stranded.success
            ? "We couldn't switch back to the tab you started from. Continue here, or close this window and refresh that tab."
            : stranded.message}
        </Text>

        {stranded.success ? (
          <Pressable style={styles.button} onPress={() => router.replace("/dashboard")}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => router.replace("/login")}>
            <Text style={styles.buttonText}>Back to login</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
      <Text style={styles.message}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: "center" },
  message: { ...typography.caption, color: colors.textSecondary, marginTop: 12, textAlign: "center" },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.green600,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { ...typography.caption, color: colors.white, fontWeight: "700" },
});