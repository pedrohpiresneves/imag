/**
 * Camada server-only de escrita das assinaturas.
 *
 * Ponto único onde uma assinatura passa a valer. Deve ser chamada APENAS
 * por webhook verificado do provedor (ou por consulta server-to-server da
 * API do provedor). Nunca por retorno de URL de sucesso.
 *
 * Preparado para a InfinitePay: o webhook em
 * `src/routes/api/public/payments/webhook.$provider.ts` valida a assinatura
 * do provedor e então chama `activateSubscriptionFromPayment`.
 */

export type PaidPlan = "monthly" | "annual";

export type ActivateInput = {
  userId: string;
  plan: PaidPlan;
  paymentProvider: string; // "infinitepay" | "stripe" | ...
  externalPaymentId: string; // id do pagamento/assinatura no provedor
  periodStart?: string; // ISO — default now()
  periodEnd?: string; // ISO — default now + 1 mês/ano
};

function addPeriod(from: Date, plan: PaidPlan): Date {
  const d = new Date(from);
  if (plan === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Encerra a assinatura vigente (teste ou paga) sem apagar histórico. */
async function closeLiveSubscription(userId: string, status: "expired" | "canceled") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ status, canceled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["trialing", "active", "past_due"]);
}

export async function activateSubscriptionFromPayment(input: ActivateInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = input.periodStart ? new Date(input.periodStart) : new Date();
  const end = input.periodEnd ? new Date(input.periodEnd) : addPeriod(start, input.plan);

  // Idempotência: mesmo pagamento não gera assinatura duplicada.
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("payment_provider", input.paymentProvider)
    .eq("external_payment_id", input.externalPaymentId)
    .maybeSingle();
  if (existing) return { ok: true, deduped: true };

  await closeLiveSubscription(input.userId, "expired");

  const { error } = await supabaseAdmin.from("subscriptions").insert({
    user_id: input.userId,
    plan: input.plan,
    status: "active",
    provider: input.paymentProvider,
    payment_provider: input.paymentProvider,
    external_payment_id: input.externalPaymentId,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
  });
  if (error) throw error;

  await supabaseAdmin
    .from("profiles")
    .update({
      has_access: true,
      access_type: input.plan,
      access_granted_at: new Date().toISOString(),
      subscription_status: "active",
      subscription_started_at: start.toISOString(),
      subscription_renews_at: end.toISOString(),
    })
    .eq("id", input.userId);

  return { ok: true, deduped: false };
}

/** Pagamento recorrente falhou — mantém dados, bloqueia acesso premium. */
export async function markSubscriptionPastDue(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("user_id", userId)
    .in("status", ["active", "trialing"]);
}

/** Cancelamento: acesso permanece até o fim do período já pago. */
export async function cancelSubscription(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["active", "past_due", "trialing"]);
}

/** Renovação confirmada pelo provedor: estende o período pago. */
export async function renewSubscription(
  userId: string,
  plan: PaidPlan,
  periodEnd?: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = new Date();
  const end = periodEnd ? new Date(periodEnd) : addPeriod(start, plan);
  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      canceled_at: null,
    })
    .eq("user_id", userId)
    .in("status", ["active", "past_due", "canceled"]);
}