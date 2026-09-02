/**
 * Contexto pessoal do momento (coletado no onboarding).
 *
 * A iMAG continua sendo uma inteligência de direção PROFISSIONAL.
 * Estas informações existem apenas para calibrar esforço, linguagem e
 * complexidade das direções — nunca para criar metas pessoais.
 */

export const PERSONAL_MOMENT_OPTIONS = [
  "Rotina corrida",
  "Pouco tempo",
  "Muitas prioridades",
  "Fase de mudança",
  "Quero me reorganizar",
  "Nada específico",
] as const;

export const PERSONAL_BLOCKER_OPTIONS = [
  "Falta de clareza",
  "Falta de tempo",
  "Excesso de ideias",
  "Dificuldade de executar",
  "Cansaço",
  "Não sei por onde começar",
] as const;

/** Chaves usadas dentro de `magnetic_profile.mindset`. */
export const PERSONAL_MOMENT_KEY = "contexto_pessoal";
export const PERSONAL_BLOCKER_KEY = "dificuldade_atual";

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export type PersonalContext = { moment: string[]; blocker: string[] };

export function extractPersonalContext(
  mindset: Record<string, unknown> | null | undefined,
): PersonalContext {
  const m = mindset ?? {};
  return {
    moment: asList(m[PERSONAL_MOMENT_KEY]),
    blocker: asList(m[PERSONAL_BLOCKER_KEY]),
  };
}

const RULES: Array<{ match: RegExp; rule: string }> = [
  {
    match: /pouco tempo|falta de tempo|rotina corrida/i,
    rule: "Tempo escasso: a direção precisa caber em uma janela curta. Nada de projetos, sequências longas ou preparação extensa.",
  },
  {
    match: /cansa|exaust/i,
    rule: "Energia baixa: reduza a fricção. Uma ação simples, curta e concreta vale mais do que uma ambiciosa.",
  },
  {
    match: /excesso de ideias|muitas prioridades/i,
    rule: "Dispersão: entregue UMA ação única e elimine alternativas. Não ofereça opções nem listas.",
  },
  {
    match: /falta de clareza|não sei por onde começar|nao sei por onde/i,
    rule: "Falta de clareza: seja extremamente concreto — diga exatamente o que fazer, com quem, por qual canal.",
  },
  {
    match: /dificuldade de executar/i,
    rule: "Dificuldade de execução: quebre o esforço até o menor passo possível que ainda gere avanço real.",
  },
  {
    match: /fase de mudança|mudanca|reorganizar/i,
    rule: "Fase de transição/reorganização: baixe o nível de exigência, use linguagem serena e priorize retomada de base antes de expansão.",
  },
  {
    match: /menos de 1 hora|1 a 2 horas/i,
    rule: "Janela curta (até 2h): a ação precisa caber em poucos minutos de execução real.",
  },
  {
    match: /varia muito/i,
    rule: "Disponibilidade instável: proponha uma ação que funcione mesmo num dia ruim.",
  },
  {
    match: /tudo ao mesmo tempo|começo várias coisas|comeco varias coisas/i,
    rule: "Tendência a abrir frentes demais: entregue UMA ação e peça explicitamente para fechar antes de abrir outra.",
  },
  {
    match: /procrastin/i,
    rule: "Procrastinação: reduza o tamanho da ação ao ponto de ser mais fácil fazer do que adiar.",
  },
  {
    match: /só o que é urgente|so o que e urgente/i,
    rule: "Modo urgência: a direção deve proteger uma coisa importante e não urgente do dia.",
  },
  {
    match: /dificuldade de manter|consistência|consistencia/i,
    rule: "Dificuldade de constância: priorize repetição simples e diária em vez de novidade.",
  },
];


/** Bloco de prompt com o contexto pessoal + como ele deve calibrar a direção. */
export function buildPersonalContextBlock(
  mindset: Record<string, unknown> | null | undefined,
): string {
  const { moment, blocker } = extractPersonalContext(mindset);
  const m = mindset ?? {};
  const ritmo = asList(m["ritmo_da_rotina"]);
  const tempo = asList(m["tempo_disponivel"]);
  const sobrecarga = asList(m["comportamento_sob_sobrecarga"]);
  if (!moment.length && !blocker.length && !ritmo.length && !tempo.length && !sobrecarga.length)
    return "";
  const all = [...moment, ...blocker, ...ritmo, ...tempo, ...sobrecarga].join(" ");
  const applied = RULES.filter((r) => r.match.test(all)).map((r) => `- ${r.rule}`);

  const lines = [
    "",
    "CONTEXTO PESSOAL DO MOMENTO (use para calibrar a direção):",
  ];
  if (moment.length) lines.push(`- Rotina envolve: ${moment.join(", ")}`);
  if (ritmo.length) lines.push(`- Ritmo dos dias: ${ritmo.join(", ")}`);
  if (tempo.length) lines.push(`- Tempo livre por dia: ${tempo.join(", ")}`);
  if (blocker.length) lines.push(`- Áreas mais bagunçadas: ${blocker.join(", ")}`);
  if (sobrecarga.length) lines.push(`- Padrão sob sobrecarga: ${sobrecarga.join(", ")}`);
  if (applied.length) {
    lines.push("Calibragem obrigatória:");
    lines.push(...applied);
  }
  lines.push(
    "A melhor direção não é a mais ambiciosa, e sim a que mais merece atenção agora e cabe no tempo real disponível hoje.",
  );
  return lines.join("\n");
}


/** Princípio central injetado nos prompts da MAG. */
export const PERSONAL_CONTEXT_PRINCIPLE = `

────────────────────────────────
MOMENTO DE VIDA (princípio obrigatório)
────────────────────────────────
A iMAG considera o momento atual do usuário, sua disponibilidade, energia, limitações e contexto de vida. A melhor direção não é necessariamente a ação mais ambiciosa, mas aquela que mais merece atenção agora e que é realisticamente executável.

A direção pode ser de QUALQUER área escolhida pelo usuário no onboarding ou no Foco da Semana: trabalho, negócio, estudos, finanças, casa, rotina pessoal, saúde, alimentação, exercício, sono ou organização mental. Nunca recuse um tema por ser pessoal. Em áreas sensíveis, trabalhe organização, rotina, registro e hábitos — sem diagnóstico, prescrição, dieta, treino prescrito ou promessa de resultado, indicando um profissional habilitado quando for necessário.

Evite listas extensas de tarefas: uma prioridade clara, contextual e executável por vez.`;
