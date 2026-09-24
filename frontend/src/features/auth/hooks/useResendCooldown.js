import { useEffect, useRef, useState } from "react";

const DEFAULT_COOLDOWN_SECONDS = 60; // keep in sync with backend OTP_RESEND_COOLDOWN_SECONDS

export function useResendCooldown(seconds = DEFAULT_COOLDOWN_SECONDS) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function start() {
    setRemaining(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return { remaining, canResend: remaining === 0, start };
}
