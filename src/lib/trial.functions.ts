import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type TrialStatus = {
  hasAccess: boolean;
  subscriptionStatus: "none" | "trialing" | "active" | "expired" | "canceled";
  accessType: string | null;
  trialEndsAt: string | null;
  subscriptionRenewsAt: string | null;
  trialUsed: boolean;
  daysRemaining: number | null;
};

export const activateTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; reason?: string }> => {
    const { supabase } = context;
    // Vincula indicação (cookie visitor_id) antes de ativar o trial —
    // preserva o indicador original dentro da janela de 30 dias.
    try {
      const req = getRequest();
      const cookieHeader = req?.headers.get("cookie") ?? null;
      if (cookieHeader) {
        const { parseCookies, COOKIE_VISITOR } = await import(
          "@/lib/referrals/attribution.server"
        );
        const visitorId = parseCookies(cookieHeader)[COOKIE_VISITOR];
        if (visitorId) {
          await supabase.rpc("link_referral_from_visitor", { _visitor_id: visitorId });
        }
      }
    } catch (e) {
      console.warn("[trial] link_referral_from_visitor falhou (não crítico)", e);
    }
    const { data, error } = await supabase.rpc("activate_trial_for_current_user");
    if (error) return { ok: false, reason: error.message };
    const result = data as { ok: boolean; reason?: string } | null;
    return { ok: !!result?.ok, reason: result?.reason };
  });

export const getTrialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrialStatus> => {
    const { data: decision, error } = await context.supabase.rpc("get_my_access_status");
    if (error || !decision || typeof decision !== "object") {
      throw new Error(error?.message ?? "Estado de acesso indisponível");
    }
    const status = decision as {
      has_access?: boolean;
      reason?: string;
      effective_trial_end?: string;
      subscription_status?: string;
      days_remaining?: number;
    };
    return {
      hasAccess: status.has_access === true,
      subscriptionStatus: (status.subscription_status as TrialStatus["subscriptionStatus"]) ?? "none",
      accessType: status.reason ?? null,
      trialEndsAt: status.effective_trial_end ?? null,
      subscriptionRenewsAt: null,
      trialUsed: true,
      daysRemaining: status.days_remaining ?? null,
    };
  });