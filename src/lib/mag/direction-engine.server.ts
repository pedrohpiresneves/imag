import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { isGeneric, similarity, strategyKey } from "./text";
import { languageInstruction } from "@/lib/i18n/ai-language.server";
import {
  buildPersonalContextBlock,
  PERSONAL_CONTEXT_PRINCIPLE,
} from "./personal-context";
import {
  closureLabel,
  continuityLabel,
  expectedMode,
  normalizeMode,
  type ContinuityMode,
} from "./continuity";
import { fallbackStrategicReason, sanitizeStrategicReason } from "./reason-guard";
import {
  resolveInteraction,
  validateInteraction,
  type InteractionConfig,
  type InteractionType,
} from "./interaction";
import { normalizeFirstName } from "./name";
import { ORCHESTRATION_PRINCIPLE, readSafety, type RiskLevel } from "./domains";
import { evaluateDirection } from "./quality";
import { validateDirection } from "./direction-validator";



type Db = SupabaseClient<Database>;

const MODEL = "google/gemini-2.5-flash";

export type DecidedMeta = {
  title: string;
  description: string;
  strategic_reason: string;
  arc_id: string | null;
  parent_plan_id: string | null;
  strategy_key: string;
  expected_signal: string | null;
  difficulty: number;
  continuity_mode: ContinuityMode | null;
  decision: Record<string, unknown>;
  interaction_type: InteractionType;
  interaction_config: InteractionConfig;
  orchestration: Record<string, unknown>;
  risk_level: RiskLevel;
  needs_professional: boolean;
};

export type MagBundle = Awaited<ReturnType<typeof loadBundle>>;

/** Carrega o estado profissional completo do usuário. */
export async function loadBundle(db: Db, userId: string, localDate: string) {
  const [profile, magnetic, ctx, arcs, plans, reflections, feedbacks, dayPriorities, dayEvents, impacts, saved, responses] =
    await Promise.all([
      db
        .from("profiles")
        .select("full_name, profession, area, city, goal, challenge, language")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("magnetic_profile")
        .select("identity, audience, business, communication, mindset, objectives, notes")
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("professional_context")
        .select("state, narrative, execution_profile")
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("direction_arcs")
        .select("id, title, objective, bottleneck, status, progress, opened_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("opened_at", { ascending: false })
        .limit(4),
      db
        .from("user_plans")
        .select(
          "id, meta_date, priority_title, first_action, status, completed_at, arc_id, strategy_key, expected_signal, difficulty, weekly_focus_id",
        )
        .eq("user_id", userId)
        .not("meta_date", "is", null)
        .order("meta_date", { ascending: false })
        .limit(14),
      db
        .from("plan_reflections")
        .select("outcome, note, activity_text, reflected_for, plan_id, signal_key, signal_answer")
        .eq("user_id", userId)
        .order("reflected_for", { ascending: false })
        .limit(14),
      db
        .from("mag_goal_feedback")
        .select("feedback, goal_title, goal_category, goal_context, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(24),
      db
        .from("day_priorities")
        .select("title, done, position")
        .eq("user_id", userId)
        .eq("day_date", localDate)
        .order("position", { ascending: true })
        .limit(6),
      db
        .from("day_events")
        .select("start_time, title")
        .eq("user_id", userId)
        .eq("day_date", localDate)
        .order("start_time", { ascending: true })
        .limit(8),
      db
        .from("direction_impacts")
        .select("direction_title, useful, outcome_text, profession, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("saved_directions")
        .select("direction_text, why_text, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
      db
        .from("direction_responses")
        .select("direction_title, life_area, learning, created_at")
        .eq("user_id", userId)
        .eq("influences_future", true)
        .not("learning", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const profession = profile.data?.profession ?? null;
  const efficacy = await loadEfficacyPriors(db, profession);

  // Pendências REAIS de ontem — a MAG só pode citar uma lista anterior se ela existir.
  const prevDate = (() => {
    const d = new Date(`${localDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const { data: yesterdayPending } = await db
    .from("day_priorities")
    .select("title, done")
    .eq("user_id", userId)
    .eq("day_date", prevDate)
    .eq("done", false)
    .order("position", { ascending: true })
    .limit(3);

  // Foco da semana: contexto prioritário da hierarquia objetivo → foco → direção.
  const { data: weeklyFocus } = await db
    .from("weekly_focus")
    .select("id, interpreted, main_goal, end_date, clarify_question, clarify_answer")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  // Planejamento: metas e prazos futuros registrados pelo usuário.
  const { data: planning } = await db
    .from("plan_items")
    .select("kind, title, info, due_date, done")
    .eq("user_id", userId)
    .eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(12);

  const { data: focus } = await db
    .from("user_focus_shifts")
    .select("id, focus_key, focus_label, note, duration")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  // Continuidade só é legítima dentro do MESMO foco da semana. Direções de um
  // foco anterior nunca continuam nem emprestam contexto — servem apenas para
  // evitar repetição de texto.
  const allPlans = plans.data ?? [];
  const focusId = (weeklyFocus as { id?: string } | null)?.id ?? null;
  const focusPlans = focusId
    ? allPlans.filter((p) => (p as { weekly_focus_id?: string | null }).weekly_focus_id === focusId)
    : [];

  return {
    localDate,
    profile: profile.data ?? null,
    magnetic: (magnetic.data as Record<string, unknown> | null) ?? null,
    context: ctx.data ?? null,
    arcs: arcs.data ?? [],
    plans: focusPlans,
    /** Histórico completo, apenas para não repetir texto de direções antigas. */
    allPlans,
    reflections: reflections.data ?? [],
    /** Memória comportamental contínua (aprendida observando o uso). */
    memory: await loadMemoryFacts(db as never, userId).catch(() => []),


    feedbacks: feedbacks.data ?? [],
    dayPriorities: dayPriorities.data ?? [],
    yesterdayPending: (yesterdayPending ?? []) as { title: string; done: boolean }[],
    weeklyFocus: (weeklyFocus ?? null) as {
      id: string;
      interpreted: string;
      main_goal: string | null;
      end_date: string;
      clarify_question?: string | null;
      clarify_answer?: string | null;
    } | null,
    dayEvents: dayEvents.data ?? [],
    impacts: impacts.data ?? [],
    saved: saved.data ?? [],
    responses: (responses.data ?? []) as {
      direction_title: string | null;
      life_area: string | null;
      learning: string | null;
      created_at: string;
    }[],
    focus: (focus as {
      id: string;
      focus_key: string;
      focus_label: string;
      note: string | null;
      duration: string;
    } | null) ?? null,
    planning: (planning ?? []) as {
      kind: string;
      title: string;
      info: string | null;
      due_date: string | null;
      done: boolean;
    }[],
    efficacy,
  };
}


/** Eficácia agregada e anônima por tipo de estratégia (mesma profissão primeiro). */
async function loadEfficacyPriors(db: Db, profession: string | null) {
  const { data } = await db
    .from("direction_signals")
    .select("strategy_key, profession, executed, positive")
    .limit(2000);
  const map = new Map<string, { executed: number; positive: number; total: number }>();
  for (const row of data ?? []) {
    const sameProfession =
      !!profession && !!row.profession && row.profession.toLowerCase() === profession.toLowerCase();
    const weight = sameProfession ? 2 : 1;
    const entry = map.get(row.strategy_key) ?? { executed: 0, positive: 0, total: 0 };
    entry.total += weight;
    if (row.executed) entry.executed += weight;
    if (row.positive) entry.positive += weight;
    map.set(row.strategy_key, entry);
  }
  return map;
}

function efficacyBonus(map: MagBundle["efficacy"], key: string): number {
  const e = map.get(key);
  if (!e || e.total < 4) return 0;
  const rate = e.positive / e.total;
  return Math.round((rate - 0.5) * 20); // -10..+10
}

// Schema propositalmente PLANO e sem optional/nullable/default:
// modelos com structured output falham em uniões/nullables, e a falha
// derrubava o motor inteiro para um fallback estático igual para todos.
// Campos "vazios" chegam como "" e são normalizados aqui no servidor.
const CandidateSchema = z.object({
  title: z.string(),
  description: z.string(),
  strategic_reason: z.string(),
  arc_title: z.string(),
  continuity: z.boolean(),
  mode: z.string(),
  parent_meta_date: z.string(),
  expected_signal: z.string(),
  effort_minutes: z.number(),
  context_elements: z.array(z.string()),
  impact: z.number(),
  urgency: z.number(),
  executability: z.number(),
  completion_criteria: z.string(),
  is_diagnostic: z.boolean(),
  next_step_hint: z.string(),
});

const DecisionSchema = z.object({
  reading: z.object({
    active_objective: z.string(),
    bottleneck: z.string(),
    recent_events: z.string(),
    open_threads: z.array(z.string()),
    what_worked: z.string(),
    what_failed: z.string(),
  }),
  arc: z.object({
    continue_arc_id: z.string(),
    close_arc_id: z.string(),
    close_reason: z.string(),
    new_arc_title: z.string(),
    new_arc_objective: z.string(),
  }),
  context_update: z.object({
    facts: z.array(z.string()),
    preferences: z.array(z.string()),
    avoid: z.array(z.string()),
    narrative: z.string(),
  }),
  orchestration: z.object({
    goal_meaning: z.string(),
    primary_domain: z.string(),
    supporting_domains: z.array(z.string()),
    starting_point: z.string(),
    known_context: z.array(z.string()),
    missing_critical: z.array(z.string()),
    risk_level: z.string(),
    needs_professional: z.boolean(),
    professional_note: z.string(),
    progress_measure: z.string(),
  }),
  candidates: z.array(CandidateSchema),
});

type Decision = z.infer<typeof DecisionSchema>;
type Candidate = z.infer<typeof CandidateSchema>;

const SYSTEM = `Você é o núcleo de decisão da MAG — um SISTEMA DE DIREÇÃO CONTÍNUA, não um gerador de tarefas.

Seu trabalho: ler o estado atual do usuário (profissional e pessoal), identificar o gargalo real dentro da área do foco ativo, e propor candidatas de UMA ação para HOJE. Outro módulo escolhe a melhor.

Antes de propor qualquer coisa, responda internamente: qual é o objetivo ativo? qual é o gargalo agora? o que aconteceu recentemente? o que já foi tentado? o que funcionou? o que não funcionou? existe ação anterior que precisa de continuidade? existe oportunidade aberta não explorada? quanto tempo/energia ele tem hoje? qual ação única tem maior probabilidade de avanço?

REGRAS DURAS:
1. CONTINUIDADE ANTES DE NOVIDADE. Se existe conversa aberta, lead aguardando, resultado parcial ou segunda etapa pendente, a melhor candidata continua isso. Marque continuity=true e aponte parent_meta_date.
2. PROIBIDO GENÉRICO. A MAG decide o que fazer — nunca pede para o usuário escolher.
   O "title" é uma MENSAGEM PESSOAL DA MAG PARA O USUÁRIO, escrita em primeira pessoa, como quem conversa — não um comando de sistema.
   Estrutura: [Primeiro nome do usuário] + abertura natural + UMA ação concreta e possível hoje. Uma a duas frases, 10-24 palavras, sem reticências, sem "Ver mais", sem emojis.
   Exemplos CORRETOS de title:
   - "Bruna, hoje vamos reativar um lead de rinomodelação que não respondeu."
   - "Bruna, hoje o foco é retomar o contato com 3 pacientes que pediram orçamento."
   - "Que tal começarmos publicando 1 story com um resultado real do seu trabalho?"
   - "Percebi que essa conversa ficou sem resposta — vamos retomá-la hoje?"
   - "Uma ação simples para hoje: concluir uma pendência antes de começar algo novo."
   ALTERNE as aberturas ao longo dos dias ("hoje vamos…", "hoje o foco é…", "que tal…", "percebi que…", "para avançar no seu objetivo…", "uma ação simples para hoje:…"). NUNCA use a mesma abertura da direção anterior.
   A especificidade (alvo, quantidade, canal) vive no title quando couber naturalmente; o resto vai no "description", que detalha a execução em no máximo 3 passos curtos e objetivos, sem repetir o title.
   PROIBIDO começar o title com verbo de ordem: "Liste", "Envie", "Faça", "Registre", "Identifique", "Analise", "Organize", "Execute", "Realize", "Anote", "Defina", "Escreva". Reescreva sempre como conversa ("Bruna, hoje vamos identificar os dois gastos que mais pesaram na sua semana.").
   PROIBIDO: tom de ordem seca ("Envie mensagem para 3 clientes."), frases motivacionais vazias, cobrança, culpa, infantilização, inventar informação que o usuário não deu.

   PROIBIDO como direção principal (só pode aparecer no strategic_reason): "escolha a ação de maior alavancagem",
   "foque no que importa", "aja com consistência", "priorize o essencial", "avance em algo importante",
   "faça o que pode gerar mais resultado", "dê um passo", "sem esperar condições ideais",
   "faça um post", "organize sua agenda", "entre em contato com clientes",
   "defina um miniobjetivo", "escolha uma ação", "decida por onde começar", "pense em algo",
   "reflita sobre seu objetivo", "faça algo pequeno", "beba um copo de água", "caminhe 5 minutos".
   A MAG DECIDE o próximo passo. O usuário só aceita, adapta, adia ou explica uma limitação — nunca recebe de volta a decisão.
   Depois de ler, o usuário NÃO pode se perguntar "tá, mas o que exatamente eu faço?". O objetivo é: bateu o olho → sentiu que a MAG escolheu aquilo para ele → executou.
3. TESTE DE UNICIDADE. Se a mesma direção serviria para outros 1.000 usuários, descarte. Cada candidata deve ter ao menos 2 elementos vindos do contexto real (liste em context_elements). Os dados influenciam a decisão; não precisam ser citados no texto.
4. "strategic_reason" liga CONTEXTO → DECISÃO, em linguagem natural, sem citar "seus dados", "minha memória" ou "seu perfil armazenado". Ex.: "Ontem duas pessoas responderam. Antes de buscar novos interessados, faz mais sentido avançar o que já está aberto."
5. NÃO REPETIR DISFARÇADO. Reformular a frase não torna a estratégia diferente. Só repita uma estratégia recente se houver motivo estratégico claro.
6. ARCOS. Toda candidata pertence a um arco (ex.: preencher agenda, recuperar leads, lançar serviço, posicionamento, indicações, operação). Se o objetivo do arco foi atingido, feche-o (close_arc_id) e mude de gargalo.
7. DIFICULDADE ADAPTATIVA. Se o usuário vem executando, aumente a sofisticação. Se não vem executando, reduza a fricção até um nível executável — nunca pressione nem culpe.
8. TOM: calmo, inteligente, direto, humano, observador. Sem "Parabéns!", "Vamos lá!", "Você consegue!", sem emojis, sem linguagem de coach.
9. Respeite tempo e energia do check-in de hoje. effort_minutes precisa caber.
10. Vocabulário da profissão (saúde: paciente; comércio/serviço: cliente; empresa/funcionário: equipe, entregas, liderança).
11. MOMENTO DE VIDA E ÁREA LIVRE. A direção segue a área do Foco da Semana escolhida pelo usuário — profissional OU pessoal (saúde, alimentação, exercício, sono, casa, rotina, estudos, finanças, organização mental). Nunca recuse nem desvie o tema por ser pessoal. Em áreas sensíveis, a ação é de organização, rotina, registro ou hábito seguro: sem diagnóstico, sem prescrição, sem dieta ou treino prescritos, sem meta de peso e sem promessa de resultado; indique avaliação profissional quando for realmente necessário. Ex.: foco "emagrecer" → "hoje vamos deixar as refeições da semana planejadas" ou "que tal reservar 20 minutos de caminhada no seu horário mais livre?". Considere disponibilidade, energia e limitações. Uma prioridade clara, contextual e executável por vez.` + PERSONAL_CONTEXT_PRINCIPLE;

const CONTINUITY_PRINCIPLE = `

12. CONTINUIDADE INTELIGENTE (regra central).
"A direção de hoje deve ser consequência inteligente do que aconteceu antes. Não gere novidade por novidade. Continue, aprofunde, adapte ou mude o foco conforme o movimento real do usuário."
Toda candidata declara um "mode":
- "continuar": existe um próximo passo natural do movimento anterior (ex.: alguém respondeu → avance essa conversa).
- "aprofundar": o usuário avançou parcialmente e faz sentido levar adiante o mesmo movimento.
- "adaptar": tentou e não funcionou, ou a ação era grande demais — reduza complexidade, duração ou etapas (ex.: "Grave um vídeo" vira "Escreva as 3 frases principais do vídeo").
- "mudar_foco": a prioridade deixou de fazer sentido ou outra ação se tornou mais importante.
NUNCA crie uma ação nova só porque começou um novo dia.
Se o usuário marcou "Mudou de prioridade", não insista nem cobre a direção anterior: interprete o novo momento e redirecione com naturalidade.
Se a mesma direção não foi executada duas vezes ou mais, é PROIBIDO repeti-la: reduza drasticamente a fricção até virar um primeiro passo mínimo e concreto.
O "strategic_reason" deve deixar explícito o elo com ontem quando houver continuidade. Ex.: "Ontem uma das conversas avançou. Hoje, desenvolver essa oportunidade é mais relevante do que iniciar novas prospecções."`;

const FULL_SYSTEM = SYSTEM + CONTINUITY_PRINCIPLE + ORCHESTRATION_PRINCIPLE;

/** Leitura local do que aconteceu com a direção anterior. */
function continuityState(b: MagBundle) {
  const lastPlan = b.plans.find((p) => p.meta_date !== b.localDate) ?? null;
  const reflByDate = new Map(b.reflections.map((r) => [r.reflected_for, r]));
  const lastRefl = lastPlan?.meta_date ? (reflByDate.get(lastPlan.meta_date) ?? null) : null;

  // Resistência recorrente: mesma estratégia não executada 2x ou mais.
  let repeated = false;
  if (lastPlan) {
    let misses = 0;
    for (const p of b.plans.slice(0, 5)) {
      const r = p.meta_date ? reflByDate.get(p.meta_date) : undefined;
      const notDone = !p.completed_at && (!r || r.outcome === "blocked" || r.outcome === "skipped");
      const sameLine =
        (p.strategy_key && p.strategy_key === lastPlan.strategy_key) ||
        similarity(p.priority_title, lastPlan.priority_title) > 0.5;
      if (notDone && sameLine) misses += 1;
    }
    repeated = misses >= 2;
  }

  const expected = expectedMode({
    outcome: lastRefl?.outcome ?? (lastPlan?.completed_at ? "done" : null),
    signalAnswer: (lastRefl as { signal_answer?: string | null } | null)?.signal_answer ?? null,
    repeatedNonExecution: repeated,
  });

  return { lastPlan, lastRefl, repeated, expected };
}

function bundleToPrompt(b: MagBundle, rejectionNote?: string): string {
  const L: string[] = [];
  const p = b.profile ?? ({} as NonNullable<MagBundle["profile"]>);
  L.push(`DATA DE HOJE: ${b.localDate}`);

  const cont = continuityState(b);
  if (cont.lastPlan) {
    const r = cont.lastRefl as
      | { outcome: string; note: string | null; activity_text: string | null; signal_key?: string | null; signal_answer?: string | null }
      | null;
    L.push("");
    L.push("CONTINUIDADE (ponto exato onde o usuário parou):");
    L.push(`- Direção anterior (${cont.lastPlan.meta_date}): ${cont.lastPlan.priority_title}`);
    if (cont.lastPlan.first_action) L.push(`- Execução pedida: ${cont.lastPlan.first_action}`);
    L.push(
      `- Como terminou: ${closureLabel(r?.outcome ?? (cont.lastPlan.completed_at ? "done" : null)) ?? "sem registro"}`,
    );
    if (r?.signal_answer) L.push(`- Resultado informado (${r.signal_key ?? "sinal"}): ${r.signal_answer}`);
    if (r?.activity_text) L.push(`- Relato: ${r.activity_text.slice(0, 200)}`);
    if (cont.lastPlan.expected_signal) L.push(`- Sinal esperado era: ${cont.lastPlan.expected_signal}`);
    if (cont.repeated)
      L.push(
        "- ATENÇÃO: resistência recorrente. Essa linha de ação já falhou duas vezes ou mais. É obrigatório ADAPTAR: reduzir complexidade, duração ou etapas até virar um primeiro passo mínimo.",
      );
    if (cont.expected)
      L.push(
        `- Movimento esperado para hoje: "${cont.expected}". Só escolha outro se houver motivo estratégico explícito no strategic_reason.`,
      );
  }

  // A MAG NUNCA pergunta energia ou tempo disponível. Ela infere a janela real
  // do dia a partir da agenda, das prioridades e do comportamento recente.
  const prios = b.dayPriorities ?? [];
  const events = b.dayEvents ?? [];
  if (prios.length || events.length) {
    L.push("");
    L.push("O DIA DE HOJE (inferido, o usuário não preencheu nada):");
    if (prios.length) {
      L.push("- Prioridades declaradas:");
      for (const p of prios) L.push(`  - [${p.done ? "x" : " "}] ${p.title}`);
    }
    if (events.length) {
      L.push("- Agenda:");
      for (const e of events) L.push(`  - ${e.start_time} ${e.title}`);
      L.push(
        `- Densidade da agenda: ${events.length >= 4 ? "dia cheio — a ação precisa caber em uma janela curta entre compromissos" : "dia com espaço — cabe uma ação mais estratégica, ainda assim UMA só"}.`,
      );
    }
    L.push(
      "Use isso para calibrar tamanho e horário da ação. Se as prioridades já cobrem o objetivo, a direção deve destravar ou potencializar uma delas em vez de competir com elas.",
    );
  }
  const wf = b.weeklyFocus ?? null;
  L.push("");
  if (wf) {
    L.push("FOCO DA SEMANA (contexto prioritário definido pelo usuário):");
    L.push(`  - Foco: ${wf.interpreted}`);
    if (wf.main_goal) L.push(`  - Objetivo maior: ${wf.main_goal}`);
    if (wf.clarify_question && wf.clarify_answer) {
      L.push(`  - Pergunta essencial da MAG: ${wf.clarify_question}`);
      L.push(`  - Resposta do usuário: ${wf.clarify_answer}`);
      L.push(
        "Essa resposta é o ponto de partida real: a direção de hoje precisa atacar exatamente o que o usuário apontou aí.",
      );
    }
    L.push(`  - Termina em: ${wf.end_date}`);
    L.push(
      "A direção de hoje deve ser o PRÓXIMO PASSO POSSÍVEL para esse foco avançar — nunca repetir o foco inteiro. Só saia do foco se existir urgência real (prazo, compromisso, pendência crítica); nesse caso explique em uma frase por que priorizou outra coisa e diga que o foco continua ativo.",
    );
  } else {
    L.push(
      "O usuário ainda não definiu um foco da semana. Baseie-se nos objetivos, prioridades e contexto atuais, sem inventar um foco.",
    );
  }
  const pending = b.yesterdayPending ?? [];
  L.push("");
  if (pending.length) {
    L.push("PRIORIDADES PENDENTES DE ONTEM (existem de verdade, ainda não concluídas):");
    for (const p of pending) L.push(`  - ${p.title}`);
    L.push(
      "Você pode retomar UMA delas se fizer sentido estratégico, citando-a pelo nome exato. Nunca invente outras.",
    );
  } else {
    L.push(
      "NÃO EXISTE nenhuma lista, tarefa ou prioridade pendente registrada em dias anteriores. É PROIBIDO escrever frases como \"pegue a lista que você criou ontem\", \"retome suas tarefas de ontem\" ou qualquer referência a algo que o usuário teria definido antes. Baseie a direção apenas no contexto atual descrito neste prompt.",
    );
  }
  const planning = b.planning ?? [];
  if (planning.length) {
    L.push("");
    L.push("PLANEJAMENTO DO USUÁRIO (metas, prazos e tarefas registradas por ele):");
    for (const p of planning) {
      const when = p.due_date ? ` — prazo ${p.due_date}` : " — sem data";
      L.push(`  - [${p.kind}] ${p.title}${p.info ? ` (${p.info})` : ""}${when}`);
    }
    L.push(
      "Use estes itens como contexto real: prazos próximos aumentam a urgência e metas semanais, mensais ou anuais orientam a direção de hoje. Nunca invente itens fora desta lista.",
    );
  }

  L.push(
    "REGRA DE DATAS: prioridades, compromissos e respostas de dias anteriores servem só como contexto. NUNCA transforme itens antigos (ex.: hábitos ou tarefas registradas ontem) em campos, checklist ou passos desta direção como se fossem tarefas de hoje. Os campos da interação nascem sempre vazios.",
  );

  if (b.focus) {
    L.push("");
    L.push("FOCO PEDIDO PELO USUÁRIO (prioridade máxima nesta direção):");
    L.push(`- Área a priorizar agora: ${b.focus.focus_label}`);
    if (b.focus.note) L.push(`- Contexto que o usuário escreveu: ${b.focus.note}`);
    L.push(
      "Esta direção DEVE endereçar esse foco, sem abandonar compromissos e prioridades importantes do dia e sem repetir direções anteriores.",
    );
  }

  L.push("");
  L.push(
    'O campo "strategic_reason" DEVE explicar, em linguagem natural, por que ESTA direção foi escolhida hoje, ligando o objetivo atual ao contexto real do dia (agenda, prioridades, histórico). Nunca peça informações ao usuário e nunca cite "seus dados" ou "seu perfil".',
  );
  L.push(
    'ATERRAMENTO OBRIGATÓRIO DA JUSTIFICATIVA: use exclusivamente informações desta direção, do objetivo ativo, do check-in de hoje (tempo e energia) e do contexto pessoal relevante. É PROIBIDO citar leads, orçamentos, conversas, campanhas, pacientes, stories ou qualquer pendência que não apareça explicitamente neste prompt. Não misture outras direções, metas ou categorias. Se uma informação da memória não tiver relação direta com a ação proposta, não a use. Máximo de 3 frases, linguagem simples, sem termos técnicos.',
  );
  L.push(
    'EXECUÇÃO DENTRO DA iMAG: se a direção pedir para escrever, escolher, listar, planejar, refletir ou registrar algo, o próprio app oferece o campo. É TERMINANTEMENTE PROIBIDO escrever no "first_action" (ou em qualquer campo) frases como "anote em uma nota", "escreva no caderno", "pegue papel e caneta", "abra o bloco de notas", "registre em outro aplicativo", "faça uma lista fora da iMAG" ou "anote para lembrar depois". Nunca direcione o usuário a ferramentas externas de registro.',
  );
  L.push(
    'FORMATO DO "first_action": no máximo 2 frases curtas e objetivas. Para ações simples, apenas UMA instrução direta (ex.: "Qual categoria você quer acompanhar?"). É PROIBIDO dividir uma ação simples em três passos óbvios ("pense no que registrar", "abra uma nota", "escreva"). Nada de repetir o título nem instruções genéricas.',
  );




  L.push("");
  L.push("PERFIL:");
  L.push(`- Nome: ${p.full_name ?? "—"}`);
  L.push(
    `- Primeiro nome válido (use apenas este valor; se for "—", escreva a frase SEM nome): ${normalizeFirstName(p.full_name) || "—"}`,
  );
  L.push(
    'LINGUAGEM DO "title": fala humana da MAG, no máximo 140 caracteres, uma única ação principal, sem linguagem burocrática (proibido "para a sua execução"), sem ordens frias iniciadas por Faça/Liste/Envie/Execute/Registre/Identifique. Varie a abertura entre "[Nome], hoje vamos…", "[Nome], que tal…", "Que tal começarmos por…", "Hoje o foco é…", "Vamos dar um primeiro passo em…", "Uma ação simples para hoje…". Não use o nome todos os dias e nunca junte nome com apelido, username ou e-mail.',
  );

  L.push(`- Profissão: ${p.profession ?? "—"} | Área: ${p.area ?? "—"} | Cidade: ${p.city ?? "—"}`);
  L.push(`- Objetivo declarado: ${p.goal ?? "—"}`);
  L.push(`- Dificuldade declarada: ${p.challenge ?? "—"}`);

  const personalBlock = buildPersonalContextBlock(
    (b.magnetic?.mindset ?? null) as Record<string, unknown> | null,
  );
  if (personalBlock) {
    L.push(personalBlock);
  }

  if (b.responses.length) {
    L.push("");
    L.push(
      "APRENDIZADOS DAS RESPOSTAS QUE O USUÁRIO REGISTROU NO APP (use para não repetir perguntas nem sugerir direções genéricas; cite apenas quando fizer sentido):",
    );
    for (const r of b.responses.slice(0, 8)) {
      L.push(`- [${r.life_area ?? "pessoal"}] ${r.learning}`);
    }
  }


  if (b.context?.narrative) {
    L.push("");
    L.push("MEMÓRIA PROFISSIONAL VIVA (retrato acumulado):");
    L.push(b.context.narrative);
  }
  const state = (b.context?.state ?? {}) as Record<string, unknown>;
  const facts = Array.isArray(state.facts) ? (state.facts as string[]) : [];
  const prefs = Array.isArray(state.preferences) ? (state.preferences as string[]) : [];
  const avoid = Array.isArray(state.avoid) ? (state.avoid as string[]) : [];
  if (facts.length) L.push(`Fatos ativos: ${facts.slice(0, 12).join(" | ")}`);
  if (prefs.length) L.push(`Preferências: ${prefs.join(" | ")}`);
  if (avoid.length) L.push(`EVITAR (aprendido com recusas): ${avoid.join(" | ")}`);

  const exec = (b.context?.execution_profile ?? {}) as Record<string, unknown>;
  if (Object.keys(exec).length) {
    L.push(`Padrão de execução: ${JSON.stringify(exec).slice(0, 400)}`);
  }

  if (b.magnetic) {
    L.push("");
    L.push("DOSSIÊ MAGNÉTICO:");
    for (const [k, v] of Object.entries(b.magnetic)) {
      if (v && typeof v === "object") L.push(`- ${k}: ${JSON.stringify(v).slice(0, 350)}`);
      else if (typeof v === "string" && v.trim()) L.push(`- ${k}: ${v.slice(0, 250)}`);
    }
  }

  if (b.arcs.length) {
    L.push("");
    L.push("ARCOS ATIVOS (objetivos em andamento):");
    for (const a of b.arcs) {
      const prog = Array.isArray(a.progress) ? (a.progress as unknown[]).slice(-3) : [];
      L.push(
        `- id=${a.id} | ${a.title} | objetivo: ${a.objective ?? "—"} | gargalo: ${a.bottleneck ?? "—"}${prog.length ? ` | avanços: ${JSON.stringify(prog).slice(0, 300)}` : ""}`,
      );
    }
  }

  const reflByDate = new Map(b.reflections.map((r) => [r.reflected_for, r]));
  if (b.plans.length) {
    L.push("");
    L.push("HISTÓRICO DE MAG METAS (mais recente primeiro) + resultado:");
    for (const pl of b.plans) {
      const r = pl.meta_date ? reflByDate.get(pl.meta_date) : undefined;
      const outcome = r
        ? r.outcome === "done"
          ? "executou"
          : r.outcome === "partial"
            ? "parcial"
            : r.outcome === "blocked"
              ? "travou"
              : "pulou"
        : pl.completed_at
          ? "executou"
          : "sem registro";
      L.push(
        `- ${pl.meta_date} [${outcome}] (${pl.strategy_key ?? "?"}) ${pl.priority_title} — ${pl.first_action ?? ""}${r?.note ? ` | nota: ${r.note.slice(0, 160)}` : ""}${r?.activity_text ? ` | relato: ${r.activity_text.slice(0, 160)}` : ""}`,
      );
    }
  }

  const liked = b.feedbacks.filter((f) => f.feedback === "liked");
  const disliked = b.feedbacks.filter((f) => f.feedback === "disliked");
  if (liked.length || disliked.length) {
    L.push("");
    L.push("REAÇÕES A DIREÇÕES ANTERIORES:");
    if (liked.length) L.push(`Funcionaram/gostou: ${liked.slice(0, 8).map((f) => f.goal_title).join(" | ")}`);
    if (disliked.length)
      L.push(
        `Recusou (aprenda o motivo e não repita a abordagem): ${disliked
          .slice(0, 8)
          .map((f) => `${f.goal_title}${f.goal_context ? ` (motivo: ${String(f.goal_context).slice(0, 120)})` : ""}`)
          .join(" | ")}`,
      );
  }

  if (b.impacts.length) {
    L.push("");
    L.push("IMPACTOS REGISTRADOS PELO USUÁRIO:");
    for (const i of b.impacts.slice(0, 5)) {
      L.push(`- ${i.direction_title ?? "—"}: ${i.useful ? "útil" : "não útil"}${i.outcome_text ? ` — ${i.outcome_text.slice(0, 160)}` : ""}`);
    }
  }

  if (b.saved.length) {
    L.push("");
    L.push(
      "DIREÇÕES SALVAS PELO USUÁRIO (sinal de interesse, NÃO são metas aceitas — só entregue algo nessa linha se casar com o gargalo, o objetivo e o momento atual):",
    );
    for (const s of b.saved.slice(0, 6)) {
      L.push(`- ${String(s.direction_text).slice(0, 180)}`);
    }
  }

  if (b.efficacy.size) {
    const top = [...b.efficacy.entries()]
      .filter(([, v]) => v.total >= 4)
      .map(([k, v]) => `${k}: ${Math.round((v.positive / v.total) * 100)}% de resultado`)
      .slice(0, 8);
    if (top.length) {
      L.push("");
      L.push(
        "EVIDÊNCIA AGREGADA (anônima, de profissionais em contexto semelhante — usar como sinal, nunca copiar cegamente):",
      );
      L.push(top.join(" | "));
    }
  }

  if (rejectionNote) {
    L.push("");
    L.push(`TENTATIVA ANTERIOR REJEITADA: ${rejectionNote}`);
    L.push("Gere candidatas materialmente diferentes, mais específicas e ancoradas no contexto real.");
  }

  L.push("");
  L.push(
    "Produza a leitura do momento, a decisão de arco, a atualização de contexto e 3 candidatas de ação.",
  );
  L.push(
    'FORMATO: todos os campos são obrigatórios. Preencha também o objeto "orchestration" (significado do objetivo para esta pessoa, domínio principal, domínios complementares, ponto de partida, o que já se sabe, informação crítica faltante, risco: none|care|professional|urgent, se precisa de profissional, e como o avanço será medido). Em cada candidata, "completion_criteria" é o critério verificável de conclusão, "is_diagnostic" indica que a ação serve para entender o ponto de partida antes de prescrever algo, e "next_step_hint" é o próximo passo possível depois dela. Quando não houver valor, use string vazia "" ou lista vazia []. Nunca use null. effort_minutes entre 5 e 120; impact, urgency e executability entre 0 e 10. "mode" deve ser exatamente continuar, aprofundar, adaptar ou mudar_foco. Sempre 3 candidatas.',
  );
  return L.join("\n");
}

/** Pontuação local: continuidade, eficácia, ajuste ao momento, anti-repetição. */
function scoreCandidate(b: MagBundle, cand: Candidate): { score: number; key: string; notes: string[] } {
  const notes: string[] = [];
  const key = strategyKey(`${cand.title} ${cand.description}`);
  let score = cand.impact * 3 + cand.urgency * 2 + cand.executability * 2;

  if (cand.continuity) {
    score += 14;
    notes.push("continuidade de algo em movimento");
  }

  // Consequência do que aconteceu ontem.
  const cont = continuityState(b);
  const mode = normalizeMode(cand.mode);
  if (cont.expected) {
    if (mode === cont.expected) score += 16;
    else if (cont.repeated && mode !== "adaptar") score -= 20;
    else if (cont.expected === "mudar_foco" && mode !== "mudar_foco") score -= 10;
    else score -= 6;
  }
  if (cont.repeated && cand.effort_minutes > 20) {
    score -= 14;
    notes.push("resistência recorrente pede menos fricção");
  }

  // Anti-repetição semântica com as metas recentes.
  let maxSim = 0;
  for (const pl of b.plans.slice(0, 7)) {
    const sim = similarity(`${cand.title} ${cand.description}`, `${pl.priority_title} ${pl.first_action ?? ""}`);
    if (sim > maxSim) maxSim = sim;
    if (pl.strategy_key && pl.strategy_key === key && pl.strategy_key !== "outro") score -= 8;
  }
  if (maxSim > 0.55) {
    score -= 40;
    notes.push("muito parecida com meta recente");
  }

  // Estratégias recusadas pelo usuário.
  for (const f of b.feedbacks) {
    if (f.feedback !== "disliked" || !f.goal_title) continue;
    if (strategyKey(f.goal_title) === key) {
      score -= 18;
      notes.push("estratégia já recusada pelo usuário");
      break;
    }
  }

  // Eficácia agregada anônima.
  score += efficacyBonus(b.efficacy, key);

  // Janela do dia inferida da agenda (sem perguntar nada ao usuário).
  const eventsToday = b.dayEvents?.length ?? 0;
  const openPriorities = (b.dayPriorities ?? []).filter((p) => !p.done).length;
  const budget = eventsToday >= 4 ? 20 : eventsToday >= 2 ? 40 : 60;
  if (cand.effort_minutes > budget) {
    score -= 25;
    notes.push("não cabe na janela real do dia");
  }
  if (openPriorities >= 3 && cand.effort_minutes > 25) score -= 10;

  // Dificuldade adaptativa: quem não vem executando recebe menos fricção.
  const recent = b.reflections.slice(0, 7);
  const executedRate = recent.length
    ? recent.filter((r) => r.outcome === "done" || r.outcome === "partial").length / recent.length
    : 0.5;
  if (executedRate < 0.4 && cand.effort_minutes > 25) score -= 12;
  if (executedRate > 0.7 && cand.effort_minutes >= 30) score += 6;

  // Ancoragem no contexto real.
  score += Math.min(cand.context_elements.length, 3) * 4;
  if (isGeneric(cand.title, cand.description)) {
    score -= 50;
    notes.push("genérica demais");
  }

  return { score, key, notes };
}

const RISK_ORDER: RiskLevel[] = ["none", "care", "professional", "urgent"];

function normalizeRisk(value: unknown): RiskLevel {
  const v = String(value ?? "").toLowerCase().trim();
  return (RISK_ORDER as string[]).includes(v) ? (v as RiskLevel) : "none";
}

function riskMax(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(b) > RISK_ORDER.indexOf(a) ? b : a;
}

function difficultyFor(minutes: number): number {
  if (minutes <= 15) return 1;
  if (minutes <= 35) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

/** Normaliza a saída do modelo: limpa "", clampa números, descarta candidatas quebradas. */
function normalizeDecision(raw: unknown): Decision | null {
  const parsed = DecisionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : min)));
  const candidates = d.candidates
    .filter((c) => c.title.trim().length >= 4 && c.description.trim().length >= 12)
    .map((c) => ({
      ...c,
      title: c.title.trim().slice(0, 140),
      description: c.description.trim().slice(0, 480),
      strategic_reason: c.strategic_reason.trim().slice(0, 600),
      arc_title: (c.arc_title.trim() || "direção").slice(0, 80),
      mode: normalizeMode(c.mode) ?? (c.continuity ? "continuar" : "mudar_foco"),
      effort_minutes: clamp(c.effort_minutes, 5, 120),
      impact: clamp(c.impact, 0, 10),
      urgency: clamp(c.urgency, 0, 10),
      executability: clamp(c.executability, 0, 10),
      context_elements: (c.context_elements ?? []).filter((x) => x.trim()).slice(0, 4),
      completion_criteria: (c.completion_criteria ?? "").trim().slice(0, 200),
      next_step_hint: (c.next_step_hint ?? "").trim().slice(0, 200),
    }));
  if (!candidates.length) return null;
  return { ...d, candidates };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").split("```").join("\n");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runDecision(b: MagBundle, key: string, rejectionNote?: string): Promise<Decision> {
  const gateway = createLovableAiGatewayProvider(key);
  const prompt = bundleToPrompt(b, rejectionNote);
  const lang = languageInstruction(
    (b.profile as { language?: string | null } | null | undefined)?.language ?? null,
  );
  try {
    const result = await generateObject({
      model: gateway(MODEL),
      schema: DecisionSchema,
      system: FULL_SYSTEM + lang,
      prompt,
    });
    const normalized = normalizeDecision(result.object);
    if (normalized) return normalized;
    throw new Error("saída fora do formato esperado");
  } catch (err) {
    // Structured output falhou: tenta JSON livre antes de desistir.
    console.warn("[mag-engine] structured output falhou, tentando JSON livre", err);
    const result = await generateText({
      model: gateway(MODEL),
      system: FULL_SYSTEM + lang,
      prompt: `${prompt}\n\nResponda APENAS com um JSON válido neste formato (sem markdown, sem comentários):\n{"reading":{"active_objective":"","bottleneck":"","recent_events":"","open_threads":[],"what_worked":"","what_failed":""},"arc":{"continue_arc_id":"","close_arc_id":"","close_reason":"","new_arc_title":"","new_arc_objective":""},"context_update":{"facts":[],"preferences":[],"avoid":[],"narrative":""},"orchestration":{"goal_meaning":"","primary_domain":"","supporting_domains":[],"starting_point":"","known_context":[],"missing_critical":[],"risk_level":"none","needs_professional":false,"professional_note":"","progress_measure":""},"candidates":[{"title":"","description":"","strategic_reason":"","arc_title":"","continuity":false,"mode":"continuar","parent_meta_date":"","expected_signal":"","effort_minutes":20,"context_elements":[],"impact":7,"urgency":7,"executability":8,"completion_criteria":"","is_diagnostic":false,"next_step_hint":""}]}`,
    });
    const normalized = normalizeDecision(extractJson(result.text));
    if (!normalized) throw new Error("modelo não devolveu decisão válida");
    return normalized;
  }
}

/**
 * Regra de ouro: só entrega quando é possível responder
 * "por que ESTA direção, para ESTA pessoa, neste MOMENTO, depois do que aconteceu ANTES".
 */
export async function decideTodayMeta(
  db: Db,
  userId: string,
  localDate: string,
): Promise<DecidedMeta | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const bundle = await loadBundle(db, userId, localDate);

  let decision: Decision | null = null;
  let best: { cand: Candidate; score: number; key: string } | null = null;
  let verdict: ReturnType<typeof evaluateDirection> | null = null;

  const budgetMinutes =
    (bundle.dayEvents?.length ?? 0) >= 4 ? 20 : (bundle.dayEvents?.length ?? 0) >= 2 ? 40 : 60;
  const recentTitles = bundle.allPlans
    .slice(0, 7)
    .map((p) => `${p.priority_title} ${p.first_action ?? ""}`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let d: Decision;
    try {
      d = await runDecision(
        bundle,
        apiKey,
        attempt === 0
          ? undefined
          : best
            ? `A melhor candidata anterior foi rejeitada: ${[...scoreCandidate(bundle, best.cand).notes, ...(verdict?.reasons ?? [])].join("; ") || "não passou no teste de unicidade"}.`
            : "As candidatas anteriores foram genéricas ou repetidas.",
      );
    } catch (err) {
      console.error("[mag-engine] decisão falhou", err);
      break;
    }
    decision = d;
    const ranked = d.candidates
      .map((cand) => ({ cand, ...scoreCandidate(bundle, cand) }))
      .sort((a, z) => z.score - a.score);
    const top = ranked[0];
    if (!top) break;
    best = { cand: top.cand, score: top.score, key: top.key };

    // Avaliação automática de qualidade: relevância, clareza, segurança,
    // continuidade, encaixe na rotina e possibilidade de acompanhamento.
    const orch = d.orchestration;
    verdict = evaluateDirection({
      title: top.cand.title,
      description: top.cand.description,
      reason: top.cand.strategic_reason,
      contextElements: top.cand.context_elements,
      minutes: top.cand.effort_minutes,
      budgetMinutes,
      hasFocus: Boolean(bundle.weeklyFocus),
      focusText: bundle.weeklyFocus?.interpreted ?? null,
      riskLevel: normalizeRisk(orch?.risk_level),
      needsProfessional: orch?.needs_professional === true,
      missingCritical: (orch?.missing_critical ?? []).filter((x) => x.trim()),
      isDiagnostic: top.cand.is_diagnostic === true,
      recentTitles,
      hasCompletionCriteria: (top.cand.completion_criteria ?? "").trim().length > 3,
    });

    if (!verdict.blocked && top.score >= 45 && top.notes.length === 0) break;
  }

  if (!decision || !best) return null;

  const orch = decision.orchestration;
  const modelRisk = normalizeRisk(orch?.risk_level);
  const localRisk = readSafety(
    `${best.cand.title} ${best.cand.description} ${bundle.weeklyFocus?.interpreted ?? ""} ${bundle.profile?.goal ?? ""}`,
  );
  const riskLevel = riskMax(modelRisk, localRisk.level);
  const needsProfessional =
    orch?.needs_professional === true || riskLevel === "professional" || riskLevel === "urgent";

  const arcId = await resolveArc(db, userId, bundle, decision, best.cand);
  await persistContext(db, userId, bundle, decision);

  const parent =
    best.cand.continuity && best.cand.parent_meta_date
      ? (bundle.plans.find((p) => p.meta_date === best!.cand.parent_meta_date)?.id ?? null)
      : (bundle.plans[0]?.id ?? null);

  const cont = continuityState(bundle);
  const mode = normalizeMode(best.cand.mode);
  const continuityMode: ContinuityMode | null = cont.lastPlan ? (mode ?? cont.expected) : null;

  // Valida a justificativa: cada frase precisa ter relação direta com esta
  // direção e com o contexto real. Frases com termos inventados são removidas.
  const safeReason =
    sanitizeStrategicReason(best.cand.strategic_reason, {
      direction: `${best.cand.title} ${best.cand.description}`,
      contextText: bundleToPrompt(bundle),
    }) ??
    fallbackStrategicReason({
      name: bundle.profile?.full_name ?? null,
      goal: bundle.profile?.goal ?? null,
      minutes: best.cand.effort_minutes,
    });

  // Limite explícito e acolhedor quando o tema exige avaliação humana.
  const escalation =
    needsProfessional && (localRisk.note || orch?.professional_note?.trim())
      ? (localRisk.note ?? orch.professional_note.trim())
      : null;
  const finalReason = escalation ? `${safeReason} ${escalation}`.slice(0, 900) : safeReason;

  // Lógica adaptativa global: classifica a ação, monta a interface de execução
  // dentro da iMAG e remove orientações para ferramentas externas desnecessárias.
  let interaction = resolveInteraction(best.cand.title, best.cand.description);
  const interactionText = `${interaction.title} ${interaction.description ?? ""}`;
  if (!validateInteraction(interactionText, { type: interaction.type, config: interaction.config })) {
    // Interface incoerente com a instrução: cai para resposta aberta segura.
    interaction = resolveInteraction(`Registre sua resposta: ${interaction.title}`, interaction.description);
  }

  // Validador obrigatório: nada corrompido, genérico ou vago chega à interface.
  const finalTitle = interaction.title || best.cand.title;
  const finalDescription = interaction.description || best.cand.description;
  const check = validateDirection({
    title: finalTitle,
    description: finalDescription,
    reason: finalReason,
    focusText: bundle.weeklyFocus?.interpreted ?? null,
  });
  if (!check.ok) {
    console.warn("[mag-engine] direção reprovada na validação", check.reasons);
    return null;
  }

  return {
    title: finalTitle,
    description: finalDescription,
    strategic_reason: finalReason,
    interaction_type: interaction.type,
    interaction_config: interaction.config,
    risk_level: riskLevel,
    needs_professional: needsProfessional,
    orchestration: {
      goal_meaning: orch?.goal_meaning ?? "",
      primary_domain: orch?.primary_domain ?? "",
      supporting_domains: orch?.supporting_domains ?? [],
      starting_point: orch?.starting_point ?? "",
      known_context: orch?.known_context ?? [],
      missing_critical: orch?.missing_critical ?? [],
      progress_measure: orch?.progress_measure ?? "",
      professional_note: escalation,
      completion_criteria: best.cand.completion_criteria ?? "",
      next_step_hint: best.cand.next_step_hint ?? "",
      is_diagnostic: best.cand.is_diagnostic === true,
      quality: verdict ? { scores: verdict.scores, total: verdict.total, reasons: verdict.reasons } : null,
      weekly_focus: bundle.weeklyFocus?.interpreted ?? null,
    },


    arc_id: arcId,
    parent_plan_id: best.cand.continuity ? parent : null,
    strategy_key: best.key,
    expected_signal: best.cand.expected_signal || null,
    difficulty: difficultyFor(best.cand.effort_minutes),
    continuity_mode: continuityMode,
    decision: {
      reading: decision.reading,
      chosen: {
        score: best.score,
        continuity: best.cand.continuity,
        mode: continuityMode,
        mode_label: continuityLabel(continuityMode),
        previous: cont.lastPlan
          ? { date: cont.lastPlan.meta_date, title: cont.lastPlan.priority_title, outcome: cont.lastRefl?.outcome ?? null }
          : null,
        elements: best.cand.context_elements,
      },
      candidates: decision.candidates.map((c) => ({ title: c.title, mode: c.mode, continuity: c.continuity })),
    },
  };
}

async function resolveArc(
  db: Db,
  userId: string,
  bundle: MagBundle,
  decision: Decision,
  cand: Candidate,
): Promise<string | null> {
  const closeId = decision.arc.close_arc_id;
  if (closeId && bundle.arcs.some((a) => a.id === closeId)) {
    await db
      .from("direction_arcs")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_reason: decision.arc.close_reason || "objetivo atingido",
      })
      .eq("id", closeId)
      .eq("user_id", userId);
  }

  const continueId = decision.arc.continue_arc_id;
  if (continueId && continueId !== closeId && bundle.arcs.some((a) => a.id === continueId)) {
    const arc = bundle.arcs.find((a) => a.id === continueId)!;
    const progress = Array.isArray(arc.progress) ? (arc.progress as Array<Record<string, string>>) : [];
    await db
      .from("direction_arcs")
      .update({
        bottleneck: decision.reading.bottleneck,
        progress: [...progress.slice(-9), { date: bundle.localDate, move: cand.title }],
      })
      .eq("id", continueId)
      .eq("user_id", userId);
    return continueId;
  }

  const title = decision.arc.new_arc_title || cand.arc_title;
  const existing = bundle.arcs.find(
    (a) => similarity(a.title, title) > 0.6 && a.id !== closeId,
  );
  if (existing) return existing.id;

  const { data } = await db
    .from("direction_arcs")
    .insert({
      user_id: userId,
      title: title.slice(0, 80),
      objective: decision.arc.new_arc_objective || decision.reading.active_objective,
      bottleneck: decision.reading.bottleneck,
      progress: [{ date: bundle.localDate, move: cand.title }],
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

async function persistContext(db: Db, userId: string, bundle: MagBundle, decision: Decision) {
  const update = decision.context_update;
  const prev = (bundle.context?.state ?? {}) as Record<string, unknown>;
  const merge = (a: unknown, b: string[] | undefined, max: number) => {
    const base = Array.isArray(a) ? (a as string[]) : [];
    return Array.from(new Set([...(b ?? []), ...base])).slice(0, max);
  };

  const recent = bundle.reflections.slice(0, 10);
  const executionProfile = {
    samples: recent.length,
    execution_rate: recent.length
      ? Math.round(
          (recent.filter((r) => r.outcome === "done" || r.outcome === "partial").length / recent.length) * 100,
        )
      : null,
    preferred_effort_minutes: (bundle.dayEvents?.length ?? 0) >= 4 ? 20 : 30,
    open_threads: decision.reading.open_threads,
    what_worked: decision.reading.what_worked || null,
    what_failed: decision.reading.what_failed || null,
  };

  await db.from("professional_context").upsert(
    {
      user_id: userId,
      state: {
        ...prev,
        facts: merge(prev.facts, update?.facts, 24),
        preferences: merge(prev.preferences, update?.preferences, 12),
        avoid: merge(prev.avoid, update?.avoid, 12),
        active_objective: decision.reading.active_objective,
        bottleneck: decision.reading.bottleneck,
        last_events: decision.reading.recent_events,
      },
      narrative: update?.narrative || bundle.context?.narrative || null,
      execution_profile: executionProfile,
      last_built_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/** Registra sinal anônimo de eficácia por tipo de estratégia. */
export async function recordDirectionSignal(
  db: Db,
  input: {
    strategyKey: string;
    profession: string | null;
    objective: string | null;
    executed: boolean;
    positive: boolean | null;
    timeBucket: string | null;
  },
) {
  await db.from("direction_signals").insert({
    strategy_key: input.strategyKey,
    profession: input.profession,
    objective: input.objective,
    executed: input.executed,
    positive: input.positive,
    time_bucket: input.timeBucket,
  });
}

/** Aprende com o resultado de uma meta: atualiza memória viva e o arco. */
export async function learnFromOutcome(
  db: Db,
  userId: string,
  input: {
    planId: string | null;
    outcome: "done" | "partial" | "blocked" | "skipped";
    note?: string | null;
    activity?: string | null;
    date: string;
    signalKey?: string | null;
    signalAnswer?: string | null;
  },
) {
  if (!input.planId) return;
  const [{ data: plan }, { data: profile }, { data: ctx }] = await Promise.all([
    db
      .from("user_plans")
      .select("id, arc_id, strategy_key, priority_title, first_action, expected_signal")
      .eq("id", input.planId)
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("profiles").select("profession, goal").eq("id", userId).maybeSingle(),
    db.from("professional_context").select("state").eq("user_id", userId).maybeSingle(),
  ]);
  if (!plan) return;

  const key = plan.strategy_key ?? strategyKey(`${plan.priority_title} ${plan.first_action ?? ""}`);
  const executed = input.outcome === "done" || input.outcome === "partial";

  await recordDirectionSignal(db, {
    strategyKey: key,
    profession: profile?.profession ?? null,
    objective: profile?.goal ?? null,
    executed,
    positive: input.outcome === "done" ? true : input.outcome === "blocked" ? false : null,
    timeBucket: null,
  });

  const state = (ctx?.state ?? {}) as Record<string, unknown>;
  const facts = Array.isArray(state.facts) ? (state.facts as string[]) : [];
  const event = `${input.date}: ${
    executed ? "executou" : input.outcome === "blocked" ? "travou em" : "não executou"
  } "${plan.priority_title}"${input.activity ? ` — ${input.activity.slice(0, 160)}` : ""}${
    input.note ? ` — ${input.note.slice(0, 160)}` : ""
  }${input.signalAnswer ? ` — ${input.signalKey ?? "sinal"}: ${input.signalAnswer}` : ""}`;

  await db.from("professional_context").upsert(
    {
      user_id: userId,
      state: {
        ...state,
        facts: [event, ...facts].slice(0, 24),
        last_outcome: input.outcome,
        last_signal: input.signalAnswer ? { key: input.signalKey ?? null, answer: input.signalAnswer } : null,
      },
    },
    { onConflict: "user_id" },
  );

  if (plan.arc_id && executed) {
    const { data: arc } = await db
      .from("direction_arcs")
      .select("progress")
      .eq("id", plan.arc_id)
      .eq("user_id", userId)
      .maybeSingle();
    const progress = Array.isArray(arc?.progress) ? (arc!.progress as Array<Record<string, string>>) : [];
    await db
      .from("direction_arcs")
      .update({
        progress: [
          ...progress.slice(-9),
          { date: input.date, result: input.activity ?? input.note ?? input.outcome },
        ],
      })
      .eq("id", plan.arc_id)
      .eq("user_id", userId);
  }
}

/** Aprende com o "não": guarda o motivo para não repetir a abordagem. */
export async function learnFromRejection(
  db: Db,
  userId: string,
  input: { title: string | null; reason: string | null },
) {
  if (!input.title) return;
  const { data: ctx } = await db
    .from("professional_context")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  const state = (ctx?.state ?? {}) as Record<string, unknown>;
  const avoid = Array.isArray(state.avoid) ? (state.avoid as string[]) : [];
  const entry = `${strategyKey(input.title)}${input.reason ? ` — motivo: ${input.reason.slice(0, 120)}` : ""}`;
  await db.from("professional_context").upsert(
    {
      user_id: userId,
      state: { ...state, avoid: Array.from(new Set([entry, ...avoid])).slice(0, 12) },
    },
    { onConflict: "user_id" },
  );
}