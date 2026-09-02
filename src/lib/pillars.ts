import { MODULES, type Module } from "./modules";

export type Pillar = {
  slug: string;
  number: number;
  name: string;
  tagline: string;
  description: string;
  playbookSlugs: string[];
  actionOfWeek: string;
  mentorPrompt: string;
};

export const PILLARS: Pillar[] = [
  {
    slug: "fundacao",
    number: 1,
    name: "Fundação",
    tagline: "A base do sistema.",
    description:
      "Os três pilares invisíveis do magnetismo: percepção de valor, consistência e clareza de posicionamento.",
    playbookSlugs: ["principios-do-magnetismo"],
    actionOfWeek: "Escreva em uma frase quem é seu cliente ideal e cole no espelho.",
    mentorPrompt: "Meu posicionamento está confuso. Como redefinir minha fundação esta semana?",
  },
  {
    slug: "posicionamento",
    number: 2,
    name: "Posicionamento",
    tagline: "De carência para abundância.",
    description:
      "A virada mental que separa profissionais que perseguem clientes dos que são procurados.",
    playbookSlugs: ["mentalidade-magnetica"],
    actionOfWeek: "Liste 5 clientes que você NÃO quer atender mais. Escreva por quê.",
    mentorPrompt: "Como comunicar meu posicionamento sem parecer arrogante?",
  },
  {
    slug: "autoridade",
    number: 3,
    name: "Autoridade Silenciosa",
    tagline: "A linguagem invisível do valor.",
    description:
      "Comportamentos que constroem autoridade em silêncio — sem hiperexposição.",
    playbookSlugs: ["comportamento-magnetico"],
    actionOfWeek: "Elimine 3 respostas rápidas no WhatsApp que comunicam pressa por qualquer cliente.",
    mentorPrompt: "Como construir autoridade sem postar todo dia?",
  },
  {
    slug: "magnetismo",
    number: 4,
    name: "Magnetismo",
    tagline: "Comunicação que atrai sem implorar.",
    description:
      "Linguagem de resultado, presença digital curada e conteúdo que faz o cliente vir sozinho.",
    playbookSlugs: ["comunicacao-magnetica", "autoridade-silenciosa"],
    actionOfWeek: "Reescreva sua bio do Instagram usando linguagem de resultado.",
    mentorPrompt: "Que conteúdo eu deveria postar essa semana para atrair mais clientes do meu nicho?",
  },
  {
    slug: "conversao",
    number: 5,
    name: "Conversão",
    tagline: "Quando vender deixa de parecer venda.",
    description:
      "A sequência magnética: dor, transformação, credibilidade, convite. Sem pressão. Sem manipulação.",
    playbookSlugs: ["sistema-de-atracao", "conversao-sem-esforco"],
    actionOfWeek: "Reescreva sua próxima resposta de orçamento no formato dor → transformação → convite.",
    mentorPrompt: "Minha agenda está vazia esta semana. O que faço hoje?",
  },
  {
    slug: "fidelizacao",
    number: 6,
    name: "Retenção",
    tagline: "Clientes que voltam e indicam.",
    description:
      "Rituais de pós-atendimento que transformam clientes em promotores naturais do seu trabalho.",
    playbookSlugs: ["retencao-e-indicacao"],
    actionOfWeek: "Envie uma mensagem personalizada aos seus 3 melhores clientes desta semana.",
    mentorPrompt: "Como pedir indicação sem parecer forçado?",
  },
  {
    slug: "escala",
    number: 7,
    name: "Escala",
    tagline: "A agenda dos clientes certos.",
    description:
      "Não é sobre lotar. É sobre atender com intenção. A Agenda Magnética como resultado final.",
    playbookSlugs: ["a-agenda-magnetica"],
    actionOfWeek: "Defina seu limite semanal de atendimentos ideais. Documente.",
    mentorPrompt: "Como aumentar meu ticket sem perder clientes atuais?",
  },
];

export function getPillar(slug: string) {
  return PILLARS.find((p) => p.slug === slug);
}

export function playbooksFor(pillar: Pillar): Module[] {
  return pillar.playbookSlugs
    .map((s) => MODULES.find((m) => m.slug === s))
    .filter((m): m is Module => Boolean(m));
}

export function pillarOfPlaybook(playbookSlug: string): Pillar | undefined {
  return PILLARS.find((p) => p.playbookSlugs.includes(playbookSlug));
}