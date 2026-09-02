import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "am_theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback: uncontrolled toggle that still writes to DOM/localStorage.
    return {
      theme: "dark",
      setTheme: (t) => {
        applyTheme(t);
        try {
          window.localStorage.setItem(STORAGE_KEY, t);
        } catch {}
      },
      toggle: () => {
        const next: Theme = readInitial() === "dark" ? "light" : "dark";
        applyTheme(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {}
      },
    };
  }
  return ctx;
}

/** Inline script to set theme class before hydration (avoid FOUC). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t='dark';}var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;