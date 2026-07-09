"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  applyTheme,
  DEFAULT_THEME,
  STORAGE_KEY,
  type ThemeState,
} from "./theme-config";

interface ThemeContextValue {
  theme: ThemeState;
  /** Patch one or more fields; applies + persists immediately. */
  setTheme: (patch: Partial<ThemeState>) => void;
  reset: () => void;
  /** True once mounted on the client — guard against SSR mismatches. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from DEFAULT so server & first client render match; hydrate in effect.
  const [theme, setThemeState] = useState<ThemeState>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);
  const mql = useRef<MediaQueryList | null>(null);

  // Hydrate from localStorage after mount (the no-flash script already painted).
  useEffect(() => {
    const stored = readStored();
    setThemeState(stored);
    setReady(true);
  }, []);

  // Re-apply whenever theme changes (after hydration).
  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [theme, ready]);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    mql.current = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme.mode === "system") applyTheme(theme);
    };
    mql.current.addEventListener("change", onChange);
    return () => mql.current?.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((patch: Partial<ThemeState>) => {
    setThemeState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setThemeState(DEFAULT_THEME), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, reset, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
