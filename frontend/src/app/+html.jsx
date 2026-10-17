import { ScrollViewStyleReset } from "expo-router/html";

// Web only: the HTML shell of every page (static export).
// Paints the loading screen's color before any JS runs, so a refresh doesn't flash white.
// Nothing saved follows the device's light/dark setting, like ThemeContext
// Nothing else lives here: fonts load in _layout (useFonts)
export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        {/* The saved theme is read before the first paint (same key as ThemeContext) */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("nutrifit-theme");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.setAttribute("data-theme","dark")}catch(e){}` }} />
        <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: #dcffca; }\nhtml[data-theme="dark"], html[data-theme="dark"] body { background-color: #111111; }` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}