import { useEffect } from "react";
import { Platform } from "react-native";

// Injects custom scrollbar styles on web that match the active theme
const STYLE_ID = "nutrifit-scrollbar";

export function useWebScrollbar(darkMode) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const thumb = darkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
    const hover = darkMode ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)";

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      * { scrollbar-width: thin; scrollbar-color: ${thumb} transparent; }
      *::-webkit-scrollbar { width: 8px; height: 8px; background: transparent; }
      *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: transparent; }
      *::-webkit-scrollbar-thumb { background: ${thumb}; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
      *::-webkit-scrollbar-thumb:hover { background: ${hover}; background-clip: padding-box; }
      *::-webkit-scrollbar-button { display: none; }
    `;
  }, [darkMode]);
}
