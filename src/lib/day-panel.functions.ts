import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type DayPriority = {
  id: string;
  title: string;
  done: boolean;
  position: number;
};
export type DayEvent = { id: string; start_time: string; title: string; status?: string };
export type DayPanel = {
  priorities: DayPriority[];
  events: DayEvent[];
  note: string;
};

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Day = z.object({ local_date: LocalDate });

export const getDayPanel = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => Day.parse(raw))
  .handler(async ({ context, data }): Promise<DayPanel> => {
    const [p, e, n] = await Promise.all([
      context.supabase
        .from("day_priorities")
        .select("id, title, done, position")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      context.supabase
        .from("day_events")
        .select("id, start_time, title, status")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .order("start_time", { ascending: true }),
      context.supabase
        .from("day_notes")
        .select("body")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .maybeSingle(),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (e.error) throw new Error(e.error.message);
    if (n.error) throw new Error(n.error.message);
    return {
      priorities: (p.data ?? []) as DayPriority[],
      events: (e.data ?? []) as DayEvent[],
      note: ((n.data as { body?: string } | null)?.body ?? "") as string,
    };
  });

export const addDayPriority = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    Day.extend({ title: z.string().trim().min(1).max(140) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { count, error: cErr } = await context.supabase
      .from("day_priorities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("day_date", data.local_date);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= 3) throw new Error("Máximo de 3 prioridades por dia.");
    const { error } = await context.supabase.from("day_priorities").insert({
      user_id: context.userId,
      day_date: data.local_date,
      title: data.title,
      position: count ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDayPriority = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(140).optional(),
        done: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const patch: { title?: string; done?: boolean } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.done !== undefined) patch.done = data.done;
    const { error } = await context.supabase
      .from("day_priorities")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDayPriority = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("day_priorities")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addDayEvent = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    Day.extend({
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      title: z.string().trim().min(1).max(140),
    }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("day_events").insert({
      user_id: context.userId,
      day_date: data.local_date,
      start_time: data.start_time,
      title: data.title,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDayEvent = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("day_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDayEvent = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        title: z.string().trim().min(1).max(140),
        day_date: LocalDate.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const patch: { start_time: string; title: string; day_date?: string } = {
      start_time: data.start_time,
      title: data.title,
    };
    if (data.day_date) patch.day_date = data.day_date;
    const { error } = await context.supabase
      .from("day_events")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDayEventStatus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["planned", "done"]) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("day_events")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveDayNote = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => Day.extend({ body: z.string().max(2000) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("day_notes").upsert(
      { user_id: context.userId, day_date: data.local_date, body: data.body },
      { onConflict: "user_id,day_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderDayPriorities = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error: fetchErr } = await context.supabase
      .from("day_priorities")
      .select("id")
      .in("id", data.ids)
      .eq("user_id", context.userId);
    if (fetchErr) throw new Error(fetchErr.message);
    const owned = new Set((rows ?? []).map((r) => r.id));
    if (owned.size !== data.ids.length) throw new Error("Permissão negada.");

    const updates = data.ids.map((id, idx) =>
      context.supabase
        .from("day_priorities")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", context.userId),
    );
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) throw new Error(firstError.message);
    return { ok: true };
  });

/** Data local do dia anterior (YYYY-MM-DD). */
function previousDate(localDate: string): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Prioridades pendentes de ONTEM. Nunca aparecem como tarefas de hoje:
 * servem apenas para o usuário confirmar, se quiser, o transporte.
 */
export const listPendingFromYesterday = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => Day.parse(raw))
  .handler(async ({ context, data }): Promise<DayPriority[]> => {
    const { data: rows, error } = await context.supabase
      .from("day_priorities")
      .select("id, title, done, position")
      .eq("user_id", context.userId)
      .eq("day_date", previousDate(data.local_date))
      .eq("done", false)
      .order("position", { ascending: true })
      .limit(3);
    if (error) throw new Error(error.message);
    return (rows ?? []) as DayPriority[];
  });

/** Transporte explícito: só acontece quando o usuário confirma. */
export const carryPrioritiesToToday = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    Day.extend({ ids: z.array(z.string().uuid()).min(1).max(3) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("day_priorities")
      .select("id, title")
      .in("id", data.ids)
      .eq("user_id", context.userId)
      .eq("day_date", previousDate(data.local_date));
    if (error) throw new Error(error.message);
    if (!rows?.length) return { ok: true, moved: 0 };

    const { count, error: cErr } = await context.supabase
      .from("day_priorities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("day_date", data.local_date);
    if (cErr) throw new Error(cErr.message);

    const free = Math.max(0, 3 - (count ?? 0));
    const take = rows.slice(0, free);
    if (!take.length) return { ok: true, moved: 0 };

    const { error: insErr } = await context.supabase.from("day_priorities").insert(
      take.map((r, i) => ({
        user_id: context.userId,
        day_date: data.local_date,
        title: r.title,
        position: (count ?? 0) + i,
      })),
    );
    if (insErr) throw new Error(insErr.message);

    await context.supabase
      .from("day_priorities")
      .delete()
      .in("id", take.map((r) => r.id))
      .eq("user_id", context.userId);

    return { ok: true, moved: take.length };
  });
