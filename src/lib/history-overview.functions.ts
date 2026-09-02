import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { computeScore } from "@/lib/campo-magnetico/score";
import type { Reflection } from "@/lib/reflections.functions";

export type HistoryOverview = {
  days: number;
  start: string;
  end: string;
  received: number;
  executed: number;
  executionPct: number;
  impacts: number;
  activeDays: number;
  fieldDelta: number | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function nowSaoPaulo(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() - 180) * 60_000);
}

export const getHistoryOverview = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ days: z.number().int().default(7) }).parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<HistoryOverview> => {
    const { supabase, userId } = context;
    const days = [7, 15, 30].includes(data.days) ? data.days : 7;
    const today = nowSaoPaulo();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (days - 1));
    const start = iso(startDate);
    const end = iso(today);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const [reflRes, plansRes, impactsRes, magRes, profRes] = await Promise.all([
      supabase
        .from("plan_reflections")
        .select("id, plan_id, outcome, note, energy, reflected_for, created_at, activity_text")
        .eq("user_id", userId)
        .order("reflected_for", { ascending: false }),
      supabase
        .from("user_plans")
        .select("id, status, meta_date")
        .eq("user_id", userId)
        .gte("meta_date", start)
        .lte("meta_date", end),
      supabase
        .from("direction_impacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${start}T00:00:00Z`),
      supabase.from("magnetic_profile").select("completeness").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("goal").eq("id", userId).maybeSingle(),
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

    const periodRefl = reflections.filter(
      (r) => r.reflected_for >= start && r.reflected_for <= end,
    );
    const executedIds = new Set(
      periodRefl.filter((r) => r.outcome === "done" && r.plan_id).map((r) => r.plan_id!),
    );
    const plans = plansRes.data ?? [];
    const received = plans.length;
    const executed = plans.filter((p) => p.status === "completed" || executedIds.has(p.id)).length;

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
    const fieldDelta =
      current.total != null && previous.total != null
        ? previous.total > 0
          ? Math.round(((current.total - previous.total) / previous.total) * 100)
          : current.total - previous.total
        : null;

    return {
      days,
      start,
      end,
      received,
      executed,
      executionPct: received > 0 ? Math.round((executed / received) * 100) : 0,
      impacts: impactsRes.count ?? 0,
      activeDays: new Set(periodRefl.map((r) => r.reflected_for)).size,
      fieldDelta,
    };
  });
