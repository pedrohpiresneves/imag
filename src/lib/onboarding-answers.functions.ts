import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  mindset: z.record(z.string(), z.array(z.string())),
  objectives: z.record(z.string(), z.array(z.string())),
});

/**
 * Salva as respostas do onboarding guiado no Perfil Magnético
 * e marca o onboarding como concluído (ativando o trial).
 */
export const saveOnboardingAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const now = new Date().toISOString();
    const flatten = (r: Record<string, string[]>) =>
      Object.fromEntries(
        Object.entries(r)
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => [k, v.join(", ")]),
      );

    try {
      await context.supabase
        .from("magnetic_profile")
        .upsert({ user_id: context.userId }, { onConflict: "user_id" });

      const { data: current } = await context.supabase
        .from("magnetic_profile")
        .select("mindset, objectives")
        .eq("user_id", context.userId)
        .maybeSingle();

      const mindset = {
        ...((current?.mindset as Record<string, unknown>) ?? {}),
        ...flatten(data.mindset),
      };
      const objectives = {
        ...((current?.objectives as Record<string, unknown>) ?? {}),
        ...flatten(data.objectives),
      };

      await context.supabase
        .from("magnetic_profile")
        .update({
          mindset,
          objectives,
          completeness: 60,
          onboarding_state: "completed",
          onboarding_finished_at: now,
        } as never)
        .eq("user_id", context.userId);

      await context.supabase
        .from("profiles")
        .update({ onboarding_completed_at: now } as never)
        .eq("id", context.userId);

      await context.supabase.rpc("activate_trial_for_current_user");
    } catch (e) {
      console.error("[onboarding] saveOnboardingAnswers falhou", e);
      return { ok: false };
    }
    return { ok: true };
  });
