/**
 * Continuidade inteligente entre direções.
 * Direção → Execução → Resultado → Interpretação → Próxima direção.
 * Módulo puro (sem I/O) — usado no cliente e no motor da MAG.
 */

export type ClosureKey = "done" | "partial" | "blocked" | "skipped";

export const CLOSURE_OPTIONS: { key: ClosureKey; label: string }[] = [
  { key: "done", label: "Concluí" },
  { key: "partial", label: "Avancei parcialmente" },
  { key: "blocked", label: "Não fiz" },
  { key: "skipped", label: "Mudou de prioridade" },
];

export function closureLabel(key: string | null | undefined): string | null {
  return CLOSURE_OPTIONS.find((o) => o.key === key)?.label ?? null;
}

export type SignalQuestion = {
  key: "conversa" | "resposta" | "publicacao" | "destravou";
  question: string;
  options: string[];
};

const SIGNALS: { key: SignalQuestion["key"]; question: string; options: string[]; re: RegExp }[] = [
  {
    key: "resposta",
    question: "Houve resposta?",
    options: ["Sim", "Ainda não", "Não"],
    re: /(proposta|orçamento|orcamento|envie o valor|cotação|cotacao)/i,
  },
  {
    key: "conversa",
    question: "Gerou alguma conversa?",
    options: ["Sim", "Não"],
    re: /(contato|prospec|lead|mensagem|whatsapp|direct|ligue|ligação|ligacao|reative|retome)/i,
  },
  {
    key: "publicacao",
    question: "Você publicou?",
    options: ["Sim", "Não"],
    re: /(publiqu|post|story|stories|reels|vídeo|video|conteúdo|conteudo|grave)/i,
  },
  {
    key: "destravou",
    question: "Isso destravou alguma coisa?",
    options: ["Sim", "Parcialmente", "Não"],
    re: /(organiz|revis|estrutur|planej|agenda|processo|liste|defina|ajuste)/i,
  },
];

/** UMA pergunta contextual, escolhida pelo tipo de direção. */
export function inferSignalQuestion(text: string | null | undefined): SignalQuestion | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  for (const s of SIGNALS) {
    if (s.re.test(t)) return { key: s.key, question: s.question, options: s.options };
  }
  return null;
}

export type ContinuityMode = "continuar" | "aprofundar" | "adaptar" | "mudar_foco";

const MODE_LABEL: Record<ContinuityMode, string> = {
  continuar: "Continuando de ontem",
  aprofundar: "Próximo movimento",
  adaptar: "Ajuste do movimento",
  mudar_foco: "Novo foco",
};

export function normalizeMode(raw: string | null | undefined): ContinuityMode | null {
  const v = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "continuar" || v === "aprofundar" || v === "adaptar" || v === "mudar_foco") return v;
  if (v === "mudar" || v === "mudar_o_foco" || v === "novo_foco") return "mudar_foco";
  return null;
}

export function continuityLabel(raw: string | null | undefined): string | null {
  const mode = normalizeMode(raw);
  return mode ? MODE_LABEL[mode] : null;
}

/** Modo esperado a partir do que aconteceu com a direção anterior. */
export function expectedMode(input: {
  outcome: string | null | undefined;
  signalAnswer: string | null | undefined;
  repeatedNonExecution: boolean;
}): ContinuityMode | null {
  const answer = (input.signalAnswer ?? "").toLowerCase();
  if (input.outcome === "skipped") return "mudar_foco";
  if (input.repeatedNonExecution) return "adaptar";
  if (input.outcome === "blocked") return "adaptar";
  if (input.outcome === "partial") return "aprofundar";
  if (input.outcome === "done") {
    if (answer.startsWith("sim") || answer.startsWith("parcial")) return "continuar";
    if (answer === "não" || answer === "nao") return "adaptar";
    return "continuar";
  }
  return null;
}
