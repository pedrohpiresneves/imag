/**
 * Confirmação oficial de pagamentos InfinitePay — camada server-only.
 *
 * O webhook do Checkout Integrado NÃO possui assinatura HMAC. Por isso ele é
 * tratado apenas como *gatilho*: a fonte da verdade é a chamada
 * POST https://api.checkout.infinitepay.io/payment_check
 * (handle, transaction_nsu, external_order_nsu, slug), que devolve
 * { success, paid, amount }.
 */

import { infinitepayHandle } from "./infinitepay-checkout.server";

const PAYMENT_CHECK_ENDPOINT = "https://api.checkout.infinitepay.io/payment_check";

export type InfinitepayWebhookPayload = {
  invoice_slug: string;
  amount: number;
  paid_amount?: number | null;
  installments?: number | null;
  capture_method?: string | null;
  transaction_nsu: string;
  order_nsu: string;
  receipt_url?: string | null;
};

export function parseWebhookPayload(raw: unknown): InfinitepayWebhookPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.round(v)
      : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
        ? Math.round(Number(v))
        : null;

  const invoice_slug = str(b["invoice_slug"]);
  const transaction_nsu = str(b["transaction_nsu"]);
  const order_nsu = str(b["order_nsu"]);
  const amount = num(b["amount"]);
  if (!invoice_slug || !transaction_nsu || !order_nsu || amount === null) return null;

  return {
    invoice_slug,
    transaction_nsu,
    order_nsu,
    amount,
    paid_amount: num(b["paid_amount"]),
    installments: num(b["installments"]),
    capture_method: str(b["capture_method"]),
    receipt_url: str(b["receipt_url"]),
  };
}

export type PaymentCheckResult = {
  success: boolean;
  paid: boolean;
  amount: number | null;
  raw: unknown;
};

/** Reconfirma o pagamento diretamente na InfinitePay (server-to-server). */
export async function paymentCheck(input: {
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug: string;
}): Promise<PaymentCheckResult> {
  const handle = infinitepayHandle();
  if (!handle) throw new Error("INFINITEPAY_HANDLE não configurado");

  const res = await fetch(PAYMENT_CHECK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      handle,
      transaction_nsu: input.transactionNsu,
      external_order_nsu: input.orderNsu,
      slug: input.invoiceSlug,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[infinitepay] payment_check falhou", res.status, text.slice(0, 400));
    return { success: false, paid: false, amount: null, raw: text.slice(0, 400) };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("[infinitepay] payment_check resposta não-JSON", text.slice(0, 400));
    return { success: false, paid: false, amount: null, raw: text.slice(0, 400) };
  }

  const amountRaw = parsed["amount"];
  const amount =
    typeof amountRaw === "number"
      ? Math.round(amountRaw)
      : typeof amountRaw === "string" && Number.isFinite(Number(amountRaw))
        ? Math.round(Number(amountRaw))
        : null;

  return {
    success: parsed["success"] === true,
    paid: parsed["paid"] === true,
    amount,
    raw: parsed,
  };
}

export type WebhookOutcome =
  | { httpStatus: 200; body: { success: true; message: null } }
  | { httpStatus: 400; body: { success: false; message: string } };

const OK: WebhookOutcome = { httpStatus: 200, body: { success: true, message: null } };
const fail = (message: string): WebhookOutcome => ({
  httpStatus: 400,
  body: { success: false, message },
});

/** Fluxo completo: valida, reconfirma, grava e ativa a assinatura. */
export async function handleInfinitepayWebhook(rawBody: string): Promise<WebhookOutcome> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return fail("Payload inválido");
  }

  const payload = parseWebhookPayload(json);
  if (!payload) return fail("Payload inválido");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: tx } = await supabaseAdmin
    .from("payment_transactions")
    .select("id, user_id, plan, amount, status, external_transaction_id")
    .eq("provider", "infinitepay")
    .eq("external_order_id", payload.order_nsu)
    .maybeSingle();

  if (!tx) return fail("Pedido não encontrado");

  // Idempotência: mesmo webhook reenviado responde sucesso sem reativar nada.
  if (tx.status === "paid" && tx.external_transaction_id === payload.transaction_nsu) {
    return OK;
  }
  if (tx.status !== "pending") return OK;

  // O valor anunciado pelo webhook precisa bater com o registrado no banco.
  if (payload.amount !== tx.amount) {
    console.error("[infinitepay] valor divergente no webhook", {
      order: payload.order_nsu,
      esperado: tx.amount,
      recebido: payload.amount,
    });
    await supabaseAdmin
      .from("payment_transactions")
      .update({
        status: "failed",
        raw_provider_status: { reason: "amount_mismatch", webhook: payload } as never,
      })
      .eq("id", tx.id);
    return fail("Valor divergente");
  }

  // Fonte da verdade: confirmação oficial na InfinitePay.
  const check = await paymentCheck({
    orderNsu: payload.order_nsu,
    transactionNsu: payload.transaction_nsu,
    invoiceSlug: payload.invoice_slug,
  });

  if (!check.success || !check.paid || check.amount !== tx.amount) {
    console.error("[infinitepay] payment_check não aprovou", {
      order: payload.order_nsu,
      success: check.success,
      paid: check.paid,
      amount: check.amount,
      esperado: tx.amount,
    });
    return OK; // recebido, mas sem ativação
  }

  const now = new Date();
  const { error: updateError } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "paid",
      external_transaction_id: payload.transaction_nsu,
      raw_provider_status: { status: "paid", webhook: payload, payment_check: check.raw } as never,
      paid_at: now.toISOString(),
      invoice_slug: payload.invoice_slug,
      paid_amount: payload.paid_amount ?? check.amount,
      installments: payload.installments,
      capture_method: payload.capture_method,
      receipt_url: payload.receipt_url,
    })
    .eq("id", tx.id)
    .eq("status", "pending"); // trava de concorrência: só o 1º webhook grava

  if (updateError) {
    // Violação de unicidade em external_transaction_id = webhook duplicado.
    console.error("[infinitepay] update da transação falhou", updateError);
    return OK;
  }

  const plan = tx.plan === "annual" ? "annual" : "monthly";
  const { activateSubscriptionFromPayment } = await import(
    "@/lib/subscriptions/subscription.server"
  );
  const end = new Date(now);
  if (plan === "annual") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  await activateSubscriptionFromPayment({
    userId: tx.user_id,
    plan,
    paymentProvider: "infinitepay",
    externalPaymentId: payload.transaction_nsu,
    periodStart: now.toISOString(),
    periodEnd: end.toISOString(),
  });

  return OK;
}