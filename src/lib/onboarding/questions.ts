/**
 * Onboarding geral e inteligente do iMAG.
 * Uma pergunta por tela, linguagem humana, chips de resposta rápida.
 * As respostas alimentam o `magnetic_profile` e calibram as direções da MAG.
 */

export type OnboardingQuestion = {
  id: string;
  /** dimensão do magnetic_profile onde a resposta é salva */
  dimension: "mindset" | "objectives";
  /** chave dentro da dimensão */
  key: string;
  question: string;
  hint?: string;
  options: string[];
  multi?: boolean;
  /** limite de seleções quando multi */
  max?: number;
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "rotina",
    dimension: "mindset",
    key: "contexto_pessoal",
    question: "Hoje, sua rotina envolve mais o quê?",
    hint: "Pode escolher mais de uma.",
    multi: true,
    options: [
      "Trabalho",
      "Negócio próprio",
      "Estudos",
      "Casa e família",
      "Projetos pessoais",
      "Um pouco de tudo",
    ],
  },
  {
    id: "ritmo",
    dimension: "mindset",
    key: "ritmo_da_rotina",
    question: "Como seus dias costumam ser?",
    options: [
      "Bem previsíveis",
      "Corridos",
      "Cada dia é diferente",
      "Tenho muita coisa para fazer",
      "Tenho tempo, mas me falta direção",
      "Parece que tudo é prioridade",
    ],
  },
  {
    id: "tempo",
    dimension: "mindset",
    key: "tempo_disponivel",
    question: "Quanto tempo livre você costuma ter para cuidar do que é importante?",
    options: [
      "Menos de 1 hora",
      "1 a 2 horas",
      "2 a 4 horas",
      "Mais de 4 horas",
      "Varia muito de um dia para outro",
    ],
  },
  {
    id: "bagunca",
    dimension: "mindset",
    key: "dificuldade_atual",
    question: "Onde você sente que as coisas estão mais bagunçadas hoje?",
    hint: "Pode escolher mais de uma.",
    multi: true,
    options: [
      "Trabalho",
      "Estudos",
      "Rotina pessoal",
      "Projetos",
      "Saúde e autocuidado",
      "Finanças",
      "Casa",
      "Relacionamentos",
      "Ideias e planos",
      "Um pouco de tudo",
    ],
  },
  {
    id: "necessidade",
    dimension: "objectives",
    key: "necessidade_principal",
    question: "O que você mais gostaria que a MAG fizesse por você?",
    hint: "Até 3 opções.",
    multi: true,
    max: 3,
    options: [
      "Me ajudar a escolher prioridades",
      "Organizar meu dia",
      "Me dizer qual é o próximo passo",
      "Me ajudar a executar",
      "Transformar ideias em planos",
      "Me ajudar a manter consistência",
      "Me ajudar a tomar decisões",
    ],
  },
  {
    id: "area",
    dimension: "objectives",
    key: "area_de_direcao",
    question: "Hoje, você busca mais direção em qual área?",
    options: ["Vida profissional", "Vida pessoal", "As duas"],
  },
  {
    id: "sobrecarga",
    dimension: "mindset",
    key: "comportamento_sob_sobrecarga",
    question: "Quando seu dia fica cheio, o que geralmente acontece?",
    options: [
      "Tento fazer tudo ao mesmo tempo",
      "Não sei por onde começar",
      "Acabo procrastinando",
      "Faço só o que é urgente",
      "Começo várias coisas e termino poucas",
      "Consigo organizar, mas tenho dificuldade de manter",
    ],
  },
  {
    id: "resultado",
    dimension: "objectives",
    key: "resultado_desejado",
    question: "O que faria você sentir que o iMAG está funcionando para você?",
    options: [
      "Terminar o dia com menos coisas na cabeça",
      "Cumprir minhas prioridades",
      "Avançar nos meus objetivos",
      "Ter mais equilíbrio",
      "Ser mais consistente",
      "Saber sempre qual é o próximo passo",
    ],
  },
];

export type OnboardingAnswers = Record<string, string[]>;

/** Insights curtos mostrados na tela de análise da MAG. */
export function buildInsights(
  answers: OnboardingAnswers,
): Array<{ label: string; value: string }> {
  const first = (id: string) => answers[id]?.[0] ?? "";
  const list = (id: string) => answers[id] ?? [];

  const rotina = (() => {
    const ritmo = first("ritmo");
    if (/previs/i.test(ritmo)) return "Estável";
    if (/corridos|muita coisa/i.test(ritmo)) return "Intensa";
    if (/diferente/i.test(ritmo)) return "Dinâmica";
    if (/falta direção/i.test(ritmo)) return "Com espaço, sem foco";
    if (/prioridade/i.test(ritmo)) return "Sobrecarregada";
    return list("rotina").slice(0, 2).join(" + ") || "Em construção";
  })();

  const ruido = (() => {
    const s = first("sobrecarga");
    if (/tudo ao mesmo tempo/i.test(s)) return "Excesso de frentes abertas";
    if (/por onde começar/i.test(s)) return "Falta de clareza no começo";
    if (/procrastin/i.test(s)) return "Adiamento sob pressão";
    if (/urgente/i.test(s)) return "Urgência dominando o dia";
    if (/termino poucas/i.test(s)) return "Muitos inícios, poucas conclusões";
    if (/manter/i.test(s)) return "Dificuldade de manter o ritmo";
    return list("bagunca").slice(0, 2).join(" e ") || "Excesso de prioridades";
  })();

  const foco = (() => {
    const a = first("area");
    if (/as duas/i.test(a)) return "Pessoal + profissional";
    return a || "Pessoal + profissional";
  })();

  const precisa = list("necessidade")[0] ?? "Clareza sobre o próximo passo";

  return [
    { label: "Sua rotina", value: rotina },
    { label: "Seu maior ruído", value: ruido },
    { label: "Seu foco atual", value: foco },
    { label: "O que você mais precisa agora", value: precisa },
  ];
}
