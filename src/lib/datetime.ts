import type { Language } from "@/lib/theme/theme-config";

/** Map the active UI language to a BCP-47 locale for Intl formatting. */
export function localeFor(lang: Language): string {
  return lang === "fr" ? "fr-FR" : lang === "ar" ? "ar" : "en-US";
}

/**
 * Notification timestamp — short date + time (e.g. "20 Jul, 14:32"), localized.
 * Used wherever a notification is shown (bell list, toasts).
 */
export function formatNotifTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(localeFor(lang), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
