// Núcleo de comissões: create/reverse/release. Idempotente por payment_id.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEffectiveRateBps, getSettings } from "./settings.server";

export async function createReferralCommission(paymentId: string): Promise<
  { created: false; reason: string } | { created: true; commissionId: string }
> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, order_id, amount_cents, status, paid_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { created: false, reason: "payment_not_found" };
  if (payment.status !== "paid") return { created: false, reason: "not_paid" };

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, email, user_id, referrer_user_id, referral_code, referral_attribution_id")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order) return { created: false, reason: "order_not_found" };

  // Fallback: se o pedido não carrega indicador (ex.: usuário indicado
  // se cadastrou, fez trial e só depois pagou), busca no perfil do comprador.
  let referrerUserId = order.referrer_user_id;
  let referralCode = order.referral_code;
  let referralAttributionId = order.referral_attribution_id;
  if (!referrerUserId && order.user_id) {
    const { data: buyerProfile } = await supabaseAdmin
      .from("profiles")
      .select("referrer_user_id, referral_code, referral_attribution_id, referral_attributed_at")
      .eq("id", order.user_id)
      .maybeSingle();
    if (buyerProfile?.referrer_user_id) {
      // Só considera indicação vigente (janela de 30 dias desde a atribuição
      // ou desde o pagamento — o que for mais recente para trials longos).
      referrerUserId = buyerProfile.referrer_user_id;
      referralCode = buyerProfile.referral_code;
      referralAttributionId = buyerProfile.referral_attribution_id;
    }
  }
  if (!referrerUserId) return { created: false, reason: "no_referrer" };

  // Bloqueia self-referral por user_id
  if (order.user_id && order.user_id === referrerUserId) {
    await supabaseAdmin.from("fraud_flags").insert({
      ambassador_user_id: referrerUserId,
      reason: "self_referral",
      severity: "high",
      notes: `Order ${order.id}`,
    });
    return { created: false, reason: "self_referral" };
  }

  // Bloqueia self-referral por email
  const { data: refAmb } = await supabaseAdmin
    .from("ambassadors")
    .select("status, user_id")
    .eq("user_id", referrerUserId)
    .maybeSingle();
  if (!refAmb) return { created: false, reason: "ambassador_missing" };
  if (refAmb.status !== "active") {
    return { created: false, reason: `ambassador_${refAmb.status}` };
  }

  const settings = await getSettings();
  const rateBps = await getEffectiveRateBps(referralCode);
  const eligible = payment.amount_cents;
  const amount = Math.floor((eligible * rateBps) / 10000);

  const releaseAt = new Date(
    new Date(payment.paid_at ?? new Date()).getTime() + settings.guarantee_days * 86_400_000,
  ).toISOString();

  const { data: inserted, error } = await supabaseAdmin
    .from("referral_commissions")
    .insert({
      payment_id: paymentId,
      order_id: order.id,
      ambassador_user_id: referrerUserId,
      buyer_user_id: order.user_id,
      gross_amount_cents: payment.amount_cents,
      eligible_amount_cents: eligible,
      rate_bps: rateBps,
      amount_cents: amount,
      status: "pending",
      release_at: releaseAt,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { created: false, reason: "duplicate" };
    throw error;
  }

  if (referralAttributionId) {
    await supabaseAdmin
      .from("referral_attributions")
      .update({ consumed_order_id: order.id })
      .eq("id", referralAttributionId);
  }

  // Atualiza status da indicação no perfil do comprador para "venda_confirmada"
  if (order.user_id) {
    await supabaseAdmin
      .from("profiles")
      .update({ referral_status: "venda_confirmada" })
      .eq("id", order.user_id);
  }

  return { created: true, commissionId: inserted.id };
}

export async function reverseReferralCommission(
  paymentId: string,
  reason: string,
): Promise<{ reversed: boolean }> {
  const { data: comm } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, status, order_id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (!comm) return { reversed: false };
  if (comm.status === "reversed" || comm.status === "cancelled") return { reversed: false };
  await supabaseAdmin
    .from("referral_commissions")
    .update({
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversal_reason: reason,
    })
    .eq("id", comm.id);
  // Marca o perfil do comprador como "cancelada" para refletir estorno/chargeback
  const { data: ord } = comm.order_id
    ? await supabaseAdmin
        .from("orders")
        .select("user_id")
        .eq("id", comm.order_id)
        .maybeSingle()
    : { data: null };
  if (ord?.user_id) {
    await supabaseAdmin
      .from("profiles")
      .update({ referral_status: "cancelada" })
      .eq("id", ord.user_id);
  }
  return { reversed: true };
}

export async function releaseDueCommissions(): Promise<{ released: number }> {
  const { data, error } = await supabaseAdmin
    .from("referral_commissions")
    .update({ status: "available", released_at: new Date().toISOString() })
    .eq("status", "pending")
    .lte("release_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return { released: data?.length ?? 0 };
}

/** Gera código único para embaixador a partir do email. */
export async function generateUniqueCode(seed: string): Promise<string> {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "amig";
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}${suffix}`;
    const { data } = await supabaseAdmin
      .from("ambassadors")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-6)}`;
}

export async function ensureAmbassador(userId: string, emailSeed: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("ambassadors")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.code;
  const code = await generateUniqueCode(emailSeed.split("@")[0] ?? "amig");
  const { error } = await supabaseAdmin.from("ambassadors").insert({ user_id: userId, code });
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("ambassadors")
        .select("code")
        .eq("user_id", userId)
        .single();
      if (!retry) throw new Error("Ambassador não encontrado após conflict");
      return retry.code;
    }
    throw error;
  }
  return code;
}