import { ApiClientError } from "@/shared/api/apiClient";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import { homeFor, useAuth } from "@/shared/context/AuthContext";
import { exchangeGoogleToken, googleErrorMessage, mfaFromExchange, stashGoogleMfa } from "@/shared/services/googleAuth";
import { colors, spacing, typography } from "@/shared/theme/nutrifitai";
import { GOOGLE_AUTH_ACK_TYPE, GOOGLE_AUTH_CHANNEL, GOOGLE_AUTH_MESSAGE_TYPE } from "@/shared/utils/authChannel";
import { setAccessToken } from "@/shared/utils/authStorage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Timeout waiting for the opener tab to acknowledge the BroadcastChannel result.
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

// On web, read query parameters directly from window.location.search before router params hydrate.
function readQuery(params) {
  if (typeof window !== "undefined" && window.location?.search) {
    const search = new URLSearchParams(window.location.search);
    return {
      error: search.get("error"),
      email: search.get("email"),
      exchangeToken: search.get("exchangeToken"),
    };
  }
  return {
    error: firstParam(params.error),
    email: firstParam(params.email),
    exchangeToken: firstParam(params.exchangeToken),
  };
}

/**
 * Publishes the OAuth result to the opener tab via BroadcastChannel and waits
 * for an acknowledgment before closing the channel, ensuring asynchronous
 * delivery completes before window.close() runs.
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
        // Channel already closed
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
  const { refresh, role } = useAuth();
  const ranOnce = useRef(false);

  // Set when the popup cannot hand the result back to the opener tab.
  const [stranded, setStranded] = useState(null);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    async function finishSignIn() {
      const popup = isPopup(params);

      async function finish(result) {
        if (!popup) {
          if (result.success) {
            router.replace(homeFor(result.role));
          } else {
            router.replace({
              pathname: "/login",
              params: {
                googleError: result.error || "exchange_failed",
                googleMessage: result.message || "",
                // Passed on error=registration_required so the login screen can prefill registration.
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

        // Opener did not acknowledge (closed, navigated away, or isolated); show fallback UI in popup.
        if (result.mfa) {
          setStranded({ success: false, message: googleErrorMessage("mfa_undelivered") });
        } else if (result.success && result.accessToken) {
          try {
            await setAccessToken(result.accessToken);
            await refresh();
            setStranded({ success: true });
          } catch {
            setStranded({ success: false, message: googleErrorMessage("storage_failed") });
          }
        } else {
          setStranded({ success: false, message: googleErrorMessage(result.error, result.message) });
        }
      }

      const query = readQuery(params);

      if (query.error) {
        await finish({ success: false, error: query.error, email: query.email || "" });
        return;
      }

      // Redirect stray visits without a token or error back to login.
      if (!query.exchangeToken) {
        if (popup) {
          await finish({ success: false, error: "missing_exchange_token" });
        } else {
          router.replace("/login");
        }
        return;
      }

      const exchangeToken = query.exchangeToken;

      try {
        const data = await exchangeGoogleToken(exchangeToken);

        if (data.mfaRequired) {
          // Hand off the pending MFA challenge to the login screen.
          const mfa = mfaFromExchange(data);
          if (popup) {
            await finish({ success: true, mfa });
          } else {
            stashGoogleMfa(mfa);
            router.replace("/login");
          }
        } else if (popup) {
          await finish({ success: true, accessToken: data.accessToken });
        } else {
          await setAccessToken(data.accessToken);
          const me = await refresh();
          await finish({ success: true, role: me?.role });
        }
      } catch (err) {
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
          <Pressable style={styles.button} onPress={() => router.replace(homeFor(role))}>
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

  return <LoadingScreen message="Completing sign-in…" />;
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
