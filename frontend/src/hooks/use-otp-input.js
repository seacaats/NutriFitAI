import { useEffect, useRef, useState } from "react";


export function useOtpInput(length = 4) {
  const [code, setCode] = useState(Array(length).fill(""));
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setInputRef = (idx) => (r) => {
    inputs.current[idx] = r;
  };

  const handleChange = (val, idx) => {
    const digit = val.replace(/[^0-9]/g, "").slice(-1);

    const next = [...code];
    next[idx] = digit;
    setCode(next);

    if (digit && idx < length - 1) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const reset = () => setCode(Array(length).fill(""));

  return {
    code,
    codeValue: code.join(""),
    setInputRef,
    handleChange,
    handleKeyPress,
    reset,
  };
}