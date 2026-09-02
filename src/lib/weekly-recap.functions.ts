import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { computeScore } from "@/lib/campo-magnetico/score";
import type { Reflection } from "@/lib/reflections.functions";

export type FieldSnapshot = {
  total: number;
  focus: number;
  consistency: number;
  authority: number;
  magnetism: number;
};

export type WeeklyRecap = {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  completed: boolean;
  completedAt: string | null;
  hasData: boolean;
  activeDays: number;
  dayFlags: boolean[]; // segunda → domingo
  received: number;
  executed: number;
  executionPct: number;
  impacts: { text: string; direction: string | null }[];
  mainMovement: string | null;
  field: FieldSnapshot | null;
  prevField: FieldSnapshot | null;
  deltaPct: number | null;
  reading: string[];
  goal: string | null;
  firstName: string | null;
  profession: string | null;
};

export const FOCUS_OPTIONS = [
  "Atrair clientes",
  "Conteúdo",
  "Posicionamento",
  "Organização",
  "Financeiro",
  "Outro",
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Data "hoje" em America/Sao_Paulo (UTC-3, sem horário de verão). */
function nowSaoPaulo(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() - 180) * 60_000);
}

/** Segunda-feira da semana corrente (SP). */
function weekBounds(ref: Date) {
  const day = ref.getDay(); // 0 = domingo
  const backToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(ref);
  start.setDate(start.getDate() - backToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

const MOVEMENT_RULES: Array<{ label: string; re: RegExp }> = [
  {
    label: "Atrair clientes",
    re: /(cliente|lead|prospec|venda|orçamento|agendamento|consulta|paciente|contato|whatsapp|indica)/i,
  },
  { label: "Conteúdo", re: /(post|conteúdo|reels|story|stories|vídeo|carrossel|instagram|publica)/i },
  { label: "Posicionamento", re: /(posicion|autoridade|bio|portfólio|marca|apresenta|depoimento|case)/i },
  { label: "Organização", re: /(organiz|agenda|rotina|processo|planilha|checklist|estrutur)/i },
  { label: "Financeiro", re: /(preço|precifica|financeir|receita|faturamento|custo|cobrança|pagamento)/i },
];

function classifyMovement(texts: string[]): string | null {
  const tally = new Map<string, number>();
  for (const t of texts) {
    for (const rule of MOVEMENT_RULES) {
      if (rule.re.test(t)) tally.set(rule.label, (tally.get(rule.label) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [label, n] of tally) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  return best;
}

function snapshot(s: ReturnType<typeof computeScore>): FieldSnapshot | null {
  if (s.total == null) return null;
  return {
    total: s.total,
    focus: s.focus.value ?? 0,
    consistency: s.consistency.value ?? 0,
    authority: s.authority.value ?? 0,
    magnetism: s.magnetism.value ?? 0,
  };
}

export const getWeeklyRecap = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<WeeklyRecap> => {
    const { supabase, userId } = context;
    const today = nowSaoPaulo();
    const { start, end } = weekBounds(today);
    const weekStart = iso(start);
    const weekEnd = iso(end);
    const weekKey = `weekly_recap:${weekStart}`;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const [reflRes, plansRes, impactsRes, magRes, profRes, stateRes] = await Promise.all([
      supabase
        .from("plan_reflections")
        .select("id, plan_id, outcome, note, energy, reflected_for, created_at, activity_text")
        .eq("user_id", userId)
        .order("reflected_for", { ascending: false }),
      supabase
        .from("user_plans")
        .select("id, priority_title, first_action, status, meta_date, strategy_key")
        .eq("user_id", userId)
        .gte("meta_date", weekStart)
        .lte("meta_date", weekEnd),
      supabase
        .from("direction_impacts")
        .select("outcome_text, direction_title, useful, created_at")
        .eq("user_id", userId)
        .eq("useful", true)
        .gte("created_at", `${weekStart}T00:00:00Z`)
        .order("created_at", { ascending: false }),
      supabase.from("magnetic_profile").select("completeness").eq("user_id", userId).maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, goal, profession, language")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("checklist_state")
        .select("done, updated_at")
        .eq("user_id", userId)
        .eq("item_key", weekKey)
        .maybeSingle(),
    ]);

    const reflections: Reflection[] = (reflRes.data ?? []).map((d) => ({
      id: d.id,
      plan_id: d.plan_id,
      outcome: d.outcome as Reflection["outcome"],
      note: d.note,
      energy: d.energy,
      reflected_for: d.reflected_for,
      created_at: d.created_at,
      activity_text: (d as { activity_text: string | null }).activity_text ?? null,
    }));

    const weekRefl = reflections.filter(
      (r) => r.reflected_for >= weekStart && r.reflected_for <= weekEnd,
    );
    const activeSet = new Set(weekRefl.map((r) => r.reflected_for));
    const dayFlags = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return activeSet.has(iso(d));
    });

    const plans = plansRes.data ?? [];
    const received = plans.length;
    const executedIds = new Set(
      weekRefl.filter((r) => r.outcome === "done" && r.plan_id).map((r) => r.plan_id!),
    );
    const executed = plans.filter(
      (p) => p.status === "completed" || executedIds.has(p.id),
    ).length;
    const executionPct = received > 0 ? Math.round((executed / received) * 100) : 0;

    const impacts = (impactsRes.data ?? [])
      .filter((i) => (i.outcome_text ?? "").trim().length > 0)
      .slice(0, 3)
      .map((i) => ({ text: (i.outcome_text ?? "").trim(), direction: i.direction_title ?? null }));

    const executedTitles = plans
      .filter((p) => p.status === "completed" || executedIds.has(p.id))
      .map((p) => p.priority_title);
    const mainMovement = classifyMovement([
      ...executedTitles,
      ...plans.map((p) => `${p.priority_title} ${p.first_action ?? ""}`),
      ...weekRefl.map((r) => r.activity_text ?? ""),
    ]);

    const completeness = magRes.data?.completeness ?? 0;
    const goal = profRes.data?.goal?.trim() || null;
    const hasClearGoal = !!(goal && goal.length > 3);

    const current = computeScore({
      reflections,
      profileCompleteness: completeness,
      hasClearGoal,
      asOf: today,
    });
    const previous = computeScore({
      reflections,
      profileCompleteness: completeness,
      hasClearGoal,
      asOf: prevEnd,
    });
    const field = snapshot(current);
    const prevField = snapshot(previous);
    const deltaPct =
      field && prevField && prevField.total > 0
        ? Math.round(((field.total - prevField.total) / prevField.total) * 100)
        : field && prevField
          ? field.total - prevField.total
          : null;

    const hasData = received > 0 || weekRefl.length > 0 || impacts.length > 0;

    let reading: string[] = [];
    if (hasData) {
      const { generateWeeklyReading } = await import("./weekly-recap.server");
      reading = await generateWeeklyReading({
        profession: profRes.data?.profession ?? null,
        goal,
        language: profRes.data?.language ?? null,
        activeDays: activeSet.size,
        received,
        executed,
        executionPct,
        impacts: impacts.map((i) => i.text),
        mainMovement,
        fieldDelta: deltaPct,
        executedTitles: executedTitles.slice(0, 6),
        blockedTitles: weekRefl
          .filter((r) => r.outcome === "blocked")
          .map((r) => r.activity_text ?? "")
          .filter(Boolean)
          .slice(0, 3),
      });
    }

    const fullName = profRes.data?.full_name?.trim() ?? null;

    return {
      weekKey,
      weekStart,
      weekEnd,
      completed: !!stateRes.data?.done,
      completedAt: stateRes.data?.done ? (stateRes.data.updated_at ?? null) : null,
      hasData,
      activeDays: activeSet.size,
      dayFlags,
      received,
      executed,
      executionPct,
      impacts,
      mainMovement,
      field,
      prevField,
      deltaPct,
      reading,
      goal,
      firstName: fullName ? fullName.split(/\s+/)[0]! : null,
      profession: profRes.data?.profession ?? null,
    };
  });

export const completeWeeklyRecap = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ weekKey: z.string().min(3) }).parse(raw))
  .handler(async ({ context, data }) => {
    await context.supabase.from("checklist_state").upsert(
      {
        user_id: context.userId,
        item_key: data.weekKey,
        done: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_key" },
    );
    return { ok: true };
  });

const Recalibration = z.object({
  keep: z.boolean(),
  focuses: z.array(z.string().min(2).max(40)).max(2).default([]),
});

export const saveWeeklyRecalibration = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => Recalibration.parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ctx } = await supabase
      .from("professional_context")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    const state = (ctx?.state ?? {}) as Record<string, unknown>;
    const focuses = data.keep ? [] : data.focuses;
    await supabase.from("professional_context").upsert(
      {
        user_id: userId,
        state: {
          ...state,
          week_focus: focuses,
          week_focus_set_at: new Date().toISOString(),
          week_focus_kept: data.keep,
        },
      },
      { onConflict: "user_id" },
    );
    if (!data.keep && focuses.length > 0) {
      await supabase.from("profiles").update({ goal: focuses.join(" + ") }).eq("id", userId);
    }
    return { ok: true };
  });