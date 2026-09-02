/**
 * Alinhamento entre a Direção do Dia e o Foco da Semana (0 a 100).
 *
 * Não basta o título do foco aparecer no texto: a avaliação combina
 * domínio (saúde, finanças, trabalho, estudos, relações, rotina),
 * sobreposição de conceitos e ausência de contexto estranho ao foco.
 */

export const MIN_ALIGNMENT = 45;

type Domain =
  | "saude"
  | "financas"
  | "trabalho"
  | "estudos"
  | "relacoes"
  | "rotina"
  | "outro";

const DOMAIN_PATTERNS: { domain: Domain; match: RegExp }[] = [
  {
    domain: "saude",
    match:
      /emagrec|peso|dieta|aliment|treino|academia|corr(?:er|ida)|sono|dormir|ansiedade|sa[úu]de|m[ée]dic|nutri|hidrat|caminhad|exerc[íi]cio/i,
  },
  {
    domain: "financas",
    match:
      /financ|dinheiro|gasto|despesa|d[íi]vida|conta|or[çc]amento|econom|poupan[çc]a|receita|fatura|boleto|investi|renda/i,
  },
  {
    domain: "trabalho",
    match:
      /cliente|lead|venda|vender|proposta|reuni[ãa]o|projeto|entrega|apresenta[çc]|empresa|equipe|trabalho|carreira|neg[óo]cio|contrat|whatsapp comercial/i,
  },
  { domain: "estudos", match: /estud|prova|concurso|aula|curso|faculdade|ler|leitura|resum|ingl[êe]s|apostila/i },
  { domain: "relacoes", match: /fam[íi]lia|filho|esposa|marido|amigo|relacionamento|parceir|conversa com/i },
  { domain: "rotina", match: /rotina|organiz|agenda|planej|tarefa|arrumar|limpar|casa|hor[áa]rio|produtiv/i },
];

export function domainOf(text: string): Domain {
  const t = (text ?? "").toLowerCase();
  for (const d of DOMAIN_PATTERNS) if (d.match.test(t)) return d.domain;
  return "outro";
}

const STOP = new Set([
  "que","para","pra","com","uma","dos","das","por","mais","seu","sua","meu","minha","hoje","dia",
  "esta","essa","este","esse","como","você","voce","não","nao","sobre","fazer","vamos","ainda","the",
]);

function tokens(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => w.slice(0, 6)),
  );
}

export type AlignmentInput = {
  focusText: string;
  /** Resposta do usuário à pergunta essencial, quando houver. */
  focusContext?: string | null;
  title: string;
  description: string;
  reason?: string | null;
};

export type AlignmentResult = { score: number; ok: boolean; why: string };

/**
 * Avaliação funcional: mesma área de vida, conceitos em comum e nenhuma
 * área estranha dominando a direção.
 */
export function scoreAlignment(input: AlignmentInput): AlignmentResult {
  const focusFull = `${input.focusText ?? ""} ${input.focusContext ?? ""}`.trim();
  if (!focusFull) return { score: 0, ok: false, why: "sem foco ativo" };

  const dirFull = `${input.title} ${input.description} ${input.reason ?? ""}`;

  const focusDomain = domainOf(focusFull);
  const dirDomain = domainOf(dirFull);

  let score = 0;
  let why = "";

  if (focusDomain !== "outro" && dirDomain === focusDomain) {
    score += 55;
    why = "mesma área do foco";
  } else if (focusDomain === "outro" || dirDomain === "outro") {
    score += 25;
    why = "área não identificada com clareza";
  } else {
    // Áreas diferentes: só passa se houver forte sobreposição de conceitos.
    score += 5;
    why = `direção em ${dirDomain}, foco em ${focusDomain}`;
  }

  const f = tokens(focusFull);
  const d = tokens(dirFull);
  let shared = 0;
  for (const t of f) if (d.has(t)) shared += 1;
  const overlap = f.size ? shared / f.size : 0;
  score += Math.round(Math.min(overlap, 0.6) * 75);

  if (shared > 0 && why === "") why = "conceitos em comum com o foco";

  score = Math.max(0, Math.min(100, score));
  return { score, ok: score >= MIN_ALIGNMENT, why };
}
