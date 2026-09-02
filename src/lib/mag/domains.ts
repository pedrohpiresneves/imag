/**
 * Camada de orquestração multidisciplinar da MAG.
 *
 * A MAG não escolhe "um especialista": ela identifica automaticamente o domínio
 * principal e os domínios complementares de qualquer objetivo, decide o que
 * ainda falta saber e reconhece quando o assunto exige um profissional humano.
 *
 * Este módulo é puro (sem IO) e é usado tanto no prompt quanto na validação
 * local da direção gerada.
 */

import { normalizeText } from "./text";

export type RiskLevel = "none" | "care" | "professional" | "urgent";

export type SafetyRead = {
  level: RiskLevel;
  areas: string[];
  /** Frase curta e acolhedora para o usuário, quando houver limite a comunicar. */
  note: string | null;
};

type SensitiveRule = {
  area: string;
  level: RiskLevel;
  any: string[];
  note: string;
};

/** Sinais que exigem cuidado, limite explícito ou encaminhamento humano. */
const SENSITIVE_RULES: SensitiveRule[] = [
  {
    area: "risco_imediato",
    level: "urgent",
    any: [
      "me matar", "suicid", "tirar minha vida", "me machucar", "autoagress", "automutil",
      "nao quero mais viver", "sumir de vez", "ele me bateu", "me agrediu", "violencia domestica",
      "estou sendo ameacad", "abuso",
    ],
    note:
      "Isso é sério e você não precisa lidar com isso sozinha. Procure agora apoio imediato: CVV 188 (24h) ou emergência 190/192. Enquanto isso, posso ficar com você organizando o que for possível.",
  },
  {
    area: "saude_clinica",
    level: "professional",
    any: [
      "medicament", "remedio", "dosagem", "dose", "insulina", "pressao alta", "diabet",
      "tireoide", "hormon", "exame de sangue", "sintoma", "dor no peito", "gravid",
      "cirurgia", "tratamento medico", "diagnostic",
    ],
    note:
      "Para direcionar isso com segurança, essa parte precisa de avaliação de um profissional habilitado. Posso te ajudar a organizar as informações e as perguntas para a consulta.",
  },
  {
    area: "saude_mental",
    level: "professional",
    any: ["depress", "ansiedade severa", "panico", "burnout", "terapia", "psiquiatr", "transtorno"],
    note:
      "Esse tema merece acompanhamento de um profissional de saúde mental. Enquanto isso, posso te ajudar a organizar rotina, registros e o que levar para a consulta.",
  },
  {
    area: "alimentacao",
    level: "care",
    any: ["dieta", "emagrec", "calorias", "jejum", "compulsao", "nutric", "perder peso", "ganhar massa"],
    note:
      "Posso te ajudar a entender seu padrão e criar constância, mas plano alimentar e metas de peso precisam de um profissional habilitado.",
  },
  {
    area: "exercicio",
    level: "care",
    any: ["treino", "academia", "musculacao", "corrida", "exercicio", "personal"],
    note:
      "Vamos respeitar seu nível atual e qualquer limitação. Carga e programação de treino são assunto para um profissional de educação física.",
  },
  {
    area: "juridico",
    level: "professional",
    any: ["processo", "advogad", "contrato", "justica", "acao judicial", "divorcio", "heranca", "trabalhista"],
    note:
      "Informação geral eu posso organizar, mas a decisão jurídica precisa de um advogado. Posso te ajudar a preparar o que levar.",
  },
  {
    area: "financeiro_critico",
    level: "care",
    any: ["divida", "negativad", "emprestimo", "juros", "imposto", "contador", "financiamento", "investir"],
    note:
      "Posso organizar seus números e prioridades. Decisões de investimento, tributos e crédito merecem confirmação de um profissional.",
  },
];

/** Lê o objetivo/direção e devolve o nível de cuidado necessário. */
export function readSafety(text: string): SafetyRead {
  const n = normalizeText(text);
  const hits = SENSITIVE_RULES.filter((r) => r.any.some((frag) => n.includes(frag)));
  if (hits.length === 0) return { level: "none", areas: [], note: null };
  const order: RiskLevel[] = ["none", "care", "professional", "urgent"];
  const top = hits.reduce((a, b) => (order.indexOf(b.level) > order.indexOf(a.level) ? b : a));
  return { level: top.level, areas: hits.map((h) => h.area), note: top.note };
}

/** Frases que a MAG nunca pode dizer sobre si mesma. */
const FALSE_CREDENTIALS = [
  "sou medic", "sou nutricionista", "sou endocrinologista", "sou psicolog", "sou psiquiatra",
  "sou advogad", "sou contador", "sou personal", "sou especialista habilitad", "como sua medica",
  "como sua nutricionista", "como sua psicologa", "como seu advogado", "prescrevo", "receito",
  "seu diagnostico e", "voce tem depressao", "voce esta com",
];

/** Remove qualquer afirmação de credencial profissional inexistente. */
export function claimsProfessionalCredential(text: string): boolean {
  const n = normalizeText(text);
  return FALSE_CREDENTIALS.some((f) => n.includes(f));
}

/**
 * Bloco de princípio anexado ao prompt do motor.
 * Curto de propósito: a inteligência deve aparecer na decisão, não no texto.
 */
export const ORCHESTRATION_PRINCIPLE = `

13. ORQUESTRADORA MULTIDISCIPLINAR (camada de inteligência).
Antes de propor qualquer ação, identifique internamente: domínio principal do objetivo, domínios complementares que se cruzam, o que você já sabe sobre esta pessoa, qual informação crítica ainda falta, qual risco existe, como o avanço será medido.
Combine conhecimentos dinamicamente — nenhuma lista fechada de categorias. Exemplos de cruzamento: "emagrecer" envolve alimentação, rotina, sono, comportamento e limitações clínicas; "mais clientes" envolve oferta, comunicação, relacionamento e rotina comercial; "estudar para uma prova" envolve planejamento, revisão espaçada, prazo e descanso; "melhorar um relacionamento" envolve comunicação, escuta e limites. O usuário NUNCA escolhe qual especialista quer: você detecta pelo contexto.

14. INFORMAÇÃO FALTANTE ANTES DE PRESCREVER.
Se falta uma informação que muda materialmente a próxima direção (ponto de partida, rotina, principal dificuldade), NÃO prescreva uma mudança: a direção de hoje vira uma atividade curta de entendimento feita DENTRO da iMAG (registro, escolha, escala ou lista com campos prontos). Uma única pergunta estratégica por vez. Nunca repita algo que o usuário já respondeu, e nunca transforme a definição do foco em formulário.

15. LIMITES E SEGURANÇA.
Você combina conhecimentos, mas NUNCA se apresenta como profissional habilitada ("sou médica", "sou nutricionista", "sou psicóloga", "sou advogada"), não dá diagnóstico, não prescreve medicação, dose ou dieta restritiva, e não promete resultado. Em saúde, saúde mental, alimentação, exercício, finanças críticas, direito ou situações de risco: ofereça informação geral, calibre o esforço à limitação real e diga com clareza quando algo precisa de avaliação profissional — sem abandonar o usuário, ajudando a organizar informações, registros e perguntas para a consulta. Não transforme toda direção em aviso genérico.

16. QUALIDADE ACIMA DE VOLUME.
Quanto mais inteligente a decisão, mais simples o texto. Uma ação pequena, clara, com começo, meio e fim, proporcional ao tempo real do dia, com critério de conclusão verificável e um próximo passo possível. Nunca tente resolver o objetivo inteiro em um dia.`;
