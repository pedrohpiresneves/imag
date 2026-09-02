import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { daysBetween, interpretFocus, nextMonday, sundayEnd } from "./mag/focus-week";

/**
 * Foco da semana — camada entre o objetivo maior e a Direção do Dia.
 * Regra geral: um único foco principal ativo por usuário, histórico preservado.
 * Quando o usuário traz mais de um objetivo, o foco nasce como rascunho
 * (`status = "draft"`) até ele escolher qual será o principal.
 */
export type WeeklyFocus = {
  id: string;
  raw_text: string;
  interpreted: string;
  main_goal: string | null;
  focus_kind: string;
  start_date: string;
  end_date: string;
  status: string;
  metric_label: string | null;
  metric_target: number | null;
  metric_progress: number;
  advances: number;
  created_at: string;
  /** Pergunta essencial da MAG quando o foco ainda é amplo demais. */
  clarify_question: string | null;
  clarify_options: string[];
  clarify_answer: string | null;
  /** Objetivos identificados quando o texto trouxe mais de uma prioridade. */
  pending_options: string[];
  recommendation: string | null;
};

export type WeeklyFocusView = {
  focus: WeeklyFocus | null;
  /** Direções concluídas ligadas a este foco (avanço real, nunca dias de acesso). */
  completed_directions: number;
  /** Direções feitas em parte ligadas a este foco. */
  partial_directions: number;
  days_left: number;
  needs_review: boolean;
  /** A MAG ainda precisa entender o foco antes de gerar a primeira direção. */
  awaiting_clarification: boolean;
  /** O usuário ainda precisa escolher qual objetivo será o foco principal. */
  awaiting_choice: boolean;
  /** Objetivos guardados para semanas futuras. */
  future_goals: { id: string; text: string }[];
  /** Foco confirmado para começar em uma data futura (ainda sem direção). */
  scheduled: boolean;
};

const SELECT =
  "id, raw_text, interpreted, main_goal, focus_kind, start_date, end_date, status, metric_label, metric_target, metric_progress, advances, created_at, clarify_question, clarify_options, clarify_answer, pending_options, recommendation";

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Foco ativo (ou rascunho) + progresso real das direções relacionadas. */
export const getWeeklyFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ local_date: LocalDate }).parse(raw))
  .handler(async ({ context, data }): Promise<WeeklyFocusView> => {
    const { data: rows, error } = await context.supabase
      .from("weekly_focus")
      .select(SELECT)
      .eq("user_id", context.userId)
      .in("status", ["active", "draft", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const { data: goalRows } = await context.supabase
      .from("future_goals")
      .select("id, text")
      .eq("user_id", context.userId)
      .eq("status", "saved")
      .order("created_at", { ascending: false })
      .limit(5);
    const futureGoals = ((goalRows ?? []) as { id: string; text: string }[]).map((g) => ({
      id: g.id,
      text: g.text,
    }));

    const row = (rows ?? [])[0];
    if (!row) {
      return {
        focus: null,
        completed_directions: 0,
        partial_directions: 0,
        days_left: 0,
        needs_review: false,
        awaiting_clarification: false,
        awaiting_choice: false,
        future_goals: futureGoals,
        scheduled: false,
      };
    }
    let focus = row as WeeklyFocus;

    /* Foco agendado vira ativo sozinho ao chegar a data inicial (fuso local). */
    if (focus.status === "scheduled" && focus.start_date <= data.local_date) {
      const { data: activated } = await context.supabase
        .from("weekly_focus")
        .update({ status: "active" })
        .eq("id", focus.id)
        .eq("user_id", context.userId)
        .select(SELECT)
        .single();
      if (activated) focus = activated as WeeklyFocus;
    }

    const { data: plans } = await context.supabase
      .from("user_plans")
      .select("status, outcome")
      .eq("user_id", context.userId)
      .eq("weekly_focus_id", focus.id);

    const list = (plans ?? []) as { status: string | null; outcome: string | null }[];
    const completed = list.filter(
      (p) => p.status === "completed" || p.outcome === "completed",
    ).length;
    const partial = list.filter((p) => p.outcome === "partial").length;

    const daysLeft = daysBetween(data.local_date, focus.end_date);
    const awaitingChoice =
      focus.status === "draft" || (focus.pending_options ?? []).length > 1;
    return {
      focus,
      completed_directions: completed,
      partial_directions: partial,
      days_left: daysLeft,
      needs_review: !awaitingChoice && daysLeft < 0,
      awaiting_clarification:
        !awaitingChoice &&
        Boolean(focus.clarify_question) &&
        !(focus.clarify_answer ?? "").trim(),
      awaiting_choice: awaitingChoice,
      future_goals: futureGoals,
      scheduled: focus.status === "scheduled",
    };
  });

const SetFocusInput = z.object({
  raw_text: z.string().min(3).max(400),
  start_date: LocalDate,
  /**
   * Período escolhido antes da confirmação:
   * `week` (até domingo), `today` (só hoje) ou `next_week` (segunda a domingo).
   */
  period: z.enum(["week", "today", "next_week"]).default("week"),
  /** Resposta à pergunta essencial, respondida ANTES da confirmação. */
  clarify_answer: z.string().max(400).optional().nullable(),
  main_goal: z.string().max(200).optional().nullable(),
});

/**
 * Cria (ou substitui) o foco. O foco anterior vira histórico e toda direção
 * pendente ligada ao foco antigo é invalidada na mesma operação.
 *
 * Se o texto trouxer mais de um objetivo, o foco nasce como rascunho com as
 * opções identificadas — nenhuma direção é gerada antes da escolha.
 */
export const setWeeklyFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SetFocusInput.parse(raw))
  .handler(async ({ context, data }): Promise<WeeklyFocus> => {
    const { splitGoals, recommendGoal } = await import("./mag/focus-split");
    const { clarificationFor } = await import("./mag/focus-clarify");
    const { invalidateOpenDirections } = await import("./mag/focus-invalidate.server");

    await context.supabase
      .from("weekly_focus")
      .update({ status: "replaced" })
      .eq("user_id", context.userId)
      .in("status", ["active", "draft", "scheduled"]);

    await invalidateOpenDirections(context.supabase, context.userId, "focus_changed");

    const goals = splitGoals(data.raw_text);
    const multiple = goals.length > 1;
    const interpreted = interpretFocus(multiple ? data.raw_text : goals[0] ?? data.raw_text);
    const answer = (data.clarify_answer ?? "").trim();
    const clarify = multiple ? null : clarificationFor(interpreted);
    const recommendation = multiple ? recommendGoal(goals) : null;

    /* Período resolvido no servidor — nunca datas contraditórias. */
    const startDate =
      data.period === "next_week" ? nextMonday(data.start_date) : data.start_date;
    const endDate =
      data.period === "today"
        ? data.start_date
        : data.period === "next_week"
          ? sundayEnd(startDate)
          : sundayEnd(data.start_date);
    const scheduled = startDate > data.start_date;

    const { data: row, error } = await context.supabase
      .from("weekly_focus")
      .insert({
        user_id: context.userId,
        raw_text: data.raw_text.trim(),
        interpreted,
        main_goal: data.main_goal?.trim() || null,
        start_date: startDate,
        end_date: endDate,
        status: multiple ? "draft" : scheduled ? "scheduled" : "active",
        pending_options: (multiple ? goals : []) as never,
        recommendation: recommendation
          ? `${recommendation.choice} — ${recommendation.reason}`
          : null,
        clarify_question: clarify?.question ?? null,
        clarify_options: (clarify?.options ?? []) as never,
        clarify_answer: answer || null,
        clarified_at: answer ? new Date().toISOString() : null,
      })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row as WeeklyFocus;
  });

const ChooseInput = z.object({
  id: z.string().uuid(),
  choice: z.string().min(2).max(200),
  /** Guardar o objetivo não escolhido para uma próxima semana. */
  keep_other: z.boolean().default(false),
});

/**
 * O usuário escolheu o foco principal entre os objetivos identificados.
 * O rascunho vira foco ativo e, se pedido, o outro objetivo é guardado.
 */
export const chooseMainFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => ChooseInput.parse(raw))
  .handler(async ({ context, data }): Promise<WeeklyFocus> => {
    const { clarificationFor } = await import("./mag/focus-clarify");
    const { invalidateOpenDirections } = await import("./mag/focus-invalidate.server");

    const { data: current, error: readErr } = await context.supabase
      .from("weekly_focus")
      .select("id, pending_options")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Foco não encontrado");

    const options = ((current as { pending_options?: unknown }).pending_options ?? []) as string[];
    const choice = interpretFocus(data.choice);
    const others = options.filter((o) => o.toLowerCase() !== choice.toLowerCase());

    if (data.keep_other && others.length) {
      await context.supabase.from("future_goals").insert(
        others.map((text) => ({
          user_id: context.userId,
          text,
          source_focus_id: data.id,
        })),
      );
    }

    const clarify = clarificationFor(choice);

    const { data: row, error } = await context.supabase
      .from("weekly_focus")
      .update({
        interpreted: choice,
        status: "active",
        pending_options: [] as never,
        recommendation: null,
        clarify_question: clarify?.question ?? null,
        clarify_options: (clarify?.options ?? []) as never,
        clarify_answer: null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);

    await invalidateOpenDirections(context.supabase, context.userId, "focus_changed");
    return row as WeeklyFocus;
  });

/** Guarda um objetivo para uma próxima semana, sem ativá-lo. */
export const saveFutureGoal = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ text: z.string().min(2).max(200) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("future_goals")
      .insert({ user_id: context.userId, text: interpretFocus(data.text) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove um objetivo guardado (ou marca como usado ao virar foco). */
export const dropFutureGoal = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("future_goals")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateFocusInput = z.object({
  id: z.string().uuid(),
  interpreted: z.string().min(3).max(200).optional(),
  main_goal: z.string().max(200).optional().nullable(),
  end_date: LocalDate.optional(),
  status: z.enum(["active", "paused", "completed", "partial", "ended"]).optional(),
  end_reason: z.string().max(300).optional().nullable(),
});

/** Ajustar, pausar, concluir ou encerrar — nunca apaga histórico. */
export const updateWeeklyFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => UpdateFocusInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { invalidateOpenDirections } = await import("./mag/focus-invalidate.server");
    const { clarificationFor } = await import("./mag/focus-clarify");

    const patch: Record<string, unknown> = {};
    let focusChanged = false;
    if (data.interpreted !== undefined) {
      const next = interpretFocus(data.interpreted);
      patch.interpreted = next;
      focusChanged = true;
      const clarify = clarificationFor(next);
      patch.clarify_question = clarify?.question ?? null;
      patch.clarify_options = (clarify?.options ?? []) as never;
      patch.clarify_answer = null;
    }
    if (data.main_goal !== undefined) patch.main_goal = data.main_goal?.trim() || null;
    if (data.end_date !== undefined) patch.end_date = data.end_date;
    if (data.end_reason !== undefined) patch.end_reason = data.end_reason?.trim() || null;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "completed" || data.status === "partial" || data.status === "ended") {
        patch.completed_at = new Date().toISOString();
        focusChanged = true;
      }
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("weekly_focus")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    if (focusChanged) {
      await invalidateOpenDirections(context.supabase, context.userId, "focus_changed");
    }
    return { ok: true };
  });

/** Registra um avanço manual no foco (usado quando não há métrica numérica). */
export const registerFocusAdvance = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("weekly_focus")
      .select("advances")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Foco não encontrado");
    const { error: upErr } = await context.supabase
      .from("weekly_focus")
      .update({ advances: ((row as { advances: number }).advances ?? 0) + 1 })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/**
 * Resposta à pergunta essencial da MAG sobre o foco.
 * Uma pergunta por vez: respondida, o foco fica pronto para gerar direção.
 */
export const answerFocusClarification = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), answer: z.string().min(1).max(400) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("weekly_focus")
      .update({
        clarify_answer: data.answer.trim().slice(0, 400),
        clarified_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
