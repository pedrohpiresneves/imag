import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRICE_CENTS } from "@/lib/pricing";

export interface AmbassadorDashboard {
  code: string;
  status: string;
  tier: string;
  termsAcceptedAt: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  minPayoutCents: number;
  rateBps: number;
  referralUrl: string;
  metrics: {
    conversions: number;
    availableCents: number;
    pendingCents: number;
    totalEarnedCents: number;
    potentialCents: number;
    trialCount: number;
    signupCount: number;
    notConvertedCount: number;
  };
  history: Array<{
    id: string;
    createdAt: string;
    amountCents: number;
    status: string;
    releaseAt: string;
  }>;
  referrals: Array<{
    handle: string | null;
    status: string;
    attributedAt: string | null;
    trialEndsAt: string | null;
  }>;
  payouts: Array<{
    id: string;
    amountCents: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
}

const APP_URL = process.env.PUBLIC_APP_URL ?? "https://imag.net.br";

export const getMyAmbassadorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AmbassadorDashboard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureAmbassador } = await import("./commissions.server");
    const { getSettings, getEffectiveRateBps } = await import("./settings.server");

    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userInfo?.user?.email ?? "amig@imag";
    await ensureAmbassador(context.userId, email);

    const { data: amb } = await supabaseAdmin
      .from("ambassadors")
      .select("code, tier, status, pix_key, pix_key_type, terms_accepted_at")
      .eq("user_id", context.userId)
      .single();

    const { data: commissions = [] } = await supabaseAdmin
      .from("referral_commissions")
      .select("id, amount_cents, status, created_at, release_at")
      .eq("ambassador_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: payouts = [] } = await supabaseAdmin
      .from("payouts")
      .select("id, amount_cents, status, created_at, paid_at")
      .eq("ambassador_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const settings = await getSettings();
    const rate = await getEffectiveRateBps(amb?.code ?? null);

    const sumBy = (statuses: string[]) =>
      (commissions ?? [])
        .filter((c) => statuses.includes(c.status))
        .reduce((s, c) => s + (c.amount_cents ?? 0), 0);

    const pending = sumBy(["pending"]);
    const available = sumBy(["available"]);
    const paid = sumBy(["paid"]);
    const conversions = (commissions ?? []).filter(
      (c) => c.status !== "reversed" && c.status !== "cancelled",
    ).length;

    // Indicados: usuários com referrer_user_id = eu. Inclui trials em andamento
    // (comissão potencial) e cadastros que ainda não converteram.
    const { data: referred = [] } = await supabaseAdmin
      .from("profiles")
      .select("handle, referral_status, referral_attributed_at, trial_ends_at, subscription_status")
      .eq("referrer_user_id", context.userId)
      .order("referral_attributed_at", { ascending: false })
      .limit(100);

    const trialCount = (referred ?? []).filter(
      (r) => r.referral_status === "em_periodo_gratuito",
    ).length;
    const signupCount = (referred ?? []).filter(
      (r) => r.referral_status === "cadastro_realizado",
    ).length;
    const notConvertedCount = (referred ?? []).filter(
      (r) => r.referral_status === "nao_converteu",
    ).length;
    // Comissão potencial: percentual do plano anual oficial por trial em andamento.
    const potentialCents = Math.floor((PRICE_CENTS.annual * rate) / 10000) * trialCount;

    return {
      code: amb?.code ?? "",
      status: amb?.status ?? "active",
      tier: amb?.tier ?? "ambassador",
      termsAcceptedAt: amb?.terms_accepted_at ?? null,
      pixKey: amb?.pix_key ?? null,
      pixKeyType: amb?.pix_key_type ?? null,
      minPayoutCents: settings.min_payout_cents,
      rateBps: rate,
      referralUrl: `${APP_URL}/r/${amb?.code ?? ""}`,
      metrics: {
        conversions,
        availableCents: available,
        pendingCents: pending,
        totalEarnedCents: available + paid,
        potentialCents,
        trialCount,
        signupCount,
        notConvertedCount,
      },
      history: (commissions ?? []).map((c) => ({
        id: c.id,
        createdAt: c.created_at,
        amountCents: c.amount_cents,
        status: c.status,
        releaseAt: c.release_at,
      })),
      referrals: (referred ?? []).map((r) => ({
        handle: r.handle ?? null,
        status: r.referral_status ?? "cadastro_realizado",
        attributedAt: r.referral_attributed_at ?? null,
        trialEndsAt: r.trial_ends_at ?? null,
      })),
      payouts: (payouts ?? []).map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        status: p.status,
        createdAt: p.created_at,
        paidAt: p.paid_at,
      })),
    };
  });

export const acceptReferralTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ambassadors")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });

const pixSchema = z.object({
  pixKey: z.string().trim().min(3).max(200),
  pixKeyType: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
});

export const updatePixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof pixSchema>) => pixSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ambassadors")
      .update({ pix_key: data.pixKey, pix_key_type: data.pixKeyType })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings } = await import("./settings.server");
    const settings = await getSettings();

    const { data: amb } = await supabaseAdmin
      .from("ambassadors")
      .select("pix_key, terms_accepted_at, status")
      .eq("user_id", context.userId)
      .single();
    if (!amb) throw new Error("Embaixador não encontrado");
    if (amb.status !== "active") throw new Error("Conta bloqueada");
    if (!amb.terms_accepted_at) throw new Error("Aceite os termos antes de sacar");
    if (!amb.pix_key) throw new Error("Cadastre uma chave PIX");

    const { data: available } = await supabaseAdmin
      .from("referral_commissions")
      .select("id, amount_cents")
      .eq("ambassador_user_id", context.userId)
      .eq("status", "available")
      .is("payout_id", null);

    const total = (available ?? []).reduce((s, c) => s + c.amount_cents, 0);
    if (total < settings.min_payout_cents) {
      throw new Error(
        `Valor mínimo de saque: R$ ${(settings.min_payout_cents / 100).toFixed(2)}`,
      );
    }

    const { data: payout, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        ambassador_user_id: context.userId,
        amount_cents: total,
        method: "pix",
        status: "requested",
        pix_key_snapshot: amb.pix_key,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabaseAdmin
      .from("referral_commissions")
      .update({ payout_id: payout.id })
      .in("id", (available ?? []).map((c) => c.id));

    return { ok: true, payoutId: payout.id };
  });