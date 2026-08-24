import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

const RESEND_SECONDS = 20;

//manage OTP input
export function useOtpInput(length = 4) {
  const [code, setCode] = useState<string[]>(Array(length).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setInputRef = (idx: number) => (r: TextInput | null) => {
    inputs.current[idx] = r;
  };

  const handleChange = (val: string, idx: number) => {
    const next = [...code];
    next[idx] = val.replace(/[^0-9]/g, "").slice(-1);
    setCode(next);
    if (val && idx < length - 1) inputs.current[idx + 1]?.focus();
  };

  const resend = () => setSeconds(RESEND_SECONDS);

  const canResend = seconds <= 0;
  const codeValue = code.join("");

  return {
    code,
    codeValue,
    seconds,
    canResend,
    setInputRef,
    handleChange,
    resend,
  };
}
