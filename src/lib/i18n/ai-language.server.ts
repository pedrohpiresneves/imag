import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, isLocale, LOCALE_AI_NAMES, type Locale } from "./locales";

/** Lê o idioma preferido do usuário para orientar a MAG. */
export async function getUserLocale(
  db: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<Locale> {
  try {
    const { data } = await db
      .from("profiles")
      .select("language")
      .eq("id", userId)
      .maybeSingle();
    const lang = (data as { language?: string | null } | null)?.language;
    return isLocale(lang) ? lang : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Bloco de instrução de idioma anexado a todos os prompts da MAG.
 * Garante que direções, análises, insights e resumos sejam gerados
 * nativamente no idioma escolhido — não apenas traduzidos.
 */
export function languageInstruction(locale: string | null | undefined): string {
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return `\n\nIDIOMA DE SAÍDA (obrigatório): escreva 100% em ${LOCALE_AI_NAMES[l]}. Pense e escreva nativamente nesse idioma, com naturalidade cultural — não traduza literalmente do português. Todos os campos de texto gerados (títulos, descrições, motivos, análises, resumos) devem estar nesse idioma, mesmo que o contexto do usuário esteja em outro idioma. Mantenha nomes próprios como "iMAG", "MAG" e "MAG Meta" inalterados.`;
}