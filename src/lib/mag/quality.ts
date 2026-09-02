/**
 * Avaliação automática de qualidade da direção, antes de exibir.
 * Puro, determinístico e local: o modelo propõe, esta camada aprova ou devolve.
 */

import { isGeneric, similarity } from "./text";
import { claimsProfessionalCredential, type RiskLevel } from "./domains";

export type QualityScores = {
  relevance: number;
  personalization: number;
  practicality: number;
  clarity: number;
  safety: number;
  continuity: number;
  executability: number;
  routine_fit: number;
  focus_link: number;
  trackability: number;
};

export type QualityVerdict = {
  scores: QualityScores;
  total: number;
  blocked: boolean;
  reasons: string[];
};

export type QualityInput = {
  title: string;
  description: string;
  reason: string;
  contextElements: string[];
  minutes: number;
  budgetMinutes: number;
  hasFocus: boolean;
  focusText: string | null;
  riskLevel: RiskLevel;
  needsProfessional: boolean;
  missingCritical: string[];
  isDiagnostic: boolean;
  recentTitles: string[];
  hasCompletionCriteria: boolean;
};

/** Frases que indicam execução fora da iMAG (proibidas). */
const EXTERNAL_TOOLS = [
  "no caderno", "em um papel", "papel e caneta", "bloco de notas", "no bloco",
  "em uma planilha", "outro aplicativo", "em um app", "anote em", "no seu celular",
];

/** Marcadores de prescrição indevida em área sensível. */
const PRESCRIPTIVE = [
  "tome ", "tomar ", " mg", "aumente a dose", "reduza a dose", "corte o carboidrato",
  "faça jejum", "consuma apenas", "você tem ", "seu diagnóstico",
];

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

export function evaluateDirection(input: QualityInput): QualityVerdict {
  const reasons: string[] = [];
  const full = `${input.title} ${input.description}`.toLowerCase();

  let relevance = input.hasFocus ? 8 : 6;
  let personalization = 4 + Math.min(input.contextElements.length, 3) * 2;
  let practicality = 8;
  let clarity = 8;
  let safety = 9;
  let continuity = input.recentTitles.length ? 7 : 8;
  let executability = 8;
  let routine_fit = input.minutes <= input.budgetMinutes ? 9 : 4;
  let focus_link = input.hasFocus ? 7 : 5;
  let trackability = input.hasCompletionCriteria ? 9 : 5;

  if (isGeneric(input.title, input.description)) {
    clarity -= 5;
    practicality -= 4;
    reasons.push("direção genérica demais");
  }

  if (input.description.trim().length < 12) {
    clarity -= 3;
    reasons.push("execução sem instrução clara");
  }

  if (EXTERNAL_TOOLS.some((t) => full.includes(t))) {
    practicality -= 6;
    reasons.push("manda registrar fora da iMAG");
  }

  if (input.minutes > input.budgetMinutes) {
    reasons.push("não cabe na janela real do dia");
  }

  // Repetição semântica com direções recentes.
  let maxSim = 0;
  for (const t of input.recentTitles) {
    const s = similarity(`${input.title} ${input.description}`, t);
    if (s > maxSim) maxSim = s;
  }
  if (maxSim > 0.55) {
    continuity -= 6;
    relevance -= 4;
    reasons.push("repete uma direção recente sem adaptação");
  }

  // Ligação com o foco da semana.
  if (input.hasFocus && input.focusText) {
    const link = similarity(`${input.title} ${input.description} ${input.reason}`, input.focusText);
    focus_link = clamp(4 + link * 12);
    if (focus_link < 4) reasons.push("desconectada do foco da semana");
  }

  // Segurança: prescrição, credencial falsa, risco não reconhecido.
  if (claimsProfessionalCredential(`${full} ${input.reason}`)) {
    safety -= 8;
    reasons.push("assume credencial profissional inexistente");
  }
  if (
    (input.riskLevel === "professional" || input.riskLevel === "urgent") &&
    PRESCRIPTIVE.some((p) => full.includes(p))
  ) {
    safety -= 7;
    reasons.push("prescreve algo em área sensível");
  }
  if (input.riskLevel === "urgent") safety -= 2;

  // Informação crítica ausente: só é aceitável se a direção for de entendimento.
  if (input.missingCritical.length > 0 && !input.isDiagnostic) {
    relevance -= 4;
    reasons.push("depende de informação crítica que ainda não temos");
  }
  if (input.isDiagnostic) {
    trackability = Math.max(trackability, 8);
    executability = Math.max(executability, 9);
  }

  const scores: QualityScores = {
    relevance: clamp(relevance),
    personalization: clamp(personalization),
    practicality: clamp(practicality),
    clarity: clamp(clarity),
    safety: clamp(safety),
    continuity: clamp(continuity),
    executability: clamp(executability),
    routine_fit: clamp(routine_fit),
    focus_link: clamp(focus_link),
    trackability: clamp(trackability),
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const blocked =
    scores.safety < 6 ||
    scores.clarity < 5 ||
    scores.practicality < 5 ||
    scores.relevance < 5 ||
    total < 62;

  return { scores, total, blocked, reasons };
}
