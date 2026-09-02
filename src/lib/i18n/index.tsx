import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { ptBR, type Dictionary } from "./dict/pt-BR";
import { en } from "./dict/en";
import { es } from "./dict/es";
import {
  DEFAULT_LOCALE,
  detectDeviceLocale,
  isLocale,
  LOCALE_INTL,
  type Locale,
} from "./locales";

const DICTS: Record<Locale, Dictionary> = { "pt-BR": ptBR, en, es };
const STORAGE_KEY = "imag.locale";

type Section = keyof Dictionary;
type Key<S extends Section> = keyof Dictionary[S] & string;

type I18nValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: <S extends Section>(section: S, key: Key<S>) => string;
  formatDate: (iso: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string | null;
};

const I18nContext = createContext<I18nValue | null>(null);

function readStored(): Locale | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(raw) ? raw : null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR e primeira renderização usam o padrão para evitar mismatch de hidratação.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // 1) preferência local (ou idioma do dispositivo no primeiro acesso)
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setLocaleState(stored);
      return;
    }
    const detected = detectDeviceLocale();
    window.localStorage.setItem(STORAGE_KEY, detected);
    setLocaleState(detected);
  }, []);

  // 2) preferência salva na conta prevalece quando existir
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", uid)
        .maybeSingle();
      const saved = (profile as { language?: string | null } | null)?.language;
      if (!alive) return;
      if (isLocale(saved)) {
        window.localStorage.setItem(STORAGE_KEY, saved);
        setLocaleState(saved);
      } else {
        // primeira vez: persiste o idioma detectado na conta
        const current = readStored() ?? DEFAULT_LOCALE;
        await supabase.from("profiles").update({ language: current }).eq("id", uid);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (uid) await supabase.from("profiles").update({ language: next }).eq("id", uid);
    })();
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[locale] ?? ptBR;
    return {
      locale,
      setLocale,
      t: (section, key) => {
        const fromLocale = (dict[section] as Record<string, string>)[key];
        if (fromLocale) return fromLocale;
        return (ptBR[section] as Record<string, string>)[key] ?? String(key);
      },
      formatDate: (iso, opts) => {
        if (!iso) return null;
        const d = typeof iso === "string" ? new Date(iso) : iso;
        if (Number.isNaN(d.getTime())) return null;
        return new Intl.DateTimeFormat(LOCALE_INTL[locale], {
          day: "2-digit",
          month: "long",
          year: "numeric",
          ...opts,
        }).format(d);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback seguro (componentes renderizados fora do provider).
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (section, key) => (ptBR[section] as Record<string, string>)[key] ?? String(key),
    formatDate: (iso) =>
      iso ? new Date(iso).toLocaleDateString(LOCALE_INTL[DEFAULT_LOCALE]) : null,
  };
}

/** Atalho: const t = useT(); t("nav", "today") */
export function useT() {
  return useI18n().t;
}

export { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "./locales";
export type { Locale } from "./locales";