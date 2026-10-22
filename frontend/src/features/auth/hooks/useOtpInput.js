import { useMemo, useRef, useState } from "react";

export function useOtpInput(length = 4) {
  const [digits, setDigits] = useState(Array(length).fill(""));
  const inputRefs = useRef([]);

  const codeValue = useMemo(() => digits.join(""), [digits]);
  const isComplete = codeValue.length === length;

  function setDigit(index, value) {
    const char = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleChange(value, index) {
    setDigit(index, value);
  }

  function handleKeyPress(e, index) {
    const key = e.nativeEvent?.key ?? e.key;
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function setInputRef(index) {
    return (el) => {
      inputRefs.current[index] = el;
    };
  }

  function reset() {
    setDigits(Array(length).fill(""));
    inputRefs.current[0]?.focus();
  }

  return {
    length,
    code: digits,
    setDigit,
    handleChange,
    handleKeyPress,
    setInputRef,
    inputRefs,
    codeValue,
    isComplete,
    reset,
  };
}
