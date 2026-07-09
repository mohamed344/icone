/**
 * Theme configuration — the catalog of choices the Settings page exposes.
 * The ThemeProvider reads a ThemeState and writes CSS variables / attributes
 * onto <html>. Nothing here touches a database; persistence is localStorage.
 */

export type Mode = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type FontKey = "geist" | "display" | "mono-ish";
export type Language = "en" | "ar" | "fr";
/** Flat = solid accent (no gradients). Gradient = accent → accent2 gradients. */
export type UiStyle = "flat" | "gradient";

/**
 * Languages currently offered in the UI. The i18n system supports en/ar/fr;
 * only the ones listed here are selectable. To add a language later, translate
 * its dictionary and add its code here.
 */
export const ENABLED_LANGUAGES: Language[] = ["fr"];
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

export interface AccentPreset {
  key: string;
  name: string;
  accent: string;
  /** kept for type compatibility; equals `accent` now (no gradients) */
  accent2: string;
  contrast: string;
}

/** Accent colors. `accent` is the solid color (flat mode); `accent2` is the
 * gradient partner used only when the Style setting is "gradient". */
export const ACCENT_PRESETS: AccentPreset[] = [
  { key: "sky", name: "Sky", accent: "#0ea5e9", accent2: "#22d3ee", contrast: "#ffffff" },
  { key: "ocean", name: "Ocean", accent: "#0284c7", accent2: "#0ea5e9", contrast: "#ffffff" },
  { key: "indigo", name: "Indigo", accent: "#4f46e5", accent2: "#818cf8", contrast: "#ffffff" },
  { key: "teal", name: "Teal", accent: "#0d9488", accent2: "#2dd4bf", contrast: "#ffffff" },
  { key: "violet", name: "Violet", accent: "#7c3aed", accent2: "#c084fc", contrast: "#ffffff" },
  { key: "rose", name: "Rose", accent: "#e11d48", accent2: "#fb7185", contrast: "#ffffff" },
  { key: "amber", name: "Amber", accent: "#d97706", accent2: "#fbbf24", contrast: "#1a1304" },
  { key: "slate", name: "Slate", accent: "#475569", accent2: "#94a3b8", contrast: "#ffffff" },
];

export interface BackgroundPreset {
  key: string;
  name: string;
  bg: string;
  bg2: string;
}

/** Page background presets — chosen in Settings (applied in light mode). */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "white", name: "White", bg: "#ffffff", bg2: "#f4f7fb" },
  { key: "sky", name: "Sky", bg: "#e0f2fe", bg2: "#f0f9ff" },
  { key: "cloud", name: "Cloud", bg: "#eef2f7", bg2: "#f8fafc" },
  { key: "sand", name: "Sand", bg: "#f7f1e7", bg2: "#fffdf8" },
  { key: "mint", name: "Mint", bg: "#dcf5ea", bg2: "#f0fdf9" },
  { key: "lavender", name: "Lavender", bg: "#ece9fb", bg2: "#f6f4fe" },
];

export const FONTS: { key: FontKey; name: string; cssVar: string; previewClass: string }[] = [
  { key: "geist", name: "Geist", cssVar: "var(--font-geist-sans)", previewClass: "font-sans" },
  { key: "display", name: "Sora", cssVar: "var(--font-display)", previewClass: "font-display" },
  { key: "mono-ish", name: "Geist Mono", cssVar: "var(--font-geist-mono)", previewClass: "font-mono" },
];

export interface ThemeState {
  mode: Mode;
  accent: string; // accent preset key
  background: string; // background preset key
  style: UiStyle;
  font: FontKey;
  density: Density;
  language: Language;
}

export const DEFAULT_THEME: ThemeState = {
  mode: "light",
  accent: "sky",
  background: "white",
  style: "flat",
  font: "geist",
  density: "comfortable",
  language: "fr",
};

export const STORAGE_KEY = "icone.theme";

export function getAccent(key: string): AccentPreset {
  return ACCENT_PRESETS.find((a) => a.key === key) ?? ACCENT_PRESETS[0];
}

export function getBackground(key: string): BackgroundPreset {
  return BACKGROUND_PRESETS.find((b) => b.key === key) ?? BACKGROUND_PRESETS[0];
}

export function getFontVar(key: FontKey): string {
  return FONTS.find((f) => f.key === key)?.cssVar ?? FONTS[0].cssVar;
}

/** Resolve "system" against the OS preference. SSR-safe (defaults to light). */
export function resolveMode(mode: Mode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Apply a theme state to the document root. Used both by the no-flash inline
 * script (inlined as a string) and by the ThemeProvider at runtime — keep the
 * logic here mirrored in src/lib/theme/no-flash.ts.
 */
export function applyTheme(state: ThemeState, root: HTMLElement = document.documentElement) {
  const accent = getAccent(state.accent);
  const background = getBackground(state.background);
  const mode = resolveMode(state.mode);

  root.dataset.theme = mode;
  root.dataset.density = state.density;
  root.dataset.font = state.font;
  root.dataset.style = state.style;
  root.dir = state.language === "ar" ? "rtl" : "ltr";
  root.lang = state.language;

  root.style.setProperty("--accent", accent.accent);
  root.style.setProperty("--accent-2", accent.accent2);
  root.style.setProperty("--accent-contrast", accent.contrast);
  root.style.setProperty("--app-font", `${getFontVar(state.font)}, system-ui, sans-serif`);

  // Background presets apply in light mode; in dark mode the [data-theme=dark]
  // CSS owns the canvas, so clear the inline overrides.
  if (mode === "light") {
    root.style.setProperty("--bg", background.bg);
    root.style.setProperty("--bg-2", background.bg2);
  } else {
    root.style.removeProperty("--bg");
    root.style.removeProperty("--bg-2");
  }
}
