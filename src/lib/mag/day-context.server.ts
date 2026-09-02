import type { SupabaseClient } from "@supabase/supabase-js";

export type DayContext = {
  priorities: { title: string; done: boolean }[];
  events: { start_time: string; title: string }[];
  note: string;
};

/**
 * Contexto operacional do dia (prioridades, agenda e nota rápida).
 * Estrutura preparada para a MAG considerar ao gerar a direção.
 */
export async function loadDayContext(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
): Promise<DayContext> {
  const [p, e, n] = await Promise.all([
    supabase
      .from("day_priorities")
      .select("title, done")
      .eq("user_id", userId)
      .eq("day_date", localDate)
      .order("position", { ascending: true }),
    supabase
      .from("day_events")
      .select("start_time, title")
      .eq("user_id", userId)
      .eq("day_date", localDate)
      .order("start_time", { ascending: true }),
    supabase
      .from("day_notes")
      .select("body")
      .eq("user_id", userId)
      .eq("day_date", localDate)
      .maybeSingle(),
  ]);
  return {
    priorities: (p.data ?? []) as DayContext["priorities"],
    events: (e.data ?? []) as DayContext["events"],
    note: ((n.data as { body?: string } | null)?.body ?? "") as string,
  };
}

/** Resumo textual curto para prompts da MAG. */
export function formatDayContext(ctx: DayContext): string {
  const lines: string[] = [];
  if (ctx.priorities.length) {
    lines.push(
      "Prioridades de hoje: " +
        ctx.priorities.map((p) => `${p.title}${p.done ? " (concluída)" : ""}`).join("; "),
    );
  }
  if (ctx.events.length) {
    lines.push(
      "Agenda de hoje: " +
        ctx.events.map((e) => `${e.start_time.slice(0, 5)} ${e.title}`).join("; "),
    );
  }
  if (ctx.note.trim()) lines.push(`Nota rápida: ${ctx.note.trim()}`);
  return lines.join("\n");
}
