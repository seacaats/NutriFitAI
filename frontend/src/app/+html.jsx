import { ScrollViewStyleReset } from "expo-router/html";

// Web-only HTML shell (static export). Sets the initial theme background before JS runs to prevent a flash of unstyled background.
export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        {/* Apply the stored or system theme before first paint (matches ThemeContext) */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("nutrifit-theme");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.setAttribute("data-theme","dark")}catch(e){}` }} />
        <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: #dcffca; }\nhtml[data-theme="dark"], html[data-theme="dark"] body { background-color: #111111; }` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
