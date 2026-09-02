import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Memória comportamental contínua da MAG.
 *
 * Princípio: "A MAG pergunta pouco, observa muito e aprende sempre."
 * - Sinais (mag_signals) são registrados durante o uso normal do app.
 * - Fatos (mag_memory) são derivados desses sinais e evoluem quando o
 *   comportamento muda (confiança sobe/desce, valor é reescrito).
 * - Perguntas (mag_memory_questions) só aparecem quando há lacuna real.
 */

export type MemoryFact = {
  id: string;
  key: string;
  category: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
  evidence_count: number;
  updated_at: string;
};

type Db = SupabaseClient<never, never, never>;

const HOUR_LABELS: Array<[number, number, string]> = [
  [5, 11, "manhã"],
  [12, 17, "tarde"],
  [18, 22, "noite"],
];

function periodOf(hour: number): string {
  for (const [a, b, l] of HOUR_LABELS) if (hour >= a && hour <= b) return l;
  return "madrugada";
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Grava um sinal comportamental. Nunca lança — observar não pode quebrar o app. */
export async function recordSignal(
  db: Db,
  userId: string,
  input: { kind: string; subject?: string | null; value?: Record<string, unknown>; local_date?: string | null },
): Promise<void> {
  try {
    const now = new Date();
    await (db as any).from("mag_signals").insert({
      user_id: userId,
      kind: input.kind.slice(0, 60),
      subject: (input.subject ?? null)?.toString().slice(0, 200) ?? null,
      value: input.value ?? {},
      local_date: input.local_date ?? null,
      hour: now.getUTCHours(),
    });
  } catch {
    /* silencioso por design */
  }
}

/** Cria ou evolui um fato aprendido. */
export async function upsertFact(
  db: Db,
  userId: string,
  fact: {
    key: string;
    category: string;
    label: string;
    value: string;
    confidence?: number;
    source?: string;
    evidence_count?: number;
  },
): Promise<void> {
  const { data: existing } = await (db as any)
    .from("mag_memory")
    .select("id, value, status, source, evidence_count")
    .eq("user_id", userId)
    .eq("key", fact.key)
    .maybeSingle();

  // Correções do próprio usuário têm prioridade sobre observação automática.
  if (existing && existing.source === "user" && (fact.source ?? "observed") === "observed") return;
  if (existing && existing.status === "removed" && (fact.source ?? "observed") === "observed") return;

  const payload = {
    user_id: userId,
    key: fact.key,
    category: fact.category,
    label: fact.label,
    value: fact.value.slice(0, 300),
    confidence: Math.max(0.1, Math.min(1, fact.confidence ?? 0.6)),
    source: fact.source ?? "observed",
    evidence_count: fact.evidence_count ?? 1,
    status: "active",
  };

  if (existing) {
    await (db as any).from("mag_memory").update(payload).eq("id", existing.id);
  } else {
    await (db as any).from("mag_memory").insert(payload);
  }
}

/** Lê os fatos ativos, mais confiáveis primeiro. */
export async function loadMemoryFacts(db: Db, userId: string): Promise<MemoryFact[]> {
  const { data } = await (db as any)
    .from("mag_memory")
    .select("id, key, category, label, value, confidence, source, evidence_count, updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(40);
  return (data ?? []) as MemoryFact[];
}

/** Bloco de prompt com o que a MAG já aprendeu observando o usuário. */
export function buildMemoryBlock(facts: MemoryFact[]): string {
  if (!facts.length) return "";
  const lines = [
    "",
    "MEMÓRIA COMPORTAMENTAL (aprendida observando o uso; use para personalizar, nunca para expor dados):",
  ];
  for (const f of facts.slice(0, 20)) {
    const conf = f.confidence >= 0.75 ? "alta" : f.confidence >= 0.5 ? "média" : "baixa";
    lines.push(`- ${f.label}: ${f.value} (confiança ${conf})`);
  }
  lines.push(
    "Use esses padrões para calibrar horário sugerido, tamanho da ação e linguagem. Nunca diga 'segundo seus dados' nem repita perguntas cuja resposta já está aqui. Se o comportamento recente contradisser a memória, siga o comportamento recente.",
  );
  return lines.join("\n");
}

/**
 * Deriva fatos a partir dos sinais e do histórico real.
 * Idempotente: pode rodar sempre que a memória for lida.
 */
export async function deriveFacts(db: Db, userId: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

  const [{ data: signals }, { data: plans }, { data: tasks }] = await Promise.all([
    (db as any)
      .from("mag_signals")
      .select("kind, subject, value, hour, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(400),
    (db as any)
      .from("user_plans")
      .select("status, completed_at, meta_date, outcome")
      .eq("user_id", userId)
      .not("meta_date", "is", null)
      .order("meta_date", { ascending: false })
      .limit(45),
    (db as any)
      .from("day_priorities")
      .select("done, day_date")
      .eq("user_id", userId)
      .order("day_date", { ascending: false })
      .limit(120),
  ]);

  const sig = (signals ?? []) as Array<{ kind: string; subject: string | null; hour: number | null; created_at: string }>;
  const pl = (plans ?? []) as Array<{ status: string | null; completed_at: string | null; meta_date: string | null }>;
  const tk = (tasks ?? []) as Array<{ done: boolean | null }>;

  // 1. Horário em que costuma agir.
  const hours = [
    ...sig.filter((s) => s.hour != null).map((s) => s.hour as number),
    ...pl.filter((p) => p.completed_at).map((p) => new Date(p.completed_at as string).getUTCHours()),
  ].map((h) => (h - 3 + 24) % 24); // America/Sao_Paulo
  if (hours.length >= 6) {
    const counts = new Map<string, number>();
    for (const h of hours) counts.set(periodOf(h), (counts.get(periodOf(h)) ?? 0) + 1);
    const [period, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    await upsertFact(db, userId, {
      key: "ritmo.periodo_ativo",
      category: "ritmo",
      label: "Período em que costuma agir",
      value: period,
      confidence: Math.min(0.9, 0.4 + n / hours.length),
      evidence_count: hours.length,
    });
  }

  // 2. Dias mais consistentes.
  const doneDates = pl.filter((p) => p.status === "completed" && p.meta_date).map((p) => p.meta_date as string);
  if (doneDates.length >= 5) {
    const counts = new Map<number, number>();
    for (const d of doneDates) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      counts.set(wd, (counts.get(wd) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => WEEKDAYS[w]);
    await upsertFact(db, userId, {
      key: "ritmo.dias_fortes",
      category: "ritmo",
      label: "Dias em que rende mais",
      value: top.join(" e "),
      confidence: 0.6,
      evidence_count: doneDates.length,
    });
  }

  // 3. Taxa de conclusão das direções (tamanho ideal da ação).
  const withOutcome = pl.filter((p) => p.status === "completed" || p.status === "skipped");
  if (withOutcome.length >= 6) {
    const rate = withOutcome.filter((p) => p.status === "completed").length / withOutcome.length;
    await upsertFact(db, userId, {
      key: "execucao.taxa_conclusao",
      category: "execucao",
      label: "Constância nas direções",
      value:
        rate >= 0.75
          ? "conclui quase sempre — aceita direções um pouco mais ambiciosas"
          : rate >= 0.4
            ? "conclui na maioria dos dias — mantenha direções curtas"
            : "conclui poucas vezes — reduza a direção ao menor passo possível",
      confidence: Math.min(0.9, 0.4 + withOutcome.length / 30),
      evidence_count: withOutcome.length,
    });
  }

  // 4. Relação com tarefas do dia.
  if (tk.length >= 10) {
    const rate = tk.filter((t) => t.done).length / tk.length;
    await upsertFact(db, userId, {
      key: "execucao.tarefas",
      category: "execucao",
      label: "Uso das tarefas do dia",
      value:
        rate >= 0.7
          ? "risca quase tudo o que anota"
          : rate >= 0.35
            ? "conclui parte do que anota"
            : "anota mais do que consegue concluir",
      confidence: 0.6,
      evidence_count: tk.length,
    });
  }

  // 5. Áreas que mais usa no app.
  const areaCounts = new Map<string, number>();
  for (const s of sig) {
    if (s.kind === "area_used" && s.subject) areaCounts.set(s.subject, (areaCounts.get(s.subject) ?? 0) + 1);
  }
  if (areaCounts.size) {
    const top = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top[0][1] >= 3) {
      await upsertFact(db, userId, {
        key: "preferencia.areas",
        category: "preferencia",
        label: "Áreas que mais acompanha",
        value: top.map(([a]) => a).join(", "),
        confidence: 0.65,
        evidence_count: top.reduce((s, [, n]) => s + n, 0),
      });
    }
  }

  // 6. Preferência por registrar por escrito.
  const written = sig.filter((s) => s.kind === "direction_response").length;
  if (written >= 3) {
    await upsertFact(db, userId, {
      key: "preferencia.registro",
      category: "preferencia",
      label: "Forma de registrar",
      value: "gosta de escrever a resposta dentro do card da direção",
      confidence: 0.6,
      evidence_count: written,
    });
  }
}

/** Banco de perguntas curtas — só uma lacuna por vez, nunca questionário. */
const QUESTION_BANK: Array<{ key: string; category: string; label: string; question: string; options: string[] }> = [
  {
    key: "preferencia.janela_ideal",
    category: "preferencia",
    label: "Melhor janela do dia",
    question: "Qual é a melhor hora do seu dia para agir?",
    options: ["Manhã", "Tarde", "Noite", "Varia muito"],
  },
  {
    key: "preferencia.tamanho_direcao",
    category: "preferencia",
    label: "Tamanho ideal da direção",
    question: "Você prefere direções bem pequenas ou um pouco mais desafiadoras?",
    options: ["Bem pequenas", "Equilibradas", "Mais desafiadoras"],
  },
  {
    key: "preferencia.tom",
    category: "preferencia",
    label: "Tom que prefere",
    question: "Como você prefere que eu fale com você?",
    options: ["Direta e objetiva", "Acolhedora", "Motivadora"],
  },
  {
    key: "contexto.prioridade_atual",
    category: "contexto",
    label: "O que mais pesa agora",
    question: "O que mais pesa na sua rotina neste momento?",
    options: ["Trabalho", "Dinheiro", "Casa e rotina", "Saúde", "Estudos"],
  },
  {
    key: "preferencia.lembrete",
    category: "preferencia",
    label: "Como quer ser lembrada",
    question: "Prefere que eu te lembre da direção no começo ou no fim do dia?",
    options: ["Começo do dia", "Fim do dia", "Não precisa lembrar"],
  },
];

const COOLDOWN_DAYS = 3;

export type PendingQuestion = { id: string; question: string; options: string[] };

/**
 * Devolve uma pergunta pendente, criando uma nova apenas quando:
 * - há uso real (>= 5 sinais), e
 * - nenhuma pergunta foi feita nos últimos dias, e
 * - existe lacuna com ganho real de contexto.
 */
export async function getOrCreateQuestion(
  db: Db,
  userId: string,
  facts: MemoryFact[],
): Promise<PendingQuestion | null> {
  const { data: pending } = await (db as any)
    .from("mag_memory_questions")
    .select("id, question, options, status, asked_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending) return { id: pending.id, question: pending.question, options: (pending.options ?? []) as string[] };

  const { count: signalCount } = await (db as any)
    .from("mag_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((signalCount ?? 0) < 5) return null;

  const { data: last } = await (db as any)
    .from("mag_memory_questions")
    .select("asked_at")
    .eq("user_id", userId)
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.asked_at && Date.now() - new Date(last.asked_at).getTime() < COOLDOWN_DAYS * 24 * 3600 * 1000) {
    return null;
  }

  const { data: allKeys } = await (db as any)
    .from("mag_memory")
    .select("key")
    .eq("user_id", userId);
  const known = new Set([
    ...facts.map((f) => f.key),
    ...((allKeys ?? []) as Array<{ key: string }>).map((k) => k.key),
  ]);

  const { data: askedRows } = await (db as any)
    .from("mag_memory_questions")
    .select("fact_key")
    .eq("user_id", userId);
  for (const r of (askedRows ?? []) as Array<{ fact_key: string }>) known.add(r.fact_key);

  const next = QUESTION_BANK.find((q) => !known.has(q.key));
  if (!next) return null;

  const { data: created } = await (db as any)
    .from("mag_memory_questions")
    .insert({
      user_id: userId,
      fact_key: next.key,
      question: next.question,
      options: next.options,
    })
    .select("id, question, options")
    .maybeSingle();
  if (!created) return null;
  return { id: created.id, question: created.question, options: (created.options ?? []) as string[] };
}

export function questionMeta(factKey: string) {
  return QUESTION_BANK.find((q) => q.key === factKey) ?? null;
}
