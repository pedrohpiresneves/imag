import type { Reflection } from "@/lib/reflections.functions";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export type Signal = {
  key: string;
  label: string;
  detail: string;
  weight: number; // 0-100 percent of the indicator
  progress: number; // 0-100 how much of that weight is filled
  current?: number;
  target?: number;
};

export type Indicator = {
  key: "focus" | "consistency" | "authority" | "magnetism";
  label: string;
  value: number | null; // null = insufficient data
  state: "collecting" | "waking" | "developing" | "ready";
  stateLabel: string;
  headline: string; // "Como a MAG chegou nesse resultado?"
  nextSteps: string[]; // "Como fortalecer sua {label}"
  signals: Signal[];
  updatedAt: string | null; // ISO of most recent contributing event
};

export type ScoreBundle = {
  focus: Indicator;
  consistency: Indicator;
  authority: Indicator;
  magnetism: Indicator;
  total: number | null;
  updatedAt: string | null;
};

export type ScoreInput = {
  reflections: Reflection[];
  profileCompleteness: number | null; // 0-100 or null
  hasClearGoal: boolean;
  /** Direções compartilhadas que foram executadas (recebidas + enviadas). */
  sharedExecuted?: number;
  /** Data de referência para janelas móveis (default: hoje). Usado no resumo semanal. */
  asOf?: Date;
};

function activeDaysWithin(reflections: Reflection[], days: number, asOf: Date): number {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffIso = iso(cutoff);
  const set = new Set(
    reflections
      .filter((r) => r.reflected_for >= cutoffIso)
      .map((r) => r.reflected_for),
  );
  return set.size;
}

function computeStreak(reflections: Reflection[], asOf: Date): number {
  const dates = new Set(
    reflections
      .filter((r) => r.outcome === "done" || r.outcome === "partial")
      .map((r) => r.reflected_for),
  );
  if (dates.size === 0) return 0;
  let s = 0;
  const d = new Date(asOf);
  if (!dates.has(iso(d))) d.setDate(d.getDate() - 1);
  while (dates.has(iso(d))) {
    s += 1;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

function countResults(reflections: Reflection[]): number {
  return reflections.filter((r) =>
    /\[resultado:(contato|oportunidade)\]/i.test(r.note ?? ""),
  ).length;
}

function mostRecentIso(reflections: Reflection[]): string | null {
  if (reflections.length === 0) return null;
  return [...reflections]
    .map((r) => r.reflected_for)
    .sort((a, b) => b.localeCompare(a))[0];
}

function combine(signals: Signal[]): number {
  const total = signals.reduce((sum, s) => sum + (s.progress * s.weight) / 100, 0);
  return Math.round(clamp(total));
}

function stateFrom(
  totalCheckins: number,
  hasAnyData: boolean,
  value: number,
): { state: Indicator["state"]; stateLabel: string; valueOrNull: number | null } {
  if (!hasAnyData && totalCheckins < 2) {
    return { state: "collecting", stateLabel: "Coletando dados", valueOrNull: null };
  }
  if (totalCheckins < 3 && value < 15) {
    return { state: "waking", stateLabel: "Despertando", valueOrNull: null };
  }
  if (value < 20) {
    return { state: "developing", stateLabel: "Em desenvolvimento", valueOrNull: value };
  }
  return { state: "ready", stateLabel: "Ativo", valueOrNull: value };
}

export function computeScore(input: ScoreInput): ScoreBundle {
  const { profileCompleteness, hasClearGoal } = input;
  const sharedExecuted = input.sharedExecuted ?? 0;
  const asOf = input.asOf ?? new Date();
  const asOfIso = iso(asOf);
  const reflections = input.asOf
    ? input.reflections.filter((r) => r.reflected_for <= asOfIso)
    : input.reflections;

  const totalCheckins = reflections.length;
  const doneCheckins = reflections.filter((r) => r.outcome === "done").length;
  const partialCheckins = reflections.filter((r) => r.outcome === "partial").length;
  const streak = computeStreak(reflections, asOf);
  const active7 = activeDaysWithin(reflections, 7, asOf);
  const active30 = activeDaysWithin(reflections, 30, asOf);
  const active90 = activeDaysWithin(reflections, 90, asOf);
  const completionRate =
    totalCheckins > 0 ? (doneCheckins + partialCheckins * 0.5) / totalCheckins : 0;
  const resultsCount = countResults(reflections);
  const clarity = profileCompleteness == null ? 0 : profileCompleteness;
  const goalDefined = hasClearGoal ? 100 : 0;
  const updatedAt = mostRecentIso(reflections);

  // ---------- FOCUS ----------
  const focusSignals: Signal[] = [
    {
      key: "completion",
      label: "MAG Metas concluídas",
      detail:
        totalCheckins > 0
          ? `Você concluiu ${doneCheckins} de ${totalCheckins} MAG Metas registradas.`
          : "Você ainda não registrou nenhuma MAG Meta.",
      weight: 40,
      progress: totalCheckins > 0 ? clamp(completionRate * 100) : 0,
      current: doneCheckins,
      target: Math.max(totalCheckins, 1),
    },
    {
      key: "clarity",
      label: "Clareza do seu perfil",
      detail:
        clarity > 0
          ? `Seu Perfil Magnético está ${Math.round(clarity)}% completo.`
          : "Você ainda não completou seu Perfil Magnético com a MAG.",
      weight: 25,
      progress: clamp(clarity),
    },
    {
      key: "goal",
      label: "Objetivo definido",
      detail: hasClearGoal
        ? "Você registrou um objetivo profissional claro."
        : "Nenhum objetivo profissional definido ainda.",
      weight: 15,
      progress: goalDefined,
    },
    {
      key: "volume",
      label: "Ritmo de execução",
      detail:
        doneCheckins > 0
          ? `Você já concluiu ${doneCheckins} ${doneCheckins === 1 ? "meta no total" : "metas no total"}.`
          : "Nenhuma meta concluída ainda.",
      weight: 20,
      progress: clamp((doneCheckins / 20) * 100),
      current: doneCheckins,
      target: 20,
    },
  ];
  const focusValue = combine(focusSignals);
  const focusHead =
    totalCheckins === 0
      ? "A MAG ainda está observando seu comportamento. Assim que você começar a registrar suas MAG Metas, seu Foco começa a se formar."
      : `A MAG percebeu que ${Math.round(completionRate * 100)}% das suas MAG Metas foram concluídas até aqui. ${clarity > 0 ? `Seu Perfil Magnético está ${Math.round(clarity)}% completo, o que ajuda a MAG a manter suas metas mais alinhadas.` : "Completar seu Perfil Magnético ajudaria a MAG a tornar suas metas ainda mais precisas."}`;
  const focusNext: string[] = [];
  if (completionRate < 0.7) focusNext.push("Conclua as próximas 3 MAG Metas seguidas.");
  if (clarity < 80) focusNext.push("Complete seu Perfil Magnético com a MAG.");
  if (!hasClearGoal) focusNext.push("Defina um objetivo profissional claro no seu perfil.");
  focusNext.push("Registre honestamente o resultado de cada MAG Meta no check-in.");
  const focusState = stateFrom(totalCheckins, clarity > 0 || hasClearGoal, focusValue);

  // ---------- CONSISTENCY ----------
  const consistencySignals: Signal[] = [
    {
      key: "streak",
      label: "Sequência atual",
      detail: `${streak} ${streak === 1 ? "dia consecutivo" : "dias consecutivos"} com check-in.`,
      weight: 40,
      progress: clamp((streak / 14) * 100),
      current: streak,
      target: 14,
    },
    {
      key: "active7",
      label: "Dias ativos (últimos 7)",
      detail: `Você realizou check-in em ${active7} dos últimos 7 dias.`,
      weight: 20,
      progress: clamp((active7 / 7) * 100),
      current: active7,
      target: 7,
    },
    {
      key: "active30",
      label: "Dias ativos (últimos 30)",
      detail: `Você realizou check-in em ${active30} dos últimos 30 dias.`,
      weight: 20,
      progress: clamp((active30 / 30) * 100),
      current: active30,
      target: 30,
    },
    {
      key: "active90",
      label: "Dias ativos (últimos 90)",
      detail: `Você realizou check-in em ${active90} dos últimos 90 dias.`,
      weight: 10,
      progress: clamp((active90 / 90) * 100),
      current: active90,
      target: 90,
    },
    {
      key: "rate",
      label: "Taxa de conclusão",
      detail: `${totalCheckins > 0 ? Math.round((doneCheckins / totalCheckins) * 100) : 0}% dos seus check-ins terminaram com a meta concluída.`,
      weight: 10,
      progress: totalCheckins > 0 ? clamp((doneCheckins / totalCheckins) * 100) : 0,
    },
  ];
  const consistencyValue = combine(consistencySignals);
  const consistencyHead =
    totalCheckins === 0
      ? "A MAG ainda não tem histórico suficiente para avaliar sua constância. Faça seu primeiro check-in para começar."
      : `A MAG observou que você fez check-in em ${active7} dos últimos 7 dias e ${active30} dos últimos 30.${streak > 0 ? ` Sua sequência atual é de ${streak} ${streak === 1 ? "dia" : "dias"} seguidos.` : " Sua sequência atual foi interrompida — retomar hoje já reativa o indicador."}`;
  const consistencyNext: string[] = [];
  if (streak < 7) consistencyNext.push("Faça check-in hoje para manter (ou reiniciar) sua sequência.");
  if (active7 < 5) consistencyNext.push("Alcance pelo menos 5 dias ativos nos próximos 7.");
  consistencyNext.push("Trate o check-in diário como um compromisso curto: 2 minutos bastam.");
  consistencyNext.push("Retome mesmo depois de falhar — o que fortalece é a retomada, não a perfeição.");
  const consistencyState = stateFrom(totalCheckins, streak > 0, consistencyValue);

  // ---------- AUTHORITY ----------
  const strategiesExecuted = doneCheckins + partialCheckins;
  const authoritySignals: Signal[] = [
    {
      key: "metas",
      label: "MAG Metas concluídas",
      detail:
        doneCheckins > 0
          ? `Você concluiu ${doneCheckins} ${doneCheckins === 1 ? "MAG Meta" : "MAG Metas"}.`
          : "Você ainda não concluiu nenhuma MAG Meta.",
      weight: 30,
      progress: clamp((doneCheckins / 10) * 100),
      current: doneCheckins,
      target: 10,
    },
    {
      key: "strategies",
      label: "Estratégias executadas",
      detail:
        strategiesExecuted > 0
          ? `Você colocou ${strategiesExecuted} ${strategiesExecuted === 1 ? "estratégia" : "estratégias"} em prática.`
          : "Você ainda não colocou estratégias em prática.",
      weight: 25,
      progress: clamp((strategiesExecuted / 15) * 100),
      current: strategiesExecuted,
      target: 15,
    },
    {
      key: "results",
      label: "Resultados registrados",
      detail:
        resultsCount > 0
          ? `Você registrou ${resultsCount} ${resultsCount === 1 ? "novo contato ou oportunidade profissional" : "novos contatos ou oportunidades profissionais"}.`
          : "Você ainda não registrou resultados.",
      weight: 25,
      progress: clamp((resultsCount / 10) * 100),
      current: resultsCount,
      target: 10,
    },
    {
      key: "consistency",
      label: "Consistência",
      detail: `Você realizou check-in em ${active7} dos últimos 7 dias.`,
      weight: 20,
      progress: clamp((active7 / 7) * 100),
      current: active7,
      target: 7,
    },
  ];
  const authorityValue = combine(authoritySignals);
  const authorityHead =
    strategiesExecuted + resultsCount === 0
      ? "A MAG analisa continuamente seu comportamento dentro da plataforma para entender quais ações realmente fortalecem sua presença profissional. Por enquanto, ainda existem poucas evidências registradas de posicionamento consistente."
      : "A MAG analisa continuamente seu comportamento dentro da plataforma para entender quais ações realmente fortalecem sua presença profissional. Hoje sua Execução ainda está em desenvolvimento porque existem poucas evidências registradas de posicionamento consistente.";
  const authorityNext: string[] = [
    "Execute sua próxima MAG Meta.",
    "Registre os resultados obtidos das suas ações.",
    "Mantenha uma sequência mínima de 7 dias.",
    "Compartilhe conhecimento relevante para seu público.",
  ];
  const authorityState = stateFrom(
    totalCheckins,
    strategiesExecuted > 0 || resultsCount > 0 || clarity > 0,
    authorityValue,
  );

  // ---------- MAGNETISM (composite) ----------
  const recentActivity = clamp((active7 / 7) * 100);
  const focusN = focusValue;
  const consistencyN = consistencyValue;
  const authorityN = authorityValue;
  const magnetismSignals: Signal[] = [
    {
      key: "focus",
      label: "Foco",
      detail: `${focusN}/100 no seu Foco atual.`,
      weight: 28,
      progress: focusN,
      current: focusN,
      target: 100,
    },
    {
      key: "consistency",
      label: "Consistência",
      detail: `${consistencyN}/100 na sua Consistência atual.`,
      weight: 32,
      progress: consistencyN,
      current: consistencyN,
      target: 100,
    },
    {
      key: "authority",
      label: "Execução",
      detail: `${authorityN}/100 na sua Execução atual.`,
      weight: 20,
      progress: authorityN,
      current: authorityN,
      target: 100,
    },
    {
      key: "recent",
      label: "Evolução recente",
      detail: `${active7} de 7 dias ativos na última semana.`,
      weight: 8,
      progress: recentActivity,
      current: active7,
      target: 7,
    },
    {
      key: "shared",
      label: "Direções compartilhadas",
      detail:
        sharedExecuted > 0
          ? `${sharedExecuted} ${sharedExecuted === 1 ? "direção compartilhada foi executada" : "direções compartilhadas foram executadas"}.`
          : "Nenhuma direção compartilhada executada ainda.",
      weight: 12,
      progress: clamp((sharedExecuted / 5) * 100),
      current: sharedExecuted,
      target: 5,
    },
  ];
  const magnetismValue = combine(magnetismSignals);
  const magnetismHead =
    focusN + consistencyN + authorityN === 0
      ? "O Impacto é o resultado combinado de tudo que a MAG observa em você. Ele se forma à medida que Foco, Consistência e Execução começam a se acumular."
      : `Este é o seu Campo Magnético Profissional. A MAG o calcula combinando seu Foco (${focusN}), sua Consistência (${consistencyN}), sua Execução (${authorityN}) e sua atividade recente.`;
  const magnetismNext: string[] = [];
  if (consistencyN <= authorityN && consistencyN <= focusN) {
    magnetismNext.push("Priorize check-ins diários — a Consistência é o multiplicador que mais puxa seu campo hoje.");
  } else if (authorityN <= consistencyN && authorityN <= focusN) {
    magnetismNext.push("Registre resultados das suas ações — a Execução é o multiplicador que mais puxa seu campo hoje.");
  } else {
    magnetismNext.push("Mantenha o Foco vivo escolhendo uma MAG Meta clara por dia.");
  }
  magnetismNext.push("Complete pelo menos uma MAG Meta por dia.");
  magnetismNext.push("Registre no check-in o que aconteceu depois da meta.");
  magnetismNext.push("Converse com a MAG quando algo travar — cada troca alimenta seu campo.");
  const magnetismState = stateFrom(
    totalCheckins,
    focusN > 0 || consistencyN > 0 || authorityN > 0,
    magnetismValue,
  );

  const anyReady =
    focusState.valueOrNull != null ||
    consistencyState.valueOrNull != null ||
    authorityState.valueOrNull != null;
  const total = anyReady
    ? Math.round(
        ((focusState.valueOrNull ?? 0) +
          (consistencyState.valueOrNull ?? 0) +
          (authorityState.valueOrNull ?? 0) +
          (magnetismState.valueOrNull ?? 0)) /
          4,
      )
    : null;

  return {
    focus: {
      key: "focus",
      label: "Foco",
      value: focusState.valueOrNull,
      state: focusState.state,
      stateLabel: focusState.stateLabel,
      headline: focusHead,
      nextSteps: focusNext,
      signals: focusSignals,
      updatedAt,
    },
    consistency: {
      key: "consistency",
      label: "Consistência",
      value: consistencyState.valueOrNull,
      state: consistencyState.state,
      stateLabel: consistencyState.stateLabel,
      headline: consistencyHead,
      nextSteps: consistencyNext,
      signals: consistencySignals,
      updatedAt,
    },
    authority: {
      key: "authority",
      label: "Execução",
      value: authorityState.valueOrNull,
      state: authorityState.state,
      stateLabel: authorityState.stateLabel,
      headline: authorityHead,
      nextSteps: authorityNext,
      signals: authoritySignals,
      updatedAt,
    },
    magnetism: {
      key: "magnetism",
      label: "Impacto",
      value: magnetismState.valueOrNull,
      state: magnetismState.state,
      stateLabel: magnetismState.stateLabel,
      headline: magnetismHead,
      nextSteps: magnetismNext,
      signals: magnetismSignals,
      updatedAt,
    },
    total,
    updatedAt,
  };
}
