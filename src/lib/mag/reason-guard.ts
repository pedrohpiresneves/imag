/**
 * Guarda de coerência da justificativa ("Por que a MAG sugeriu isso?").
 *
 * Objetivo: garantir que cada frase da justificativa tenha relação semântica
 * direta com a direção atual e com o contexto real do usuário. Termos de
 * domínio (lead, orçamento, story, paciente...) só podem aparecer se estiverem
 * presentes na direção atual ou no contexto carregado — caso contrário a frase
 * é descartada, pois é resíduo de outra direção/categoria.
 */

/** Termos de domínio que não podem ser inventados pela MAG. */
const DOMAIN_TERMS = [
  "lead",
  "leads",
  "prospect",
  "prospects",
  "prospecção",
  "orçamento",
  "orçamentos",
  "paciente",
  "pacientes",
  "cliente",
  "clientes",
  "aluno",
  "alunos",
  "story",
  "stories",
  "reels",
  "post",
  "posts",
  "instagram",
  "whatsapp",
  "direct",
  "campanha",
  "campanhas",
  "venda",
  "vendas",
  "funil",
  "agenda",
  "consulta",
  "consultas",
  "proposta",
  "propostas",
  "indicação",
  "indicações",
  "equipe",
  "reunião",
  "reuniões",
  "site",
  "anúncio",
  "anúncios",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Remove frases que introduzem termos de domínio ausentes do contexto real.
 * Retorna a justificativa filtrada, ou null se nada sobrar.
 */
export function sanitizeStrategicReason(
  reason: string | null | undefined,
  context: { direction: string; contextText: string },
): string | null {
  const raw = (reason ?? "").trim();
  if (!raw) return null;

  const corpus = normalize(`${context.direction} ${context.contextText}`);
  const kept: string[] = [];

  for (const sentence of splitSentences(raw)) {
    const norm = normalize(sentence);
    const invented = DOMAIN_TERMS.filter((term) => {
      const t = normalize(term);
      const re = new RegExp(`\\b${t}\\b`);
      return re.test(norm) && !re.test(corpus);
    });
    if (invented.length > 0) continue;
    kept.push(sentence);
  }

  const out = kept.join(" ").trim();
  return out.length >= 20 ? out : null;
}

/** Justificativa mínima, sempre coerente, quando a gerada não passa na validação. */
export function fallbackStrategicReason(input: {
  name?: string | null;
  goal?: string | null;
  minutes?: number | null;
}): string {
  const who = input.name?.split(" ")[0] ?? "Você";
  const goal = input.goal?.trim();
  const time = input.minutes && input.minutes > 0 ? ` em cerca de ${input.minutes} minutos` : "";
  return goal
    ? `O foco de ${who} agora é ${goal.toLowerCase()}. Esta ação é um passo simples e possível${time}, que avança nesse objetivo sem transformar o dia em uma tarefa cansativa.`
    : `Esta ação é um passo simples e possível${time}, alinhado ao momento atual de ${who}, sem transformar o dia em uma tarefa cansativa.`;
}
