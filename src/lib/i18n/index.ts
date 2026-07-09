"use client";

import { useTheme } from "@/lib/theme/theme-context";
import { DICTS, en, type DictKey } from "./dictionaries";
import type { Language } from "@/lib/theme/theme-config";

export type { DictKey } from "./dictionaries";

/** Pure translate — usable outside React (falls back to English). */
export function translate(lang: Language, key: DictKey): string {
  return DICTS[lang]?.[key] ?? en[key] ?? key;
}

/** Returns a `t(key)` function bound to the active language from the theme. */
export function useT() {
  const { theme } = useTheme();
  const lang = theme.language;
  const t = (key: DictKey) => translate(lang, key);
  t.lang = lang;
  t.dir = (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr";
  return t;
}
