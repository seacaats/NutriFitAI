import { apiClient } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import defaultTokens, { getShellColors } from "@/shared/theme/nutrifitai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";


const STORAGE_KEY = "nutrifit-theme";

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children, tokens = defaultTokens }) {
  const { user } = useAuth();
  const [darkMode, setDarkModeState] = useState(false);
  const signedIn = Boolean(user);
  const accountTheme = user?.theme;
  const wasSignedIn = useRef(false);

  // load saved theme
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "dark") setDarkModeState(true);
    });
  }, []);

  // Signed in: the account's saved theme wins over what the device had. A
  // plain "system" account keeps the device's
  useEffect(() => {
    if (accountTheme !== "dark" && accountTheme !== "light") return;
    const dark = accountTheme === "dark";
    setDarkModeState(dark);
    AsyncStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [accountTheme]);

  // Signed out: the device forgets the theme, so the next visitor (or
  // account) on this browser doesn't inherit it
  useEffect(() => {
    if (signedIn) {
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      AsyncStorage.removeItem(STORAGE_KEY);
      setDarkModeState(false);
    }
  }, [signedIn]);

  // Saved on the device, and on the account when signed in. The device copy
  // is what changes the look, so a failed save doesn't hold it up
  const setDarkMode = (value) => {
    setDarkModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? "dark" : "light");
    if (signedIn) apiClient.patch("/profile", { theme: value ? "dark" : "light" }, { auth: true }).catch(() => {});
  };

  const toggleTheme = () => setDarkMode(!darkMode);

  const shell = useMemo(() => {
    const resolve = tokens.getShellColors || getShellColors;
    return resolve(darkMode);
  }, [tokens, darkMode]);

  const value = useMemo(
    () => ({ darkMode, setDarkMode, toggleTheme, tokens, shell }),
    [darkMode, tokens, shell, signedIn]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}