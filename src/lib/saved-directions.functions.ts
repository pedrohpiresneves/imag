import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SavedDirection = {
  id: string;
  source_id: string | null;
  direction_text: string;
  why_text: string | null;
  created_at: string;
};

export const listSavedDirections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedDirection[]> => {
    const { data, error } = await context.supabase
      .from("saved_directions")
      .select("id, source_id, direction_text, why_text, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as SavedDirection[];
  });

const SaveInput = z.object({
  source_id: z.string().max(120).nullable().optional(),
  direction_text: z.string().min(3).max(600),
  why_text: z.string().max(600).nullable().optional(),
  strategy_key: z.string().max(60).nullable().optional(),
});

export const saveDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SaveInput.parse(raw))
  .handler(async ({ context, data }) => {
    if (data.source_id) {
      const { data: existing } = await context.supabase
        .from("saved_directions")
        .select("id")
        .eq("user_id", context.userId)
        .eq("source_id", data.source_id)
        .maybeSingle();
      if (existing) return { ok: true, already: true };
    }
    const { error } = await context.supabase.from("saved_directions").insert({
      user_id: context.userId,
      source_id: data.source_id ?? null,
      direction_text: data.direction_text,
      why_text: data.why_text ?? null,
      strategy_key: data.strategy_key ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, already: false };
  });

export const removeSavedDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("saved_directions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
