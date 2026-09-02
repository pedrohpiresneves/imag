/** Idiomas suportados pela iMAG. pt-BR é o padrão oficial. */
export const LOCALES = ["pt-BR", "en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  en: "English",
  es: "Español",
};

/** Nome do idioma em inglês — usado nas instruções enviadas à MAG. */
export const LOCALE_AI_NAMES: Record<Locale, string> = {
  "pt-BR": "Brazilian Portuguese (pt-BR)",
  en: "English (en)",
  es: "Spanish (es)",
};

export const LOCALE_INTL: Record<Locale, string> = {
  "pt-BR": "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Normaliza qualquer tag BCP-47 (ex.: "pt", "en-GB", "es-MX") para um idioma suportado. */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const tag = value.toLowerCase();
  if (tag.startsWith("pt")) return "pt-BR";
  if (tag.startsWith("es")) return "es";
  if (tag.startsWith("en")) return "en";
  return null;
}

/** Detecta o idioma do dispositivo no primeiro acesso. */
export function detectDeviceLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const c of candidates) {
    const match = normalizeLocale(c);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}