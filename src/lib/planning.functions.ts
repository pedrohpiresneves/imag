import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type PlanKind = "event" | "task" | "goal_week" | "goal_month" | "goal_year" | "deadline";

export type PlanningItem = {
  id: string;
  kind: PlanKind;
  title: string;
  info: string | null;
  date: string | null;
  time: string | null;
  done: boolean;
  /** Escolha manual do ícone; null = automático (classificado pelo título). */
  icon: string | null;
};

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^\d{2}:\d{2}$/);
const ItemKind = z.enum(["event", "task", "goal_week", "goal_month", "goal_year", "deadline"]);

/** Lista tudo do planejamento: compromissos (day_events) + itens (plan_items). */
export const listPlanning = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ from: LocalDate, to: LocalDate }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<PlanningItem[]> => {
    const [ev, items] = await Promise.all([
      context.supabase
        .from("day_events")
        .select("id, day_date, start_time, title, icon")
        .eq("user_id", context.userId)
        .gte("day_date", data.from)
        .lte("day_date", data.to)
        .order("day_date", { ascending: true }),
      context.supabase
        .from("plan_items")
        .select("id, kind, title, info, due_date, due_time, done, icon")
        .eq("user_id", context.userId)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (ev.error) throw new Error(ev.error.message);
    if (items.error) throw new Error(items.error.message);

    const out: PlanningItem[] = [];
    for (const e of ev.data ?? []) {
      out.push({
        id: `event:${e.id}`,
        kind: "event",
        title: e.title,
        info: null,
        date: e.day_date,
        time: (e.start_time ?? "").slice(0, 5) || null,
        done: false,
        icon: (e as { icon?: string | null }).icon ?? null,
      });
    }
    for (const i of items.data ?? []) {
      const row = i as {
        id: string;
        kind: string;
        title: string;
        info: string | null;
        due_date: string | null;
        due_time: string | null;
        done: boolean;
        icon: string | null;
      };
      if (row.due_date && (row.due_date < data.from || row.due_date > data.to)) continue;
      out.push({
        id: `item:${row.id}`,
        kind: row.kind as PlanKind,
        title: row.title,
        info: row.info,
        date: row.due_date,
        time: row.due_time,
        done: row.done,
        icon: row.icon ?? null,
      });
    }
    return out;
  });

export const createPlanningItem = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        kind: ItemKind,
        title: z.string().trim().min(1).max(160),
        info: z.string().trim().max(200).optional(),
        date: LocalDate.nullable().optional(),
        time: Time.nullable().optional(),
        icon: z.string().trim().max(40).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    if (data.kind === "event") {
      if (!data.date) throw new Error("Compromisso precisa de uma data.");
      const { error } = await context.supabase.from("day_events").insert({
        user_id: context.userId,
        day_date: data.date,
        start_time: data.time ?? "09:00",
        title: data.title,
        icon: data.icon ?? null,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("plan_items").insert({
      user_id: context.userId,
      kind: data.kind,
      title: data.title,
      info: data.info ?? null,
      due_date: data.date ?? null,
      due_time: data.time ?? null,
      icon: data.icon ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function split(id: string) {
  const [prefix, real] = id.split(":");
  return { prefix, real: real ?? "" };
}

export const updatePlanningItem = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().min(3),
        title: z.string().trim().min(1).max(160).optional(),
        info: z.string().trim().max(200).nullable().optional(),
        date: LocalDate.nullable().optional(),
        time: Time.nullable().optional(),
        done: z.boolean().optional(),
        icon: z.string().trim().max(40).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { prefix, real } = split(data.id);
    if (prefix === "event") {
      const patch: {
        title?: string;
        day_date?: string;
        start_time?: string;
        icon?: string | null;
      } = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.icon !== undefined) patch.icon = data.icon;
      if (data.date) patch.day_date = data.date;
      if (data.time) patch.start_time = data.time;
      const { error } = await context.supabase
        .from("day_events")
        .update(patch)
        .eq("id", real)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const patch: {
      title?: string;
      info?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      done?: boolean;
      icon?: string | null;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.info !== undefined) patch.info = data.info;
    if (data.date !== undefined) patch.due_date = data.date;
    if (data.time !== undefined) patch.due_time = data.time;
    if (data.done !== undefined) patch.done = data.done;
    if (data.icon !== undefined) patch.icon = data.icon;
    const { error } = await context.supabase
      .from("plan_items")
      .update(patch)
      .eq("id", real)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlanningItem = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().min(3) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { prefix, real } = split(data.id);
    const table = prefix === "event" ? "day_events" : "plan_items";
    const { error } = await context.supabase
      .from(table)
      .delete()
      .eq("id", real)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
