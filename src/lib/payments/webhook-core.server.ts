// Núcleo idempotente de processamento de pagamentos.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { onboardPaidCustomer } from "./onboarding.server";
import type { PaymentProviderId } from "./types";
import { PRICE_AMOUNT_CENTS, PRODUCT_ID } from "./products";

type VerificationPayload = {
  verified?: {
    transactions?: Array<{
      paid?: boolean;
      amount?: number;
      transaction_nsu?: string;
      nsu?: string;
      order_nsu?: string;
    }>;
  };
  webhook?: { order_nsu?: string; orderNsu?: string; nsu?: string };
  admin_confirm?: boolean;
};

function asRecord(raw: unknown): VerificationPayload {
  return raw && typeof raw === "object" ? (raw as VerificationPayload) : {};
}

function amountMatches(amount: number | undefined, expectedCents: number) {
  if (typeof amount !== "number") return false;
  return amount === expectedCents || Math.round(amount * 100) === expectedCents;
}

export async function processPaidPayment(input: {
  provider: PaymentProviderId;
  providerIntentId: string;
  eventId: string;
  eventType: string;
  raw: unknown;
}): Promise<{ processed: boolean; reason?: string }> {
  async function markEventError(message: string) {
    await supabaseAdmin
      .from("webhook_events")
      .update({ error: message })
      .eq("provider", input.provider)
      .eq("event_id", input.eventId);
  }

  const { error: insertErr } = await supabaseAdmin.from("webhook_events").insert({
    provider: input.provider,
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.raw as never,
  });
  if (insertErr) {
    if (insertErr.code === "23505") return { processed: false, reason: "duplicate" };
    throw insertErr;
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, order_id, status, amount_cents, provider_intent_id")
    .eq("provider", input.provider)
    .eq("provider_intent_id", input.providerIntentId)
    .maybeSingle();
  if (!payment) {
    await supabaseAdmin
      .from("webhook_events")
      .update({ error: "payment não encontrado" })
      .eq("event_id", input.eventId);
    return { processed: false, reason: "payment_not_found" };
  }
  if (payment.status === "paid") {
    await supabaseAdmin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", input.eventId);
    return { processed: false, reason: "already_paid" };
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, email, product_id, total_cents, status, order_nsu")
    .eq("id", payment.order_id)
    .single();
  if (!order) throw new Error("Order desaparecido");
  if (order.status === "paid") return { processed: false, reason: "order_already_paid" };
  if (order.product_id !== PRODUCT_ID) {
    await markEventError("Produto do pedido não corresponde à Agenda Magnética");
    throw new Error("Produto do pedido não corresponde à Agenda Magnética");
  }
  if (order.total_cents !== PRICE_AMOUNT_CENTS || payment.amount_cents !== PRICE_AMOUNT_CENTS) {
    await markEventError("Valor do pagamento não corresponde ao preço oficial");
    throw new Error("Valor do pagamento não corresponde ao preço oficial");
  }

  if (input.provider === "infinitepay") {
    const raw = asRecord(input.raw);
    if (payment.provider_intent_id !== input.providerIntentId || order.order_nsu !== input.providerIntentId) {
      await markEventError("Identificador do pedido não corresponde ao pagamento");
      throw new Error("Identificador do pedido não corresponde ao pagamento");
    }
    if (!raw.admin_confirm) {
      const paidTx = raw.verified?.transactions?.find((tx) => tx.paid === true);
      if (!paidTx) {
        await markEventError("Pagamento InfinitePay não aprovado na confirmação server-side");
        throw new Error("Pagamento InfinitePay não aprovado na confirmação server-side");
      }
      if (!amountMatches(paidTx.amount, order.total_cents)) {
        await markEventError("Valor confirmado pela InfinitePay não corresponde ao pedido");
        throw new Error("Valor confirmado pela InfinitePay não corresponde ao pedido");
      }
      const rawOrderNsu = paidTx.order_nsu ?? raw.webhook?.order_nsu ?? raw.webhook?.orderNsu ?? raw.webhook?.nsu;
      if (rawOrderNsu && rawOrderNsu !== order.order_nsu) {
        await markEventError("Identificador recebido não corresponde ao pedido");
        throw new Error("Identificador recebido não corresponde ao pedido");
      }
    }
  }

  await supabaseAdmin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payment.id);

  const origin = process.env.PUBLIC_APP_URL ?? "https://imag.net.br";
  const onboarding = await onboardPaidCustomer({
    email: order.email,
    productId: order.product_id,
    paymentId: payment.id,
    orderId: order.id,
    redirectTo: `${origin}/app`,
  });

  await supabaseAdmin
    .from("payments")
    .update({
      raw_payload: {
        ...(input.raw as object),
        onboarding: {
          tokenHash: onboarding.tokenHash,
          userId: onboarding.userId,
          created: onboarding.created,
        },
      } as never,
    })
    .eq("id", payment.id);

  await supabaseAdmin
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", input.eventId);

  // Hook do Círculo iMAG — cria comissão idempotente.
  try {
    const { createReferralCommission, ensureAmbassador } = await import(
      "@/lib/referrals/commissions.server"
    );
    if (onboarding.userId) {
      await ensureAmbassador(onboarding.userId, order.email).catch((e) =>
        console.warn("[referral] ensureAmbassador", e),
      );
    }
    await createReferralCommission(payment.id).catch((e) =>
      console.warn("[referral] createReferralCommission", e),
    );
  } catch (e) {
    console.warn("[referral] hook falhou (não crítico)", e);
  }

  return { processed: true };
}

/** Reversão a partir de webhook de refund/chargeback. */
export async function processRefundedPayment(input: {
  provider: PaymentProviderId;
  providerIntentId: string;
  reason?: string;
}): Promise<{ reversed: boolean }> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("provider", input.provider)
    .eq("provider_intent_id", input.providerIntentId)
    .maybeSingle();
  if (!payment) return { reversed: false };
  const { reverseReferralCommission } = await import(
    "@/lib/referrals/commissions.server"
  );
  return reverseReferralCommission(payment.id, input.reason ?? "refund");
}