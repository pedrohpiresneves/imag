import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type Reflection = {
  id: string;
  plan_id: string | null;
  outcome: "done" | "partial" | "blocked" | "skipped";
  note: string | null;
  energy: number | null;
  reflected_for: string;
  created_at: string;
  activity_text: string | null;
  signal_key?: string | null;
  signal_answer?: string | null;
};

function todaySaoPaulo(): string {
  const now = new Date();
  // America/Sao_Paulo is UTC-3 (no DST since 2019)
  const spOffsetMin = -180;
  const localMs = now.getTime() + (now.getTimezoneOffset() + spOffsetMin) * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

// Returns the most recent reflection for the active plan today (if any).
export const getTodayReflection = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<Reflection | null> => {
    const today = todaySaoPaulo();
    const { data, error } = await context.supabase
      .from("plan_reflections")
      .select(
        "id, plan_id, outcome, note, energy, reflected_for, created_at, activity_text, signal_key, signal_answer",
      )
      .eq("user_id", context.userId)
      .eq("reflected_for", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      plan_id: data.plan_id,
      outcome: data.outcome as Reflection["outcome"],
      note: data.note,
      energy: data.energy,
      reflected_for: data.reflected_for,
      created_at: data.created_at,
      activity_text: (data as { activity_text: string | null }).activity_text ?? null,
      signal_key: (data as { signal_key: string | null }).signal_key ?? null,
      signal_answer: (data as { signal_answer: string | null }).signal_answer ?? null,
    };
  });

const SubmitReflection = z.object({
  plan_id: z.string().uuid().nullable(),
  outcome: z.enum(["done", "partial", "blocked", "skipped"]),
  note: z.string().max(1000).optional().nullable(),
  energy: z.number().int().min(1).max(5).optional().nullable(),
  activity_text: z.string().max(500).optional().nullable(),
});

const SubmitReflectionInput = SubmitReflection.extend({
  signal_key: z.string().max(40).optional().nullable(),
  signal_answer: z.string().max(60).optional().nullable(),
});

export const submitReflection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SubmitReflectionInput.parse(raw))
  .handler(async ({ context, data }) => {
    const today = todaySaoPaulo();
    // Replace any earlier reflection from today for this user (one per day).
    await context.supabase
      .from("plan_reflections")
      .delete()
      .eq("user_id", context.userId)
      .eq("reflected_for", today);
    const { error } = await context.supabase.from("plan_reflections").insert({
      user_id: context.userId,
      plan_id: data.plan_id,
      outcome: data.outcome,
      note: data.note ?? null,
      energy: data.energy ?? null,
      reflected_for: today,
      activity_text: data.activity_text ?? null,
      signal_key: data.signal_key ?? null,
      signal_answer: data.signal_answer ?? null,
    });
    if (error) throw new Error(error.message);
    // Se concluiu, marca a MAG Meta de hoje como concluída.
    if (data.outcome === "done") {
      await context.supabase
        .from("user_plans")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("meta_date", today);
    }
    // Aprende com a execução: memória viva, arco e sinal anônimo de eficácia.
    try {
      const { learnFromOutcome } = await import("./mag/direction-engine.server");
      let planId = data.plan_id;
      if (!planId) {
        const { data: todayPlan } = await context.supabase
          .from("user_plans")
          .select("id")
          .eq("user_id", context.userId)
          .eq("meta_date", today)
          .maybeSingle();
        planId = todayPlan?.id ?? null;
      }
      await learnFromOutcome(context.supabase, context.userId, {
        planId,
        outcome: data.outcome,
        note: data.note ?? null,
        activity: data.activity_text ?? null,
        date: today,
        signalKey: data.signal_key ?? null,
        signalAnswer: data.signal_answer ?? null,
      });
    } catch (err) {
      console.error("[submitReflection] aprendizado falhou", err);
    }
    return { ok: true };
  });

export const listRecentReflections = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<Reflection[]> => {
    const { data, error } = await context.supabase
      .from("plan_reflections")
      .select(
        "id, plan_id, outcome, note, energy, reflected_for, created_at, activity_text, signal_key, signal_answer",
      )
      .eq("user_id", context.userId)
      .order("reflected_for", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({
      id: d.id,
      plan_id: d.plan_id,
      outcome: d.outcome as Reflection["outcome"],
      note: d.note,
      energy: d.energy,
      reflected_for: d.reflected_for,
      created_at: d.created_at,
      activity_text: (d as { activity_text: string | null }).activity_text ?? null,
      signal_key: (d as { signal_key: string | null }).signal_key ?? null,
      signal_answer: (d as { signal_answer: string | null }).signal_answer ?? null,
    }));
  });

export type MagnetosBalance = {
  balance: number;
  earnedToday: number;
  earnedThisWeek: number;
  earnedTotal: number;
  updatedAt: string | null;
};

function pointsFor(outcome: string): number {
  if (outcome === "done") return 10;
  if (outcome === "partial") return 5;
  return 0;
}

export const getMagnetosBalance = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<MagnetosBalance> => {
    const today = todaySaoPaulo();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoIso = weekAgo.toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("plan_reflections")
      .select("outcome, reflected_for, created_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    let total = 0;
    let todayPts = 0;
    let weekPts = 0;
    let updatedAt: string | null = null;
    for (const r of data ?? []) {
      const pts = pointsFor(String(r.outcome));
      total += pts;
      if (r.reflected_for === today) todayPts += pts;
      if (r.reflected_for >= weekAgoIso && r.reflected_for <= today) weekPts += pts;
      if (!updatedAt || (r.created_at && r.created_at > updatedAt)) {
        updatedAt = r.created_at ?? updatedAt;
      }
    }
    return { balance: total, earnedToday: todayPts, earnedThisWeek: weekPts, earnedTotal: total, updatedAt };
  });