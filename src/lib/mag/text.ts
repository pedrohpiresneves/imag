/** Helpers puros usados pelo motor de direção da MAG. */

const STOPWORDS = new Set([
  "a","o","as","os","um","uma","de","do","da","dos","das","em","no","na","nos","nas",
  "para","por","com","sem","que","e","ou","se","ao","aos","à","às","seu","sua","seus",
  "suas","este","esta","esse","essa","isso","hoje","mais","menos","um","dois","tres",
  "três","você","voce","the","of",
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Similaridade semântica aproximada (Jaccard sobre radicais). 0..1 */
export function similarity(a: string, b: string): number {
  const stem = (t: string) => t.slice(0, 6);
  const A = new Set(tokens(a).map(stem));
  const B = new Set(tokens(b).map(stem));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/**
 * Chave de estratégia: agrupa direções essencialmente iguais
 * ("chame clientes antigos" ≈ "retome contato com antigos clientes").
 */
const STRATEGY_RULES: Array<{ key: string; any: string[] }> = [
  { key: "reativacao_contatos", any: ["reativ", "retom", "antig", "inativ", "sumiu", "parou"] },
  { key: "follow_up", any: ["follow", "retorn", "respond", "conversa", "acompanh"] },
  { key: "oferta_agendamento", any: ["agend", "horari", "marcar", "vaga", "consulta"] },
  { key: "conteudo", any: ["post", "conteud", "story", "stories", "reels", "video", "publica"] },
  { key: "indicacao", any: ["indica", "recomend", "boca a boca"] },
  { key: "precificacao", any: ["preco", "valor", "ticket", "orcament", "tabela"] },
  { key: "posicionamento", any: ["posicion", "bio", "perfil", "autorid", "portfoli"] },
  { key: "operacao", any: ["organiz", "process", "rotina", "planilha", "sistema"] },
  { key: "prospeccao", any: ["prospec", "novos", "captar", "lead", "parceria"] },
  { key: "pos_venda", any: ["pos venda", "pos-venda", "feedback", "satisfa", "avalia"] },
];

export function strategyKey(text: string): string {
  const n = normalizeText(text);
  for (const rule of STRATEGY_RULES) {
    if (rule.any.some((frag) => n.includes(frag))) return rule.key;
  }
  return "outro";
}

const GENERIC_PATTERNS = [
  /^faca um post/,
  /^organize sua agenda/,
  /^entre em contato com clientes/,
  /^melhore seu posicionamento/,
  /^produza conteudo/,
  /^faca networking/,
  /^revise suas metas/,
  /^seja produtivo/,
];

/** Frases vagas proibidas como direção principal (em qualquer posição). */
const VAGUE_PHRASES = [
  "maior alavancagem",
  "alto impacto",
  "maior impacto",
  "o que importa",
  "o que realmente importa",
  "escolha uma acao",
  "escolha a acao",
  "defina o que",
  "priorize o essencial",
  "aja com consistencia",
  "seja consistente",
  "avance em algo",
  "algo importante",
  "faca o que pode gerar",
  "de um passo",
  "sem esperar condicoes ideais",
  "foque no que",
  "reflita sobre",
  "pense em",
  "planeje seu dia",
];

/** Verbos de ação que abrem uma direção executável. */
const ACTION_VERBS = [
  "envie","envia","mande","publique","poste","grave","ligue","responda","retome",
  "reative","agende","confirme","ofereca","convide","revise","atualize","escreva",
  "monte","cadastre","compartilhe","apresente","proponha","cobre","reenvie","chame",
  "selecione","liste","abra","feche","negocie","entregue","fotografe","peca",
];

/** Canais/contextos concretos que tornam a ação inequívoca. */
const CONCRETE_MARKERS = [
  "whatsapp","story","stories","instagram","direct","reels","post","telefone","ligacao",
  "email","e mail","mensagem","audio","consulta","atendimento","orcamento","proposta",
  "agenda","agendamento","lead","cliente","paciente","aluno","seguidor","contato","pedido",
];

/** Rejeita direções que poderiam ser entregues a 1.000 usuários. */
export function isGeneric(title: string, description: string): boolean {
  const t = normalizeText(title);
  const d = normalizeText(description);
  const full = `${t} ${d}`;

  if (GENERIC_PATTERNS.some((re) => re.test(t))) return true;
  if (VAGUE_PHRASES.some((p) => full.includes(p))) return true;

  // O título precisa começar com verbo de ação imperativo.
  const firstWord = t.split(" ")[0] ?? "";
  if (!ACTION_VERBS.includes(firstWord)) return true;

  // Precisa de quantidade OU alvo/canal concreto — de preferência os dois.
  const hasNumber = /\d/.test(full) || /\b(um|uma|dois|duas|tres|cinco)\b/.test(full);
  const hasMarker = CONCRETE_MARKERS.some((m) => full.includes(m));
  if (!hasNumber && !hasMarker) return true;

  // Escopo mínimo para não virar frase solta.
  if (d.split(" ").length < 8) return true;

  return false;
}