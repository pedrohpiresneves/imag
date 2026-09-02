import { useCallback, useEffect, useState } from "react";

export type MagAppearance = "light" | "dark" | "system";

const KEY = "imag:appearance";

export function readAppearance(): MagAppearance {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(KEY);
  return v === "dark" || v === "system" || v === "light" ? v : "light";
}

function resolve(pref: MagAppearance): "light" | "dark" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica o tema da MAG no documento (funciona também para portais). */
export function applyAppearance(pref: MagAppearance) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-mag-theme", resolve(pref));
}

/**
 * Preferência de aparência da MAG: claro (padrão), escuro ou seguir o sistema.
 * A escolha é salva no dispositivo e reaplicada nos próximos acessos.
 */
export function useMagTheme() {
  const [appearance, setAppearanceState] = useState<MagAppearance>("light");

  useEffect(() => {
    const pref = readAppearance();
    setAppearanceState(pref);
    applyAppearance(pref);
  }, []);

  useEffect(() => {
    if (appearance !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance]);

  const setAppearance = useCallback((pref: MagAppearance) => {
    setAppearanceState(pref);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, pref);
    applyAppearance(pref);
  }, []);

  const resolved = resolve(appearance);

  return { appearance, setAppearance, resolved };
}
