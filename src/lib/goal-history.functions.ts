import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type GoalStatus = "completed" | "missed" | "expired" | "active";
export type GoalOriginKind = "mag" | "impact" | "shared";

export type GoalHistoryItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string | null;
  reason: string | null;
  origin_kind: GoalOriginKind;
  origin_label: string | null;
  status: GoalStatus;
  outcome_text: string | null;
};

const SELECT =
  "id, priority_title, priority_reason, first_action, source, meta_date, status, completed_at, generated_at, origin_kind, origin_label";

type PlanRow = {
  id: string;
  priority_title: string;
  priority_reason: string | null;
  first_action: string | null;
  source: string | null;
  meta_date: string | null;
  status: string | null;
  completed_at: string | null;
  generated_at: string;
  origin_kind?: string | null;
  origin_label?: string | null;
};

type ReflectionRow = {
  plan_id: string | null;
  reflected_for: string;
  outcome: string | null;
  note: string | null;
  activity_text: string | null;
};

function todayISO(): string {
  const now = new Date();
  const localMs = now.getTime() + (now.getTimezoneOffset() - 180) * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

function outcomeText(r: ReflectionRow | undefined, description: string | null): string | null {
  if (!r) return null;
  const parts = [r.note, r.activity_text]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim())
    .filter((v) => v !== (description ?? "").trim());
  return parts.length > 0 ? Array.from(new Set(parts)).join(" · ") : null;
}

function buildItem(plan: PlanRow, refl: ReflectionRow | undefined, today: string): GoalHistoryItem {
  const date = plan.meta_date ?? plan.generated_at.slice(0, 10);
  let status: GoalStatus;
  if (plan.status === "completed" || refl?.outcome === "done") status = "completed";
  else if (refl) status = "missed";
  else if (date < today) status = "expired";
  else status = "active";

  const kind = (plan.origin_kind ?? "mag") as GoalOriginKind;
  return {
    id: plan.id,
    date,
    title: plan.priority_title,
    description: plan.first_action,
    reason: plan.priority_reason,
    origin_kind: kind === "impact" || kind === "shared" ? kind : "mag",
    origin_label: plan.origin_label ?? null,
    status,
    outcome_text: outcomeText(refl, plan.first_action),
  };
}

async function loadReflections(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<ReflectionRow[]> {
  const { data } = await supabase
    .from("plan_reflections")
    .select("plan_id, reflected_for, outcome, note, activity_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);
  return (data ?? []) as ReflectionRow[];
}

function indexReflections(rows: ReflectionRow[]) {
  const byPlan = new Map<string, ReflectionRow>();
  const byDate = new Map<string, ReflectionRow>();
  for (const r of rows) {
    if (r.plan_id && !byPlan.has(r.plan_id)) byPlan.set(r.plan_id, r);
    if (r.reflected_for && !byDate.has(r.reflected_for)) byDate.set(r.reflected_for, r);
  }
  return { byPlan, byDate };
}

export const listGoalHistory = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        filter: z.enum(["all", "completed", "missed", "shared"]).default("all"),
        days: z.number().int().default(7),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<GoalHistoryItem[]> => {
    // Metas individuais nunca são exibidas além de 30 dias (dados antigos seguem
    // armazenados e usados pela MAG nas métricas e na personalização).
    const days = [7, 15, 30].includes(data.days) ? data.days : 7;
    const now = new Date();
    const localMs = now.getTime() + (now.getTimezoneOffset() - 180) * 60_000;
    const startDate = new Date(localMs);
    startDate.setDate(startDate.getDate() - (days - 1));
    const startISO = startDate.toISOString().slice(0, 10);

    const { data: plans, error } = await context.supabase
      .from("user_plans")
      .select(SELECT)
      .eq("user_id", context.userId)
      .gte("meta_date", startISO)
      .order("meta_date", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false })
      .limit(180);
    if (error) throw new Error(error.message);

    const refl = indexReflections(await loadReflections(context.supabase, context.userId));
    const today = todayISO();

    const items = ((plans ?? []) as PlanRow[]).map((p) => {
      const date = p.meta_date ?? p.generated_at.slice(0, 10);
      return buildItem(p, refl.byPlan.get(p.id) ?? refl.byDate.get(date), today);
    });

    if (data.filter === "completed") return items.filter((i) => i.status === "completed");
    if (data.filter === "missed") return items.filter((i) => i.status !== "completed");
    if (data.filter === "shared") return items.filter((i) => i.origin_kind === "shared");
    return items;
  });

export type GoalDetail = GoalHistoryItem & { after: string | null };

export const getGoalDetail = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<GoalDetail | null> => {
    const { data: plan, error } = await context.supabase
      .from("user_plans")
      .select(SELECT)
      .eq("user_id", context.userId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) return null;

    const refl = indexReflections(await loadReflections(context.supabase, context.userId));
    const row = plan as PlanRow;
    const date = row.meta_date ?? row.generated_at.slice(0, 10);
    const r = refl.byPlan.get(row.id) ?? refl.byDate.get(date);
    const item = buildItem(row, r, todayISO());

    const after =
      item.outcome_text ??
      (r?.outcome === "done"
        ? "Você registrou esta direção como concluída."
        : r
          ? "Você registrou que esta direção não avançou como esperado."
          : null);

    return { ...item, after };
  });

/** Marca uma meta do histórico como "não foi útil". */
export const markGoalNotUseful = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().max(200).optional() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("mag_goal_feedback").upsert(
      {
        user_id: context.userId,
        goal_id: data.id,
        feedback: "disliked",
        goal_title: data.title ?? null,
      },
      { onConflict: "user_id,goal_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
