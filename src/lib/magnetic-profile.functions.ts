import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
export type ProfileDimension = { [k: string]: Json };

export type MagneticProfile = {
  identity: ProfileDimension;
  audience: ProfileDimension;
  business: ProfileDimension;
  communication: ProfileDimension;
  mindset: ProfileDimension;
  objectives: ProfileDimension;
  instagram: ProfileDimension;
  completeness: number;
  onboarding_state: string;
  onboarding_finished_at: string | null;
};

function asRecord(value: unknown): ProfileDimension {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ProfileDimension)
    : {};
}

export const getMagneticProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MagneticProfile | null> => {
    const { data, error } = await context.supabase
      .from("magnetic_profile")
      .select(
        "identity, audience, business, communication, mindset, objectives, instagram, completeness, onboarding_state, onboarding_finished_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      identity: asRecord(data.identity),
      audience: asRecord(data.audience),
      business: asRecord(data.business),
      communication: asRecord(data.communication),
      mindset: asRecord(data.mindset),
      objectives: asRecord(data.objectives),
      instagram: asRecord(data.instagram),
      completeness: data.completeness ?? 0,
      onboarding_state: data.onboarding_state ?? "in_progress",
      onboarding_finished_at: data.onboarding_finished_at,
    };
  });

export const getOnboardingMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("onboarding_messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const resetOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("onboarding_messages").delete().eq("user_id", context.userId);
    await context.supabase
      .from("magnetic_profile")
      .update({
        identity: {},
        audience: {},
        business: {},
        communication: {},
        mindset: {},
        objectives: {},
        instagram: {},
        completeness: 0,
        onboarding_state: "in_progress",
        onboarding_finished_at: null,
      })
      .eq("user_id", context.userId);
    return { ok: true };
  });

/**
 * Fallback de conclusão: garante que o onboarding fique marcado como concluído
 * no banco mesmo se a ferramenta finalize_onboarding da MAG falhar.
 * Idempotente e nunca lança — o usuário jamais deve ficar preso.
 */
export const forceCompleteOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const now = new Date().toISOString();
    try {
      await context.supabase
        .from("magnetic_profile")
        .upsert({ user_id: context.userId }, { onConflict: "user_id" });
      await context.supabase
        .from("magnetic_profile")
        .update({
          onboarding_state: "completed",
          onboarding_finished_at: now,
        })
        .eq("user_id", context.userId);
      await context.supabase
        .from("profiles")
        .update({ onboarding_completed_at: now })
        .eq("id", context.userId);
      await context.supabase.rpc("activate_trial_for_current_user");
    } catch (e) {
      console.error("[onboarding] forceComplete falhou", e);
      return { ok: false };
    }
    return { ok: true };
  });