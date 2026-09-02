/**
 * Validador obrigatório da Direção do Dia.
 *
 * Roda ANTES de salvar e ANTES de exibir. Nenhuma direção chega à interface
 * sem passar por aqui. Puro, determinístico, sem rede e sem estado global —
 * vale para qualquer usuário, conta, foco ou domínio.
 */

export type DirectionCheck = {
  ok: boolean;
  reasons: string[];
};

export type DirectionCandidateText = {
  title: string;
  description?: string | null;
  reason?: string | null;
  /** Texto do foco da semana, quando existir (usado só para evitar repetição). */
  focusText?: string | null;
};

/** Dados que jamais podem vazar para a interface. */
const LEAK_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, why: "contém identificador interno" },
  { re: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i, why: "contém e-mail" },
  { re: /(^|\s)@[a-z0-9_.]{3,}/i, why: "contém username" },
  { re: /\b(user_id|user_plans|weekly_focus|profiles|day_events|day_priorities|magnet_transactions|supabase|select |insert |update )\b/i, why: "contém referência técnica" },
  { re: /\b(undefined|null|NaN|\[object Object\])\b/, why: "contém valor não tratado" },
  { re: /\{\{?\s*\w+\s*\}?\}|\$\{\w+\}|<\w+>/, why: "contém variável não substituída" },
  { re: /\b(eyJ[\w-]{10,}|sk-[\w-]{10,}|Bearer\s)/i, why: "contém token" },
  { re: /[<>\\|]{2,}|�|\uFFFD/, why: "contém caracteres inválidos" },
];

/** Ações vagas que devolvem a decisão para o usuário. */
const DECISION_TRANSFER = [
  "defina um miniobjetivo",
  "defina um mini objetivo",
  "escolha uma ação",
  "escolha o que fazer",
  "decida por onde começar",
  "pense em algo",
  "pense em alguma coisa",
  "pense no seu objetivo",
  "reflita sobre seu objetivo",
  "faça algo pequeno",
  "tente manter o foco",
  "veja o que faz sentido",
  "defina o que é importante",
];

/** Sugestões genéricas que não demonstram leitura de contexto. */
const GENERIC = [
  "beber um copo de água",
  "beba um copo de água",
  "tomar um copo de água",
  "caminhar cinco minutos",
  "caminhar por cinco minutos",
  "caminhe cinco minutos",
  "comer melhor",
  "comer mais saudável",
  "fazer exercícios",
  "praticar exercícios",
  "organizar a rotina",
  "organize sua rotina",
  "manter o foco",
  "cuidar de si",
];

const VOWELS = /[aeiouáàâãéêíóôõúü]/i;

/** Palavra plausível em português (heurística conservadora contra lixo textual). */
function isPlausibleWord(word: string): boolean {
  const w = word.replace(/[^\p{L}]/gu, "");
  if (w.length < 4) return true;
  if (!VOWELS.test(w)) return false;
  // 4+ consoantes seguidas ou 3 letras iguais em sequência: string corrompida.
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(w)) return false;
  if (/(.)\1\1/i.test(w)) return false;
  const vowels = (w.match(/[aeiouáàâãéêíóôõúü]/gi) ?? []).length;
  if (vowels / w.length < 0.2) return false;
  return true;
}

/** Frase em português coerente: tamanho, palavras plausíveis, pontuação sã. */
export function isCoherentSentence(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 12) return false;
  const words = t.split(/\s+/);
  if (words.length < 4) return false;
  if (words.some((w) => !isPlausibleWord(w))) return false;
  // Sequência colada tipo "bibiemic" sem espaço em texto longo.
  if (words.some((w) => w.replace(/[^\p{L}]/gu, "").length > 24)) return false;
  return true;
}

function includesAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) if (haystack.includes(n)) return n;
  return null;
}

/**
 * Checagem completa. Qualquer motivo listado invalida a direção:
 * ela não é salva, não é exibida e não gera magnetos.
 */
export function validateDirection(input: DirectionCandidateText): DirectionCheck {
  const reasons: string[] = [];
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const reason = (input.reason ?? "").trim();
  const all = `${title}\n${description}\n${reason}`;
  const lower = all.toLowerCase();

  if (!title) reasons.push("direção sem texto");
  if (title.length > 240) reasons.push("título longo demais");

  for (const p of LEAK_PATTERNS) {
    if (p.re.test(all)) reasons.push(p.why);
  }

  if (title && !isCoherentSentence(title)) reasons.push("frase incompleta ou corrompida");
  if (description && !isCoherentSentence(description) && description.length > 12) {
    reasons.push("execução incoerente");
  }

  const transfer = includesAny(lower, DECISION_TRANSFER);
  if (transfer) reasons.push(`transfere a decisão ao usuário ("${transfer}")`);

  const generic = includesAny(lower, GENERIC);
  if (generic) reasons.push(`sugestão genérica ("${generic}")`);

  // Repetir o foco como se fosse ação ("Hoje o foco é emagrecer").
  const focus = (input.focusText ?? "").trim().toLowerCase();
  if (focus && focus.length >= 4) {
    const stripped = title
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.endsWith(focus) && stripped.split(" ").length <= 8) {
      reasons.push("apenas repete o foco, sem ação concreta");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
