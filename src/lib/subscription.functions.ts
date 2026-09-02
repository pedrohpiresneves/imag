import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubscriptionPlan = "trial" | "monthly" | "annual" | "none";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "none";

export type AccessState = {
  hasAccess: boolean;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  paymentProvider: string | null;
  endsAt: string | null;
  /** Dias restantes do período vigente (teste ou pago). */
  daysRemaining: number | null;
};

type AccessDecision = {
  has_access: boolean;
  reason: "trial" | "subscription" | "expired";
  trial_started_at: string | null;
  effective_trial_end: string;
  days_remaining: number;
};

const EMPTY: AccessState = {
  hasAccess: false,
  plan: "none",
  status: "none",
  isTrial: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  canceledAt: null,
  paymentProvider: null,
  endsAt: null,
  daysRemaining: null,
};

/**
 * Fonte da verdade do acesso. Toda a validação acontece no banco
 * (`public.get_access_state`) — o front nunca decide sozinho.
 */
export const getAccessState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessState> => {
    const { data, error } = await context.supabase.rpc("get_my_access_status");
    if (error) {
      throw new Error(error.message);
    }
    const decision = data as AccessDecision;
    return {
      ...EMPTY,
      hasAccess: decision.has_access,
      plan: decision.reason === "trial" ? "trial" : "none",
      status: decision.reason === "trial"
        ? "trialing"
        : decision.reason === "subscription"
          ? "active"
          : "expired",
      isTrial: decision.reason === "trial",
      trialEndsAt: decision.effective_trial_end,
      endsAt: decision.reason === "trial" ? decision.effective_trial_end : null,
      daysRemaining: decision.days_remaining,
    };
  });

/**
 * Garante o teste gratuito de 10 dias. Idempotente: só cria uma vez por conta,
 * nunca duplica a cada login ou atualização de cadastro.
 */
export const ensureTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; reason?: string }> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("start_trial_for_current_user");
    if (error) return { ok: false, reason: error.message };
    const result = data as { ok?: boolean; reason?: string } | null;
    return { ok: !!result?.ok, reason: result?.reason };
  });