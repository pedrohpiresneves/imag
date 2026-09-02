// Adapter InfinitePay — Checkout link (público).
//
// A integração oficial do "Checkout InfinitePay" NÃO usa API Key, Client ID
// nem Client Secret. A conta é identificada pela InfiniteTag (handle público
// do lojista), que faz parte da URL de checkout.
//
// Env vars:
//   - INFINITEPAY_TAG     (obrigatório) — sua InfiniteTag (ex: "agendamagnetica")
//   - PUBLIC_APP_URL      (opcional)   — origem do app; default imag.net.br
//
// Fluxo:
//   1. createIntent monta a URL do checkout público com order_nsu = orderNsu,
//      redirect_url = /pagamento/confirmando?p=<paymentId> e webhook_url apontando
//      pra /api/public/payments/infinitepay-webhook.
//   2. O cliente é redirecionado (mesma aba) pro checkout hospedado da
//      InfinitePay.
//   3. Webhook + fallback via payment_check confirmam o pagamento server-side.

import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  WebhookEvent,
} from "../types";

// Aceita o handle com ou sem "@" — a InfinitePay não usa "@" na URL.
const TAG = (process.env.INFINITEPAY_TAG ?? "").trim().replace(/^@+/, "");
const CHECKOUT_BASE = "https://checkout.infinitepay.io";
const API_BASE = "https://api.infinitepay.io";

function assertReady(): void {
  if (!TAG) {
    throw new Error(
      "[infinitepay] INFINITEPAY_TAG não configurada. Adicione o secret com sua InfiniteTag.",
    );
  }
}

function appOrigin(): string {
  return (process.env.PUBLIC_APP_URL ?? "https://imag.net.br").replace(/\/$/, "");
}

export interface InfinitePayTransaction {
  transaction_nsu?: string;
  nsu?: string;
  order_nsu?: string;
  invoice_slug?: string;
  amount?: number;
  paid?: boolean;
  capture_method?: string;
  installments?: number;
  receipt_url?: string;
  card_last_four?: string;
  card_brand?: string;
}

/**
 * Consulta o status oficial da transação diretamente na InfinitePay.
 * Endpoint público documentado:
 *   GET https://api.infinitepay.io/invoices/public/checkout/payment_check/{handle}/{order_nsu}
 * Retorna array de transações. Uma transação com `paid: true` = aprovada.
 */
export async function checkInfinitepayPayment(orderNsu: string): Promise<{
  paid: boolean;
  transactions: InfinitePayTransaction[];
}> {
  // Lê o handle em tempo de chamada (env não é confiável em escopo de módulo).
  const handle = (
    process.env["INFINITEPAY_HANDLE"] ??
    process.env["INFINITEPAY_TAG"] ??
    TAG ??
    ""
  )
    .trim()
    .replace(/^[$@]+/, "");
  if (!handle) throw new Error("[infinitepay] handle não configurado");
  const url = `${API_BASE}/invoices/public/checkout/payment_check/${encodeURIComponent(handle)}/${encodeURIComponent(orderNsu)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return { paid: false, transactions: [] };
  }
  const raw = (await res.json()) as unknown;
  const list: InfinitePayTransaction[] = Array.isArray(raw)
    ? (raw as InfinitePayTransaction[])
    : raw && typeof raw === "object" && Array.isArray((raw as { transactions?: unknown }).transactions)
      ? ((raw as { transactions: InfinitePayTransaction[] }).transactions)
      : [];
  const paid = list.some((t) => t.paid === true);
  return { paid, transactions: list };
}

export const infinitepayProvider: PaymentProvider = {
  id: "infinitepay",
  get ready() {
    return Boolean(TAG);
  },

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    assertReady();
    const origin = appOrigin();
    const redirectUrl = `${origin}/pagamento/confirmando?p=${encodeURIComponent(input.paymentId)}`;
    const webhookUrl = `${origin}/api/public/payments/infinitepay-webhook`;

    // Payload oficial do Checkout InfinitePay: usa `description` para o item.
    // Enviamos também `name` como fallback pra retrocompat.
    const description = input.description || "Agenda Magnética - Acesso Vitalício";
    const items = [
      {
        description,
        name: description,
        quantity: 1,
        price: input.amountCents, // em centavos (19700 = R$ 197,00)
      },
    ];

    const params = new URLSearchParams();
    params.set("items", JSON.stringify(items));
    params.set("order_nsu", input.orderNsu);
    params.set("redirect_url", redirectUrl);
    params.set("webhook_url", webhookUrl);
    if (input.email) params.set("customer_email", input.email);
    if (input.metadata?.customer_name) params.set("customer_name", input.metadata.customer_name);

    const checkoutUrl = `${CHECKOUT_BASE}/${encodeURIComponent(TAG)}?${params.toString()}`;

    // Log server-side pra inspeção quando o checkout falha ("Algo deu errado").
    console.log("[infinitepay] createIntent", {
      handle: TAG,
      items,
      order_nsu: input.orderNsu,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      customer_email: input.email,
      checkoutUrl,
    });

    return {
      providerIntentId: input.orderNsu, // order_nsu oficial usado no payment_check
      status: "pending",
      method: input.method,
      amountCents: input.amountCents,
      redirectUrl: checkoutUrl,
      raw: { handle: TAG, checkoutUrl, redirectUrl, webhookUrl, items },
    };
  },

  async getIntent(providerIntentId: string): Promise<PaymentIntent> {
    const check = await checkInfinitepayPayment(providerIntentId);
    const status: PaymentStatus = check.paid ? "paid" : "pending";
    const tx = check.transactions[0];
    return {
      providerIntentId,
      status,
      method: "card",
      amountCents: tx?.amount ?? 0,
      raw: check,
    };
  },

  /**
   * A InfinitePay não fornece assinatura HMAC para o webhook público. Por
   * isso, tratamos o webhook apenas como *gatilho*: extraímos o order_nsu e
   * confirmamos o pagamento chamando o endpoint oficial payment_check.
   * A verificação real acontece na rota do webhook (server-side).
   */
  async verifyWebhook(_request: Request, rawBody: string): Promise<WebhookEvent> {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error("[infinitepay] webhook payload inválido");
    }
    const orderNsu =
      (payload.order_nsu as string | undefined) ??
      (payload.orderNsu as string | undefined) ??
      (payload.nsu as string | undefined);
    if (!orderNsu) throw new Error("[infinitepay] webhook sem order_nsu");

    const check = await checkInfinitepayPayment(orderNsu);
    const status: PaymentStatus = check.paid ? "paid" : "pending";
    const txNsu =
      (payload.transaction_nsu as string | undefined) ??
      check.transactions[0]?.transaction_nsu ??
      `${orderNsu}_${Date.now()}`;

    return {
      eventId: `infinitepay_${orderNsu}_${txNsu}`,
      eventType: check.paid ? "payment.paid" : "payment.pending",
      providerIntentId: orderNsu,
      status,
      raw: { webhook: payload, verified: check },
    };
  },
};