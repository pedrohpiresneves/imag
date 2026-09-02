import type { InteractionConfig } from "./mag/interaction";
import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type PlanAction = { id: string; title: string; done: boolean };

export type UserPlan = {
  id: string;
  priority_title: string;
  priority_reason: string | null;
  first_action: string | null;
  next_actions: PlanAction[];
  context_summary: string | null;
  source: string;
  generated_at: string;
  updated_at: string;
  meta_date: string | null;
  status: string;
  completed_at: string | null;
  continuity_mode: string | null;
  interaction_type: string | null;
  interaction_config: InteractionConfig | null;
  started_at: string | null;
  outcome: string | null;
  outcome_at: string | null;
  skip_reason: string | null;
  weekly_focus_id: string | null;
};

function normalizeActions(raw: unknown): PlanAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title : null;
      if (!title) return null;
      return {
        id: typeof obj.id === "string" ? obj.id : `a${i}`,
        title,
        done: obj.done === true,
      } satisfies PlanAction;
    })
    .filter((x): x is PlanAction => x !== null);
}

export const getCurrentPlan = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<UserPlan | null> => {
    const { data, error } = await context.supabase
      .from("user_plans")
      .select(
        "id, priority_title, priority_reason, first_action, next_actions, context_summary, source, generated_at, updated_at, meta_date, status, completed_at, continuity_mode, interaction_type, interaction_config, started_at, outcome, outcome_at, skip_reason, weekly_focus_id",
      )
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .neq("status", "invalidated_by_focus_change")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return rowToPlan(data);
  });

export function rowToPlan(data: {
  id: string;
  priority_title: string;
  priority_reason: string | null;
  first_action: string | null;
  next_actions: unknown;
  context_summary: string | null;
  source: string;
  generated_at: string;
  updated_at: string;
  meta_date?: string | null;
  status?: string | null;
  completed_at?: string | null;
  continuity_mode?: string | null;
  interaction_type?: string | null;
  interaction_config?: unknown;
  started_at?: string | null;
  outcome?: string | null;
  outcome_at?: string | null;
  skip_reason?: string | null;
  weekly_focus_id?: string | null;
}): UserPlan {
  return {
    id: data.id,
    priority_title: data.priority_title,
    priority_reason: data.priority_reason,
    first_action: data.first_action,
    next_actions: normalizeActions(data.next_actions),
    context_summary: data.context_summary,
    source: data.source,
    generated_at: data.generated_at,
    updated_at: data.updated_at,
    meta_date: data.meta_date ?? null,
    status: data.status ?? "active",
    completed_at: data.completed_at ?? null,
    continuity_mode: data.continuity_mode ?? null,
    interaction_type: data.interaction_type ?? null,
    interaction_config: (data.interaction_config as InteractionConfig | null) ?? null,
    started_at: data.started_at ?? null,
    outcome: data.outcome ?? null,
    outcome_at: data.outcome_at ?? null,
    skip_reason: data.skip_reason ?? null,
    weekly_focus_id: data.weekly_focus_id ?? null,
  };
}

// Validates a YYYY-MM-DD local date coming from the client (user's timezone).
const LocalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "local_date deve estar no formato YYYY-MM-DD");

const TodayMetaInput = z.object({
  local_date: LocalDate,
  /** Fuso IANA do dispositivo (auditoria e coerência de virada de dia). */
  timezone: z.string().max(64).optional(),
  /** "Tentar novamente": descarta a direção pendente e gera outra do zero. */
  force: z.boolean().optional(),
});

/**
 * Retorna a MAG Meta do dia (na data local do usuário).
 * Chave da direção: user_id + local_date + weekly_focus_id ativo.
 * Nunca reaproveita direção de outro dia ou de outro foco.
 */
export const getTodayMeta = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => TodayMetaInput.parse(raw))
  .handler(async ({ context, data }): Promise<UserPlan | null> => {
    const localDate = data.local_date;
    const ENGINE_VERSION = "v3_master_logic";
    const CONTEXT_VERSION = "ctx_v1";
    const requestId = crypto.randomUUID();

    const PLAN_SELECT =
      "id, priority_title, priority_reason, first_action, next_actions, context_summary, source, generated_at, updated_at, meta_date, status, completed_at, continuity_mode, interaction_type, interaction_config, started_at, outcome, outcome_at, skip_reason, weekly_focus_id, engine_version";


    // 1. Foco da Semana ativo. Sem foco (ou com foco vencido / em rascunho),
    //    a MAG NÃO gera direção: sem destino claro, qualquer direção seria
    //    genérica. Chat, compromissos e prioridades seguem funcionando.
    const { data: focusRow } = await context.supabase
      .from("weekly_focus")
      .select("id, end_date, interpreted, clarify_question, clarify_answer")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .lte("start_date", localDate)
      .maybeSingle();
    const focus = focusRow as {
      id: string;
      end_date: string;
      interpreted: string | null;
      clarify_question: string | null;
      clarify_answer: string | null;
    } | null;

    const { invalidateOpenDirections } = await import("./mag/focus-invalidate.server");

    // 2. Direção de hoje já existente — só vale se pertencer ao foco ativo,
    //    ao próprio usuário, ao dia atual e não estiver invalidada.
    const existing = await context.supabase
      .from("user_plans")
      .select(PLAN_SELECT)
      .eq("user_id", context.userId)
      .eq("meta_date", localDate)
      .neq("status", "invalidated_by_focus_change")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const plan = rowToPlan(existing.data);
      const finished = plan.completed_at !== null || plan.outcome !== null;
      const sameDay = plan.meta_date === localDate;
      const belongs = sameDay && Boolean(focus) && plan.weekly_focus_id === focus!.id;
      // Concluída: histórico e magnetos preservados, sempre exibida como o dia fechado.
      if (finished && sameDay) return plan;
      if (belongs && !data.force) {

        // Migração segura: direção pendente de um motor antigo passa de novo
        // pelo validador. Só continua na Home se ainda for válida hoje.
        const version = (existing.data as { engine_version?: string | null }).engine_version ?? null;
        if (version === ENGINE_VERSION) return plan;
        const { validateDirection } = await import("./mag/direction-validator");
        const recheck = validateDirection({
          title: plan.priority_title,
          description: plan.first_action ?? "",
          reason: plan.priority_reason ?? "",
          focusText: focus!.interpreted,
        });
        if (recheck.ok) {
          await context.supabase
            .from("user_plans")
            .update({ engine_version: ENGINE_VERSION })
            .eq("id", plan.id)
            .eq("user_id", context.userId);
          return plan;
        }
      }
      // Direção pendente inválida, de outro contexto ou descartada pelo
      // "Tentar novamente": invalida e regenera do zero.
      await invalidateOpenDirections(
        context.supabase,
        context.userId,
        data.force ? "manual_retry" : belongs ? "legacy_engine_revalidation" : "focus_mismatch",
        null,
      );
    }


    if (!focus || focus.end_date < localDate) return null;

    // 2.1 Foco ainda em configuração: a MAG fez uma pergunta essencial e ainda
    //     não tem resposta. Sem entender o foco, nenhuma direção é gerada.
    if (focus.clarify_question && !(focus.clarify_answer ?? "").trim()) return null;

    // 3. Motor de direção contínua: memória viva → gargalo → arco → candidatas → melhor ação.
    const { decideTodayMeta } = await import("./mag/direction-engine.server");
    let decided = null as Awaited<ReturnType<typeof decideTodayMeta>>;
    try {
      decided = await decideTodayMeta(context.supabase, context.userId, localDate);
    } catch (err) {
      console.error("[getTodayMeta] motor de direção falhou", err);
    }

    const { resolveInteraction } = await import("./mag/interaction");
    const { humanizeDirectionTitle } = await import("./mag/humanize-title");
    const { validateDirection } = await import("./mag/direction-validator");
    const { scoreAlignment } = await import("./mag/focus-alignment");
    const { buildPersonalFallback } = await import("./mag/fallback.server");

    const { data: nameRow } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    type Built = {
      title: string;
      description: string;
      strategic_reason: string;
      interaction: { type: string; config: unknown; description: string };
    };

    /** Monta a direção final (texto humano + interface de execução na iMAG). */
    const build = async (source: typeof decided): Promise<Built> => {
      const base = source
        ? {
            title: source.title,
            description: source.description,
            strategic_reason: source.strategic_reason,
          }
        : await buildPersonalFallback(context.supabase, context.userId, localDate, {
            focusText: focus.interpreted ?? focus.clarify_answer ?? null,
            fullName: nameRow?.full_name ?? null,
          });

      const inter = source
        ? { type: source.interaction_type, config: source.interaction_config, description: source.description }
        : (() => {
            const r = resolveInteraction(base.title, base.description);
            return { type: r.type, config: r.config, description: r.description ?? base.description };
          })();
      const title = humanizeDirectionTitle(
        source ? source.title : base.title,
        nameRow?.full_name ?? null,
        `${context.userId}:${localDate}`,
      );
      return {
        title,
        description: inter.description || base.description,
        strategic_reason: base.strategic_reason,
        interaction: inter,
      };
    };

    /** Qualidade + relação funcional real com o foco ativo. */
    const review = (b: Built) => {
      const check = validateDirection({
        title: b.title,
        description: b.description,
        reason: b.strategic_reason,
        focusText: focus.interpreted,
      });
      const alignment = scoreAlignment({
        focusText: focus.interpreted ?? "",
        focusContext: focus.clarify_answer,
        title: b.title,
        description: b.description,
        reason: b.strategic_reason,
      });
      return { ok: check.ok && alignment.ok, reasons: [...check.reasons, alignment.why], alignment };
    };

    // Validador obrigatório: nada corrompido, genérico, vago, de outra conta
    // ou desalinhado do foco chega à interface.
    let built = await build(decided);
    let check = review(built);
    if (!check.ok && decided) {
      console.warn("[getTodayMeta] direção reprovada, tentando outra rota", check.reasons);
      decided = null;
      built = await build(null);
      check = review(built);
    }
    if (!check.ok) {
      console.error("[getTodayMeta] direção reprovada", check.reasons);
      throw new Error("DIRECTION_INVALID");
    }

    const generated = {
      title: built.title,
      description: built.description,
      strategic_reason: built.strategic_reason,
    };
    const interaction = built.interaction;
    const humanTitle = built.title;

    // 3.1 Concorrência: enquanto a IA gerava, o foco pode ter mudado.
    //     Nesse caso a resposta antiga é descartada — nunca salva, nunca exibida.
    const { data: stillRow } = await context.supabase
      .from("weekly_focus")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!stillRow || (stillRow as { id: string }).id !== focus.id) return null;

    const { data: fresher } = await context.supabase
      .from("user_plans")
      .select(PLAN_SELECT)
      .eq("user_id", context.userId)
      .eq("meta_date", localDate)
      .eq("weekly_focus_id", focus.id)
      .neq("status", "invalidated_by_focus_change")
      .maybeSingle();
    if (fresher) return rowToPlan(fresher);

    // 4. Salva (upsert protegido pela unique constraint em corrida).
    const insert = await context.supabase
      .from("user_plans")
      .insert({
        user_id: context.userId,
        priority_title: humanTitle,
        priority_reason: generated.strategic_reason,
        first_action: interaction.description || generated.description,
        interaction_type: interaction.type,
        interaction_config: interaction.config as never,
        next_actions: [],
        source: "mag",
        meta_date: localDate,
        status: "active",
        is_active: true,
        arc_id: decided?.arc_id ?? null,
        parent_plan_id: decided?.parent_plan_id ?? null,
        strategy_key: decided?.strategy_key ?? null,
        expected_signal: decided?.expected_signal ?? null,
        difficulty: decided?.difficulty ?? null,
        decision: (decided?.decision ?? null) as never,
        continuity_mode: decided?.continuity_mode ?? null,
        weekly_focus_id: focus.id,
        weekly_focus_text: focus.interpreted ?? null,
        timezone: data.timezone ?? null,
        context_version: CONTEXT_VERSION,
        orchestration: (decided?.orchestration ?? null) as never,
        risk_level: decided?.risk_level ?? null,
        needs_professional: decided?.needs_professional ?? false,
        alignment_score: check.alignment.score,
        engine_version: ENGINE_VERSION,
        request_id: requestId,

      })
      .select(PLAN_SELECT)
      .maybeSingle();

    if (insert.error) {
      // Corrida: outra request já inseriu — relê.
      const retry = await context.supabase
        .from("user_plans")
        .select(PLAN_SELECT)
        .eq("user_id", context.userId)
        .eq("meta_date", localDate)
        .eq("weekly_focus_id", focus.id)
        .neq("status", "invalidated_by_focus_change")

        .maybeSingle();
      if (retry.data) return rowToPlan(retry.data);
      throw new Error(insert.error.message);
    }
    if (!insert.data) return null;

    // Foco de uso único: já influenciou esta direção, encerra automaticamente.
    await context.supabase
      .from("user_focus_shifts")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("status", "active")
      .eq("duration", "next");

    return rowToPlan(insert.data);

  });


/**
 * Marca a meta de hoje como concluída (idempotente).
 */
export const completeTodayMeta = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => TodayMetaInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: plan, error: planError } = await context.supabase
      .from("user_plans")
      .select("id")
      .eq("user_id", context.userId)
      .eq("meta_date", data.local_date)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan) throw new Error("Direção do dia não encontrada");

    // Operação atômica: conclui a direção e credita os Magnetos uma única vez.
    const { data: result, error } = await context.supabase.rpc(
      "complete_direction_with_reward",
      { _plan_id: plan.id },
    );
    if (error) throw new Error(error.message);
    const res = (result ?? {}) as { awarded?: boolean; amount?: number; balance?: number };
    return {
      ok: true,
      awarded: res.awarded === true,
      amount: res.amount ?? 0,
      balance: res.balance ?? 0,
    };
  });


const UpsertPlan = z.object({
  priority_title: z.string().min(3).max(200),
  priority_reason: z.string().max(1000).optional().nullable(),
  first_action: z.string().max(500).optional().nullable(),
  next_actions: z
    .array(z.object({ title: z.string().min(1).max(280) }))
    .max(6)
    .default([]),
  context_summary: z.string().max(4000).optional().nullable(),
  source: z.enum(["mag", "manual"]).default("mag"),
});

export const upsertCurrentPlan = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => UpsertPlan.parse(raw))
  .handler(async ({ context, data }) => {
    // Deactivate previous plans so the "current" plan is always unambiguous.
    await context.supabase
      .from("user_plans")
      .update({ is_active: false })
      .eq("user_id", context.userId)
      .eq("is_active", true);
    const actions = data.next_actions.map((a, i) => ({
      id: `a${Date.now()}-${i}`,
      title: a.title,
      done: false,
    }));
    const { data: inserted, error } = await context.supabase
      .from("user_plans")
      .insert({
        user_id: context.userId,
        priority_title: data.priority_title,
        priority_reason: data.priority_reason ?? null,
        first_action: data.first_action ?? null,
        next_actions: actions,
        context_summary: data.context_summary ?? null,
        source: data.source,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

const ToggleAction = z.object({
  plan_id: z.string().uuid(),
  action_id: z.string().min(1),
  done: z.boolean(),
});

export const toggleActionDone = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => ToggleAction.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: plan, error: readError } = await context.supabase
      .from("user_plans")
      .select("id, next_actions")
      .eq("id", data.plan_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!plan) throw new Error("Plano não encontrado");
    const actions = normalizeActions(plan.next_actions).map((a) =>
      a.id === data.action_id ? { ...a, done: data.done } : a,
    );
    const { error } = await context.supabase
      .from("user_plans")
      .update({ next_actions: actions })
      .eq("id", plan.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveCurrentPlan = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_plans")
      .update({ is_active: false })
      .eq("user_id", context.userId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/* ───────────────────────── Máquina de estados da direção ─────────────────────────
   pendente → em andamento → concluída | feita em parte | não realizada.
   Todos os estados são persistidos: recarregar a página preserva a situação. */

const PlanRef = z.object({ plan_id: z.string().uuid() });

/** Usuário tocou em "Começar agora": registra o início real da execução. */
export const startDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => PlanRef.parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_plans")
      .update({ started_at: new Date().toISOString() })
      .eq("id", data.plan_id)
      .eq("user_id", context.userId)
      .is("started_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Fiz em parte": progresso real preservado, magnetos proporcionais. */
export const markDirectionPartial = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    PlanRef.extend({ note: z.string().trim().max(200).optional() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    if (data.note) {
      await context.supabase
        .from("user_plans")
        .update({ skip_reason: data.note })
        .eq("id", data.plan_id)
        .eq("user_id", context.userId);
    }
    const { data: result, error } = await context.supabase.rpc(
      "partial_direction_with_reward",
      { _plan_id: data.plan_id },
    );
    if (error) throw new Error(error.message);
    const res = (result ?? {}) as { awarded?: boolean; amount?: number; balance?: number };
    return { ok: true, awarded: res.awarded === true, amount: res.amount ?? 0, balance: res.balance ?? 0 };
  });

/** "Não consegui": nunca punitivo — guarda o motivo para adaptar as próximas. */
export const markDirectionSkipped = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    PlanRef.extend({
      reason: z.string().min(2).max(120),
      note: z.string().trim().max(200).optional(),
    }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const note = data.note?.trim();
    const { error } = await context.supabase
      .from("user_plans")
      .update({
        outcome: "skipped",
        outcome_at: new Date().toISOString(),
        skip_reason: (note ? `${data.reason} — ${note}` : data.reason).slice(0, 200),
      })
      .eq("id", data.plan_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registro de adaptação — usado antes de levar o usuário para a MAG. */
export const markDirectionAdapted = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    PlanRef.extend({ note: z.string().max(200).optional().nullable() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_plans")
      .update({ adapted_at: new Date().toISOString(), skip_reason: data.note?.trim() || null })
      .eq("id", data.plan_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
