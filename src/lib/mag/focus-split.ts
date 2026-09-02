/**
 * Separação de objetivos dentro de um único texto de Foco da Semana.
 *
 * Regra do produto: existe apenas UM foco principal por semana. Quando o
 * usuário escreve mais de um objetivo ("emagrecer e organizar as finanças"),
 * a MAG não confirma a frase inteira: ela separa os objetivos identificados
 * dinamicamente a partir do próprio texto e pede uma escolha.
 *
 * Puro, determinístico e sem rede — funciona para qualquer conta e domínio.
 */

const CONNECTORS =
  /\s*(?:,|;|\/|\be\b|\btambém\b|\balém de\b|\balem de\b|\bmais\b|\bjunto com\b)\s*/gi;

/** Verbos/expressões que sinalizam um objetivo próprio dentro da frase. */
const GOAL_HINT =
  /(emagrec|perder|organiz|cuidar|estud|aprend|econom|guardar|viaj|ganhar|faturar|vender|conseguir|melhorar|criar|lan[çc]ar|escrever|terminar|concluir|resolver|pagar|treinar|correr|dormir|meditar|montar|planej|contratar|reduzir|aumentar|come[çc]ar|manter|separar|arrumar|limpar|revisar)/i;

/** Palavras que não formam objetivo sozinhas. */
const STOP = /^(?:e|de|da|do|das|dos|para|pra|com|em|no|na|meu|minha|meus|minhas|mais|um|uma)$/i;

function clean(part: string): string {
  return part
    .replace(/\s+/g, " ")
    .replace(/^[\s,;./-]+|[\s,;./-]+$/g, "")
    .replace(/[.]+$/, "")
    .trim();
}

function titleize(part: string): string {
  const t = clean(part);
  if (!t) return t;
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 120);
}

function isGoalLike(part: string): boolean {
  const t = clean(part);
  if (t.length < 4) return false;
  const words = t.split(/\s+/).filter((w) => !STOP.test(w));
  if (!words.length) return false;
  return GOAL_HINT.test(t) || words.length >= 2;
}

/**
 * Devolve os objetivos distintos identificados no texto.
 * Um único item = foco simples; dois ou mais = precisa de escolha.
 */
export function splitGoals(raw: string): string[] {
  const text = clean(raw ?? "");
  if (!text) return [];

  const parts = text
    .split(CONNECTORS)
    .map(clean)
    .filter((p) => p.length > 0);

  if (parts.length <= 1) return [titleize(text)];

  const goals: string[] = [];
  for (const part of parts) {
    if (!isGoalLike(part)) {
      // Fragmento sem objetivo próprio pertence ao anterior ("mais leve", "de verdade").
      if (goals.length) goals[goals.length - 1] = titleize(`${goals[goals.length - 1]} ${part}`);
      continue;
    }
    goals.push(titleize(part));
  }

  // Objetivos distintos precisam de verbos/temas diferentes; senão é um só.
  const unique = goals.filter(
    (g, i) => goals.findIndex((o) => o.toLowerCase() === g.toLowerCase()) === i,
  );
  const withVerb = unique.filter((g) => GOAL_HINT.test(g));
  if (withVerb.length >= 2) return withVerb.slice(0, 4);
  if (unique.length >= 2 && unique.every((g) => g.split(/\s+/).length >= 2)) {
    return unique.slice(0, 4);
  }
  return [titleize(text)];
}

export type GoalRecommendation = {
  choice: string;
  reason: string;
};

type Signal = { match: RegExp; weight: number; reason: string };

/** Sinais de urgência/impacto/possibilidade real de avanço nesta semana. */
const SIGNALS: Signal[] = [
  { match: /atras|vencid|d[íi]vida|urgente|hoje|amanh[ãa]|prazo|entrega/i, weight: 5, reason: "tem prazo e cobra decisão agora" },
  { match: /\d+/, weight: 3, reason: "já tem um número claro para acompanhar" },
  { match: /organiz|arrumar|separar|revisar|listar|mapear/i, weight: 3, reason: "dá para avançar de verdade em poucos dias" },
  { match: /sa[úu]de|dor|sono|cansa[çc]o|ansiedade/i, weight: 3, reason: "afeta sua energia para todo o resto" },
  { match: /financ|dinheiro|conta|gasto|renda|faturar/i, weight: 2, reason: "destrava decisões do resto do mês" },
  { match: /cliente|venda|trabalho|projeto|apresenta[çc]/i, weight: 2, reason: "tem impacto direto no seu resultado" },
  { match: /emagrec|treino|corr|academia|dieta/i, weight: 1, reason: "pede constância, e a semana começa isso bem" },
  { match: /viaj|sonho|algum dia|futuro/i, weight: -2, reason: "pode esperar sem prejuízo" },
];

/**
 * Recomendação (nunca decisão silenciosa): a MAG sugere um foco e explica.
 * `context` traz sinais reais da conta (compromissos, pendências, histórico).
 */
export function recommendGoal(goals: string[], context = ""): GoalRecommendation | null {
  const list = goals.filter((g) => g.trim().length > 0);
  if (list.length < 2) return null;

  let best = list[0]!;
  let bestScore = -Infinity;
  let bestReason = "dá para dar um passo concreto ainda nesta semana";

  for (const goal of list) {
    let score = 0;
    let reason = bestReason;
    for (const s of SIGNALS) {
      if (s.match.test(goal)) {
        score += s.weight;
        if (s.weight > 0) reason = s.reason;
      }
      // O contexto real da conta reforça o objetivo relacionado.
      if (context && s.weight > 0 && s.match.test(context) && s.match.test(goal)) score += 1;
    }
    // Objetivo mais específico tende a avançar mais rápido.
    score += Math.min(goal.split(/\s+/).length, 6) * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = goal;
      bestReason = reason;
    }
  }

  return { choice: best, reason: bestReason };
}
