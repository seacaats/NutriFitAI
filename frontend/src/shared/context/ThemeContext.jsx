import defaultTokens, { colors, getAuthColors, getShellColors } from "@/shared/theme/nutrifitai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform } from "react-native";


const STORAGE_KEY = "nutrifit-theme";

const ThemeContext = createContext(undefined);

// The device's light/dark setting, the default until a theme is saved
function systemDark() {
  try {
    return Appearance.getColorScheme() === "dark";
  } catch {
    return false;
  }
}

// Web: the saved theme is read before the first render (AsyncStorage is async,
// so the first frame blinked on a dark refresh). Nothing saved follows the device
function initialDark() {
  if (Platform.OS !== "web") return systemDark();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? saved === "dark" : systemDark();
  } catch {
    return systemDark();
  }
}

export function ThemeProvider({ children, tokens = defaultTokens }) {
  const [darkMode, setDarkModeState] = useState(initialDark);

  // load saved theme
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) setDarkModeState(saved === "dark");
    });
  }, []);

  // Saved on the device only, kept as is through sign-in and sign-out
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

// Colors for the auth screens, from the same dark/light flag as the public pages
const AuthColorsContext = createContext(null);

export function AuthColorsProvider({ children }) {
  const { darkMode } = useTheme();
  const value = useMemo(() => getAuthColors(darkMode), [darkMode]);
  return <AuthColorsContext.Provider value={value}>{children}</AuthColorsContext.Provider>;
}

// The auth palette inside the auth screens, `fallback` anywhere else
export function useAuthColors(fallback = colors) {
  return useContext(AuthColorsContext) || fallback;
}