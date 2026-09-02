/**
 * Intenções de entrada do chat da MAG.
 * A MAG percebe a intenção antes de propor qualquer ação: organizar,
 * decidir, desabafar, conversar ou clarear.
 */

export type ChatIntent = {
  id: string;
  label: string;
  /** primeira fala da MAG ao escolher a intenção */
  reply: string;
  /** sugestões curtas mostradas depois da fala */
  suggestions: string[];
};

export const CHAT_INTENTS: ChatIntent[] = [
  {
    id: "pessoal",
    label: "Vida pessoal",
    reply: "Claro. O que está precisando de mais atenção na sua vida pessoal agora?",
    suggestions: [
      "Organizar alguma coisa",
      "Tomar uma decisão",
      "Resolver um problema",
      "Desabafar",
      "Clarear a cabeça",
    ],
  },
  {
    id: "profissional",
    label: "Vida profissional",
    reply: "Entendi. Onde você sente que mais precisa de direção no trabalho hoje?",
    suggestions: [
      "Organizar tarefas",
      "Definir prioridades",
      "Resolver um problema",
      "Planejar próximos passos",
      "Pensar na minha carreira",
      "Só conversar sobre isso",
    ],
  },
  {
    id: "rotina",
    label: "Rotina e organização",
    reply:
      "Me conta como seu dia está agora. Eu te ajudo a colocar ordem no que está disputando sua atenção.",
    suggestions: [
      "Organizar meu dia",
      "Ver minhas prioridades",
      "Planejar a semana",
      "Estou sobrecarregado",
      "Não sei por onde começar",
    ],
  },
  {
    id: "estudos",
    label: "Estudos",
    reply: "Certo. O que você precisa organizar ou destravar nos seus estudos agora?",
    suggestions: [
      "Organizar meu tempo de estudo",
      "Definir o que estudar",
      "Estou sem foco",
      "Preparar uma prova",
    ],
  },
  {
    id: "prioridades",
    label: "Prioridades",
    reply: "Vamos olhar juntos. O que está disputando sua atenção hoje?",
    suggestions: [
      "Tenho muita coisa para fazer",
      "Não sei o que vem primeiro",
      "Quero reduzir minha lista",
    ],
  },
  {
    id: "decisao",
    label: "Quero tomar uma decisão",
    reply:
      "Me explica a situação. Podemos olhar juntos para o que pesa em cada caminho antes de decidir.",
    suggestions: ["Tenho duas opções", "Preciso responder alguém", "Estou em dúvida há dias"],
  },
  {
    id: "desabafo",
    label: "Quero desabafar",
    reply: "Pode me contar. O que está pesando mais agora?",
    suggestions: [],
  },
  {
    id: "conversar",
    label: "Só quero conversar",
    reply: "Claro. Sobre o que você quer conversar?",
    suggestions: [],
  },
  {
    id: "perdido",
    label: "Não sei por onde começar",
    reply:
      "Sem problema. Me diz só uma coisa: o que está ocupando mais espaço na sua cabeça agora?",
    suggestions: [
      "Tenho muita coisa para fazer",
      "Estou sem foco",
      "Preciso tomar uma decisão",
      "Estou preocupado com alguma coisa",
      "Minha cabeça está cheia",
      "Não sei explicar ainda",
    ],
  },
];

export const THINKING_LINES = [
  "Estou pensando nisso com você…",
  "Só um instante. Quero entender isso direito.",
  "Deixa eu olhar isso com calma…",
];
