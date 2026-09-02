/**
 * Compreensão do foco antes de qualquer direção.
 *
 * Um foco amplo ("emagrecer", "ganhar dinheiro", "estudar") não permite
 * escolher uma ação relevante com segurança. Nesse caso a MAG faz UMA
 * pergunta essencial dentro do card do foco — nunca gera uma direção só
 * para preencher o card.
 *
 * Puro e determinístico: as perguntas variam conforme o texto do foco,
 * nunca são fixas para todos os usuários e não dependem de rede.
 */

export type FocusClarification = {
  question: string;
  options: string[];
};

type Topic = {
  key: string;
  match: RegExp;
  question: string;
  options: string[];
};

const TOPICS: Topic[] = [
  {
    key: "peso",
    match: /emagrec|perder peso|secar|gordura|dieta|balan[çc]a/i,
    question: "Para direcionar você melhor, o que mais dificulta esse objetivo hoje?",
    options: [
      "Alimentação",
      "Falta de rotina",
      "Atividade física",
      "Sono",
      "Ansiedade ou comportamento alimentar",
      "Condição de saúde",
    ],
  },
  {
    key: "saude",
    match: /sa[úu]de|bem-estar|energia|cansa[çc]o|ansiedade|estresse|dormir|sono/i,
    question: "Antes de te direcionar: o que está mais fora do lugar agora?",
    options: ["Sono", "Alimentação", "Movimento no dia", "Estresse ou ansiedade", "Acompanhamento com profissional"],
  },
  {
    key: "dinheiro",
    match: /dinheiro|renda|faturar|financ|d[íi]vida|grana|lucro|ganhar mais/i,
    question: "Para escolher o melhor caminho: o que está mais travado hoje?",
    options: [
      "Entram poucos clientes",
      "Vendo, mas sobra pouco",
      "Não sei para onde vai o dinheiro",
      "Contas atrasadas",
      "Preço ou proposta",
    ],
  },
  {
    key: "clientes",
    match: /cliente|paciente|lead|venda|vender|agenda cheia|contrat/i,
    question: "Para te direcionar bem: em que ponto as pessoas costumam parar?",
    options: [
      "Poucas pessoas chegam",
      "Chegam e não respondem",
      "Perguntam preço e somem",
      "Fecham uma vez e não voltam",
      "Não sei dizer",
    ],
  },
  {
    key: "estudos",
    match: /estud|prova|concurso|faculdade|curso|aprender|ingl[êe]s/i,
    question: "Para montar seu próximo passo: o que mais atrapalha seus estudos hoje?",
    options: ["Falta de tempo", "Não sei por onde começar", "Falta constância", "Conteúdo difícil", "Prazo apertado"],
  },
  {
    key: "rotina",
    match: /rotina|organiz|produtiv|tempo|bagun[çc]a|atras/i,
    question: "Para organizar com você: onde o dia costuma sair do controle?",
    options: ["Começo da manhã", "Meio do dia", "Fim do dia", "Compromissos demais", "Tarefas que não terminam"],
  },
  {
    key: "trabalho",
    match: /trabalho|carreira|emprego|projeto|empresa|equipe|neg[óo]cio/i,
    question: "Para escolher o passo certo: qual é o ponto mais travado no trabalho agora?",
    options: ["Prioridade indefinida", "Entrega parada", "Depende de outra pessoa", "Excesso de demandas", "Falta de clareza do objetivo"],
  },
  {
    key: "vida",
    match: /vida|melhorar|mudar|evoluir|come[çc]ar|feliz/i,
    question: "Para te direcionar de verdade: o que você quer que mude primeiro?",
    options: ["Trabalho", "Dinheiro", "Saúde", "Rotina", "Relações", "Estudos"],
  },
];

const GENERIC_QUESTION = "Para direcionar você melhor, o que mais dificulta esse objetivo hoje?";
const GENERIC_OPTIONS = ["Falta de tempo", "Não sei por onde começar", "Falta constância", "Depende de outra pessoa"];

/** Marcadores de foco específico: alvo, quantidade, prazo ou entrega nomeada. */
function isSpecific(text: string): boolean {
  const t = text.trim();
  if (/\d/.test(t)) return true;
  if (/\b(at[ée]|antes de|nesta semana|amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\b/i.test(t))
    return true;
  const words = t.split(/\s+/).filter((w) => w.length > 2);
  return words.length >= 6;
}

/**
 * Devolve a pergunta essencial quando o foco ainda é amplo demais.
 * Retorna `null` quando já é possível direcionar com segurança.
 */
export function clarificationFor(rawFocus: string): FocusClarification | null {
  const text = (rawFocus ?? "").trim();
  if (!text) return null;
  if (isSpecific(text)) return null;

  const topic = TOPICS.find((t) => t.match.test(text));
  const base = topic
    ? { question: topic.question, options: topic.options }
    : { question: GENERIC_QUESTION, options: GENERIC_OPTIONS };

  return {
    question: base.question,
    options: [...base.options, "Ainda não sei", "Explicar para a MAG"],
  };
}
