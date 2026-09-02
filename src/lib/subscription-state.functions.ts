import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Estado canônico da assinatura — única fonte de verdade do app. */
export type SubState =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "inactive";

export type PlanKind =
  | "monthly"
  | "annual"
  | "trial"
  | "lifetime"
  | "ambassador"
  | "none";

export type SubscriptionState = {
  state: SubState;
  /** true quando o usuário ainda pode usar os recursos pagos. */
  hasAccess: boolean;
  plan: PlanKind;
  /** Nome legível do plano, quando conhecido. */
  planName: string | null;
  /** Fim do período vigente (pago ou gratuito). */
  endsAt: string | null;
  renewsAt: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  provider: string | null;
  /** Conta autorizada como Embaixador iMAG (acesso completo, sem assinatura). */
  isAmbassador: boolean;
  userCreatedAt: string;
  effectiveTrialEnd: string;
  subscriptionStatus: string;
};

type AccessDecision = {
  has_access: boolean;
  reason: "trial" | "subscription" | "expired";
  user_created_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  effective_trial_end: string;
  subscription_status: string;
  days_remaining: number;
};

/**
 * Fonte única do status da assinatura. Toda decisão de acesso é feita no
 * servidor/banco — nenhum componente decide sozinho.
 */
export const getSubscriptionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionState> => {
    const { data, error } = await context.supabase.rpc("get_my_access_status");
    if (error || !data) throw new Error(error?.message ?? "Estado de acesso indisponível");

    const decision = data as AccessDecision;
    const isTrial = decision.reason === "trial";
    const isAmbassador = decision.subscription_status === "ambassador";
    return {
      state: decision.has_access ? (isTrial ? "trialing" : "active") : "expired",
      hasAccess: decision.has_access,
      plan: isTrial ? "trial" : isAmbassador ? "ambassador" : decision.has_access ? "monthly" : "none",
      planName: isTrial ? "Período gratuito" : isAmbassador ? "Embaixador iMAG" : decision.has_access ? "Plano iMAG" : null,
      endsAt: isTrial ? decision.effective_trial_end : null,
      renewsAt: null,
      trialEndsAt: decision.effective_trial_end,
      cancelAtPeriodEnd: false,
      daysRemaining: decision.days_remaining,
      provider: null,
      isAmbassador,
      userCreatedAt: decision.user_created_at,
      effectiveTrialEnd: decision.effective_trial_end,
      subscriptionStatus: decision.subscription_status,
    };
  });
