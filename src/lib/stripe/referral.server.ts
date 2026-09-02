/**
 * Comissões do Círculo iMAG para o fluxo Stripe.
 * Regra: R$ 4,40 (mensal) ou R$ 39,40 (anual) apenas na PRIMEIRA fatura paga
 * de uma nova assinatura. Idempotente por stripe_invoice_id.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { IMAG_STRIPE_COMMISSION_CENTS, type StripeEnv } from "@/lib/stripe.server";

const RELEASE_DELAY_DAYS = 7;

export async function createStripeReferralCommission(input: {
  env: StripeEnv;
  userId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  priceLookupKey: string;
}): Promise<{ created: boolean; reason?: string; commissionId?: string }> {
  const amount = IMAG_STRIPE_COMMISSION_CENTS[input.priceLookupKey];
  if (!amount) return { created: false, reason: "unsupported_price" };

  // Idempotência forte via UNIQUE (environment, stripe_invoice_id)
  const { data: existing } = await supabaseAdmin
    .from("referral_commissions")
    .select("id")
    .eq("environment", input.env)
    .eq("stripe_invoice_id", input.stripeInvoiceId)
    .maybeSingle();
  if (existing) return { created: false, reason: "duplicate", commissionId: existing.id };

  // Perfil do comprador → indicador
  const { data: buyer } = await supabaseAdmin
    .from("profiles")
    .select("referrer_user_id")
    .eq("id", input.userId)
    .maybeSingle();
  if (!buyer?.referrer_user_id) return { created: false, reason: "no_referrer" };
  if (buyer.referrer_user_id === input.userId) return { created: false, reason: "self_referral" };

  const now = new Date();
  const releaseAt = new Date(now.getTime() + RELEASE_DELAY_DAYS * 86400_000);

  const { data, error } = await supabaseAdmin
    .from("referral_commissions")
    .insert({
      source: "stripe",
      environment: input.env,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_invoice_id: input.stripeInvoiceId,
      ambassador_user_id: buyer.referrer_user_id,
      buyer_user_id: input.userId,
      gross_amount_cents: amount * 5, // referência ao preço (5x = 100/20)
      eligible_amount_cents: amount * 5,
      rate_bps: 2000, // 20% de referência (comissão fixa já calculada)
      amount_cents: amount,
      status: "pending",
      release_at: releaseAt.toISOString(),
    } as never)
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { created: false, reason: "race_duplicate" };
    throw error;
  }

  // Marca perfil do comprador como venda_confirmada
  await supabaseAdmin
    .from("profiles")
    .update({ referral_status: "venda_confirmada" })
    .eq("id", input.userId);

  return { created: true, commissionId: data.id };
}

export async function reverseStripeReferralCommission(input: {
  env: StripeEnv;
  stripeInvoiceId: string;
  reason: string;
}): Promise<{ reversed: boolean }> {
  const { data: comm } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, status, buyer_user_id")
    .eq("environment", input.env)
    .eq("stripe_invoice_id", input.stripeInvoiceId)
    .maybeSingle();
  if (!comm) return { reversed: false };
  if (comm.status === "reversed" || comm.status === "cancelled") {
    return { reversed: false };
  }
  await supabaseAdmin
    .from("referral_commissions")
    .update({
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversal_reason: input.reason,
    })
    .eq("id", comm.id);
  if (comm.buyer_user_id) {
    await supabaseAdmin
      .from("profiles")
      .update({ referral_status: "cancelada" })
      .eq("id", comm.buyer_user_id);
  }
  return { reversed: true };
}