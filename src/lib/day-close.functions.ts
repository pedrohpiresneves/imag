import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { dayCloseTargetMinutes } from "@/lib/day-close.server";

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DayClosePending = { id: string; title: string };

export type DayCloseState = {
  /** Hora local a partir da qual o card aparece (padrão 20h, ajustada pelo último compromisso). */
  showFromHour: number;
  showFromMinute: number;
  closed: boolean;
  rating: string | null;
  enabled: boolean;
  pending: DayClosePending[];
  eventsCount: number;
  /** Sugestão de novo horário quando a pessoa costuma encerrar mais tarde. */
  suggestedHour: number | null;
};

export const getDayCloseState = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ local_date: LocalDate }).parse(raw))
  .handler(async ({ context, data }): Promise<DayCloseState> => {
    const [prefsRes, priosRes, eventsRes, closureRes, historyRes] = await Promise.all([
      context.supabase
        .from("notification_preferences")
        .select("day_close_enabled, day_close_hour")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("day_priorities")
        .select("id, title, done")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .order("position", { ascending: true }),
      context.supabase
        .from("day_events")
        .select("start_time")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date),
      context.supabase
        .from("day_closures")
        .select("rating")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .maybeSingle(),
      context.supabase
        .from("day_closures")
        .select("closed_at")
        .eq("user_id", context.userId)
        .order("day_date", { ascending: false })
        .limit(5),
    ]);

    const prefs = prefsRes.data as
      | { day_close_enabled?: boolean; day_close_hour?: number }
      | null;
    const baseHour = prefs?.day_close_hour ?? 20;
    const events = (eventsRes.data ?? []) as { start_time: string }[];
    const target = dayCloseTargetMinutes(baseHour, events.map((e) => e.start_time));

    // Aprendizado leve: se costuma encerrar bem mais tarde, sugerir novo horário.
    const hours = ((historyRes.data ?? []) as { closed_at: string }[])
      .map((r) => new Date(r.closed_at).getHours())
      .filter((h) => Number.isFinite(h));
    let suggestedHour: number | null = null;
    if (hours.length >= 3) {
      const avg = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
      if (avg >= baseHour + 1 && avg <= 21) suggestedHour = avg;
    }

    return {
      showFromHour: Math.floor(target / 60),
      showFromMinute: target % 60,
      closed: Boolean(closureRes.data),
      rating: (closureRes.data as { rating?: string } | null)?.rating ?? null,
      enabled: prefs?.day_close_enabled ?? true,
      pending: ((priosRes.data ?? []) as { id: string; title: string; done: boolean }[])
        .filter((p) => !p.done)
        .map((p) => ({ id: p.id, title: p.title })),
      eventsCount: events.length,
      suggestedHour,
    };
  });

export const closeDay = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        local_date: LocalDate,
        rating: z.enum(["dificil", "regular", "bom", "otimo"]),
        actions: z
          .array(
            z.object({
              id: z.string().uuid(),
              action: z.enum(["keep", "move", "remove"]),
              date: LocalDate.optional(),
            }),
          )
          .max(20)
          .default([]),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    let moved = 0;
    let removed = 0;

    for (const item of data.actions) {
      if (item.action === "remove") {
        const { error } = await context.supabase
          .from("day_priorities")
          .delete()
          .eq("id", item.id)
          .eq("user_id", context.userId);
        if (error) throw new Error(error.message);
        removed += 1;
      } else if (item.action === "move") {
        const target =
          item.date ??
          new Date(new Date(`${data.local_date}T12:00:00`).getTime() + 86_400_000)
            .toLocaleDateString("en-CA");
        const { error } = await context.supabase
          .from("day_priorities")
          .update({ day_date: target, done: false })
          .eq("id", item.id)
          .eq("user_id", context.userId);
        if (error) throw new Error(error.message);
        moved += 1;
      }
    }

    const { error } = await context.supabase.from("day_closures").upsert(
      {
        user_id: context.userId,
        day_date: data.local_date,
        rating: data.rating,
        moved_count: moved,
        removed_count: removed,
        closed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day_date" },
    );
    if (error) throw new Error(error.message);

    return { ok: true, moved, removed };
  });
