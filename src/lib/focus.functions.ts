import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type FocusShift = {
  id: string;
  focus_key: string;
  focus_label: string;
  note: string | null;
  duration: "next" | "until_change";
  created_at: string;
};

const SetFocusInput = z.object({
  focus_key: z.string().min(2).max(40),
  focus_label: z.string().min(2).max(60),
  note: z.string().max(500).optional().nullable(),
  duration: z.enum(["next", "until_change"]).default("next"),
});

/** Foco ativo do usuário (no máximo um). */
export const getActiveFocus = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<FocusShift | null> => {
    const { data, error } = await context.supabase
      .from("user_focus_shifts")
      .select("id, focus_key, focus_label, note, duration, created_at")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as FocusShift | null) ?? null;
  });

/**
 * Define o foco das PRÓXIMAS direções.
 * Nunca altera a direção atual: apenas encerra o foco anterior e grava o novo.
 */
export const setFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SetFocusInput.parse(raw))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("user_focus_shifts")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("status", "active");

    const { error } = await context.supabase.from("user_focus_shifts").insert({
      user_id: context.userId,
      focus_key: data.focus_key,
      focus_label: data.focus_label,
      note: data.note?.trim() ? data.note.trim() : null,
      duration: data.duration,
      status: "active",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
