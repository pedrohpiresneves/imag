import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { languageInstruction } from "@/lib/i18n/ai-language.server";

export type ReadingInput = {
  profession: string | null;
  goal: string | null;
  activeDays: number;
  received: number;
  executed: number;
  executionPct: number;
  impacts: string[];
  mainMovement: string | null;
  fieldDelta: number | null;
  executedTitles: string[];
  blockedTitles: string[];
  language?: string | null;
};

/** Leitura da MAG: 2 parágrafos curtos, sempre ancorados nos dados reais da semana. */
export async function generateWeeklyReading(input: ReadingInput): Promise<string[]> {
  const fallback = deterministicReading(input);
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return fallback;
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é a MAG, mentora estratégica da iMAG. Escreva 2 parágrafos curtos (máx. 2 frases cada), separados por uma linha em branco. " +
        "Fale diretamente com o profissional usando 'você'. Cite explicitamente os dados reais recebidos (números, ações executadas, resultados). " +
        "Proibido: frases genéricas de autoajuda, elogios vazios, emojis, listas, títulos. O segundo parágrafo aponta o espaço concreto da próxima semana." +
        languageInstruction(input.language),
      prompt: JSON.stringify(input),
    });
    const paras = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 2);
    return paras.length ? paras : fallback;
  } catch {
    return fallback;
  }
}

function deterministicReading(i: ReadingInput): string[] {
  const a =
    i.received > 0
      ? `Você recebeu ${i.received} ${i.received === 1 ? "direção" : "direções"} esta semana e executou ${i.executed} (${i.executionPct}%), com movimento em ${i.activeDays} ${i.activeDays === 1 ? "dia" : "dias"}.`
      : "Esta semana ainda não teve direções registradas — seu histórico começa no próximo check-in.";
  const b = i.impacts.length
    ? `O que gerou resultado foi ${i.impacts[0]!.toLowerCase()}. Na próxima semana há espaço para repetir esse tipo de ação${i.mainMovement ? ` dentro de ${i.mainMovement.toLowerCase()}` : ""}.`
    : i.mainMovement
      ? `Seu movimento predominante foi ${i.mainMovement.toLowerCase()}. Na próxima semana, registrar o resultado de cada direção é o que transforma execução em leitura real.`
      : "Registrar o resultado de cada direção é o que permite à MAG ler seu padrão na próxima semana.";
  return [a, b];
}