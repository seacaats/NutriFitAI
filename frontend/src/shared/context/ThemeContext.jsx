import defaultTokens, { getShellColors } from "@/shared/theme/nutrifit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";


const STORAGE_KEY = "nutrifit-theme";

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children, tokens = defaultTokens }) {
  const [darkMode, setDarkModeState] = useState(false);

  // load saved theme
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "dark") setDarkModeState(true);
    });
  }, []);

  const setDarkMode = (value) => {
    setDarkModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? "dark" : "light");
  };

  const toggleTheme = () => setDarkMode(!darkMode);

  const shell = useMemo(() => {
    const resolve = tokens.getShellColors || getShellColors;
    return resolve(darkMode);
  }, [tokens, darkMode]);

  const value = useMemo(
    () => ({ darkMode, setDarkMode, toggleTheme, tokens, shell }),
    [darkMode, tokens, shell]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}