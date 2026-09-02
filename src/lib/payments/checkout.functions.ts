import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { PaymentMethod, PaymentProviderId } from "./types";
import { PRICE_AMOUNT_CENTS, PRODUCT_ID } from "./products";

const createIntentSchema = z.object({
  productId: z.string().min(1),
  priceId: z.string().min(1),
  method: z.enum(["pix", "card", "boleto"]),
  email: z.string().email(),
  customerName: z.string().trim().min(1).max(120).optional(),
  couponCode: z.string().optional(),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
});

export type CreateIntentOutput =
  | {
      ok: true;
      paymentId: string;
      provider: PaymentProviderId;
      method: PaymentMethod;
      amountCents: number;
      pixQrCode?: string;
      pixCopyPaste?: string;
      redirectUrl?: string;
    }
  | { ok: false; error: string };

export const createPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((data: z.infer<typeof createIntentSchema>) => createIntentSchema.parse(data))
  .handler(async ({ data }): Promise<CreateIntentOutput> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { getProvider } = await import("./providers/registry.server");
      const { resolveAttributionFromCookie } = await import(
        "@/lib/referrals/attribution.server"
      );

      const { data: price } = await supabaseAdmin
        .from("prices")
        .select("id, product_id, amount_cents, currency, active")
        .eq("id", data.priceId)
        .maybeSingle();
      if (!price || !price.active) return { ok: false, error: "Preço indisponível" };
      if (price.product_id !== data.productId) return { ok: false, error: "Preço não pertence ao produto" };

      let discountCents = 0;
      if (data.couponCode) {
        const { data: coupon } = await supabaseAdmin
          .from("coupons")
          .select("code, discount_type, discount_value, max_uses, used_count, expires_at, active")
          .eq("code", data.couponCode.toUpperCase())
          .maybeSingle();
        if (
          coupon &&
          coupon.active &&
          (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) &&
          (coupon.max_uses == null || coupon.used_count < coupon.max_uses)
        ) {
          discountCents =
            coupon.discount_type === "percent"
              ? Math.floor((price.amount_cents * coupon.discount_value) / 100)
              : coupon.discount_value;
        }
      }
      const total = Math.max(0, price.amount_cents - discountCents);
      if (data.productId !== PRODUCT_ID || total !== PRICE_AMOUNT_CENTS) {
        return { ok: false, error: "Produto ou valor inválido para este checkout" };
      }

      // Resolve atribuição de indicação a partir do cookie do visitante.
      let referral: {
        attributionId: string;
        code: string;
        ambassadorUserId: string;
      } | null = null;
      try {
        const req = getRequest();
        referral = await resolveAttributionFromCookie(req?.headers.get("cookie") ?? null);
        if (referral) {
          const { data: amb } = await supabaseAdmin
            .from("ambassadors")
            .select("user_id")
            .eq("user_id", referral.ambassadorUserId)
            .maybeSingle();
          if (amb) {
            const { data: ambUser } = await supabaseAdmin.auth.admin.getUserById(
              referral.ambassadorUserId,
            );
            if (
              ambUser?.user?.email &&
              ambUser.user.email.toLowerCase() === data.email.toLowerCase()
            ) {
              referral = null; // self-referral por email
            }
          }
        }
      } catch (e) {
        console.warn("[createPaymentIntent] attribution", e);
      }

      const orderNsu = `am_${crypto.randomUUID().replace(/-/g, "")}`;
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          order_nsu: orderNsu,
          email: data.email.toLowerCase(),
          product_id: data.productId,
          price_id: data.priceId,
          coupon_code: data.couponCode ? data.couponCode.toUpperCase() : null,
          subtotal_cents: price.amount_cents,
          discount_cents: discountCents,
          total_cents: total,
          currency: price.currency,
          status: "pending",
          referral_code: referral?.code ?? null,
          referrer_user_id: referral?.ambassadorUserId ?? null,
          referral_attribution_id: referral?.attributionId ?? null,
          metadata: data.customerName ? { customer_name: data.customerName } : {},
        })
        .select("id, order_nsu")
        .single();
      if (orderErr || !order) return { ok: false, error: `Falha criando pedido: ${orderErr?.message}` };

      const provider = getProvider();
      const { data: payment, error: payErr } = await supabaseAdmin
        .from("payments")
        .insert({
          order_id: order.id,
          provider: provider.id,
          method: data.method,
          amount_cents: total,
          currency: price.currency,
          status: "pending",
        })
        .select("id")
        .single();
      if (payErr || !payment) return { ok: false, error: `Falha criando pagamento: ${payErr?.message}` };

      const intent = await provider.createIntent({
        paymentId: payment.id,
        orderId: order.id,
        orderNsu: order.order_nsu,
        amountCents: total,
        currency: price.currency,
        method: data.method,
        email: data.email,
        description: "Agenda Magnética — acesso vitalício",
        metadata: { paymentId: payment.id, orderId: order.id, orderNsu: order.order_nsu },
        cardToken: data.cardToken,
        installments: data.installments,
      });

      await supabaseAdmin
        .from("payments")
        .update({
          provider_intent_id: intent.providerIntentId,
          pix_qr_code: intent.pixQrCode ?? null,
          pix_copy_paste: intent.pixCopyPaste ?? null,
          status: intent.status,
          raw_payload: intent.raw as never,
        })
        .eq("id", payment.id);

      return {
        ok: true,
        paymentId: payment.id,
        provider: provider.id,
        method: intent.method,
        amountCents: intent.amountCents,
        pixQrCode: intent.pixQrCode,
        pixCopyPaste: intent.pixCopyPaste,
        redirectUrl: intent.redirectUrl,
      };
    } catch (e) {
      console.error("[createPaymentIntent]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

const statusSchema = z.object({ paymentId: z.string().uuid() });

export type PaymentStatusOutput =
  | { status: "pending" | "processing" }
  | { status: "paid"; tokenHash: string | null; email: string }
  | { status: "failed" | "cancelled" | "refunded" };

export const getPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof statusSchema>) => statusSchema.parse(d))
  .handler(async ({ data }): Promise<PaymentStatusOutput> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Fallback ativo: se ainda não foi marcado como pago, consulta a
    // InfinitePay diretamente (payment_check) e processa como se fosse
    // um webhook. Idempotente — não duplica onboarding.
    const { data: pre } = await supabaseAdmin
      .from("payments")
      .select("id, provider, provider_intent_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (pre && pre.status !== "paid" && pre.provider === "infinitepay" && pre.provider_intent_id) {
      try {
        const { checkInfinitepayPayment } = await import(
          "./providers/infinitepay.server"
        );
        const check = await checkInfinitepayPayment(pre.provider_intent_id);
        if (check.paid) {
          const { processPaidPayment } = await import("./webhook-core.server");
          const tx = check.transactions.find((t) => t.paid === true) ?? check.transactions[0];
          const eventId = `infinitepay_${pre.provider_intent_id}_${tx?.transaction_nsu ?? tx?.nsu ?? "poll"}`;
          await processPaidPayment({
            provider: "infinitepay",
            providerIntentId: pre.provider_intent_id,
            eventId,
            eventType: "payment.paid",
            raw: { source: "fallback_poll", verified: check } as unknown,
          }).catch((e) => console.warn("[getPaymentStatus] fallback", e));
        }
      } catch (e) {
        console.warn("[getPaymentStatus] infinitepay poll", e);
      }
    }

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status, order_id, raw_payload")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) return { status: "failed" };
    if (payment.status === "paid") {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("email")
        .eq("id", payment.order_id)
        .maybeSingle();
      const raw = payment.raw_payload as { onboarding?: { tokenHash?: string } } | null;
      return {
        status: "paid",
        tokenHash: raw?.onboarding?.tokenHash ?? null,
        email: order?.email ?? "",
      };
    }
    return {
      status: payment.status as "pending" | "processing" | "failed" | "cancelled" | "refunded",
    };
  });

// Confirmação a partir do retorno da InfinitePay.
// Os parâmetros do navegador são apenas gatilho: a liberação depende de
// confirmação server-side via payment_check + validação de valor/produto.
const confirmReturnSchema = z.object({
  paymentId: z.string().uuid(),
  transactionNsu: z.string().optional(),
  receiptUrl: z.string().optional(),
  slug: z.string().optional(),
  orderNsu: z.string().optional(),
});

export const confirmInfinitepayReturn = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof confirmReturnSchema>) => confirmReturnSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, provider, provider_intent_id, status, order_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) return { ok: false, status: "not_found" };
    if (payment.status === "paid") return { ok: true, status: "paid" };
    if (payment.provider !== "infinitepay") return { ok: false, status: payment.status };

    let confirmed = false;
    let raw: unknown = { source: "return_params", ...data };
    if (payment.provider_intent_id) {
      try {
        const { checkInfinitepayPayment } = await import("./providers/infinitepay.server");
        const check = await checkInfinitepayPayment(payment.provider_intent_id);
        if (check.paid) {
          confirmed = true;
          raw = { source: "return_verify", verified: check, params: data };
        }
      } catch (e) {
        console.warn("[confirmInfinitepayReturn] payment_check", e);
      }
    }
    // Fallback: InfinitePay's public Checkout only redirects to `redirect_url`
    // após aprovação. Como o endpoint `payment_check` desta conta retorna
    // "Not found" (não expõe a consulta pública), confiamos nos parâmetros
    // devolvidos pela InfinitePay quando eles são consistentes com o pedido:
    //   - order_nsu enviado bate com o do pedido
    //   - há transaction_nsu (só a InfinitePay atribui)
    //   - receipt_url pertence ao domínio oficial recibo.infinitepay.io
    if (!confirmed && data.orderNsu && data.transactionNsu && data.receiptUrl) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("order_nsu")
        .eq("id", payment.order_id)
        .maybeSingle();
      let receiptHost = "";
      try {
        receiptHost = new URL(data.receiptUrl).hostname;
      } catch {
        /* ignore */
      }
      if (
        order?.order_nsu === data.orderNsu &&
        order.order_nsu === payment.provider_intent_id &&
        (receiptHost === "recibo.infinitepay.io" || receiptHost.endsWith(".infinitepay.io"))
      ) {
        confirmed = true;
        raw = { source: "return_params_trusted", params: data, admin_confirm: true };
      }
    }
    if (!confirmed) return { ok: false, status: "pending" };

    const { processPaidPayment } = await import("./webhook-core.server");
    const eventId = `infinitepay_return_${payment.provider_intent_id}_${data.transactionNsu ?? "notx"}`;
    const result = await processPaidPayment({
      provider: "infinitepay",
      providerIntentId: payment.provider_intent_id!,
      eventId,
      eventType: "payment.paid",
      raw,
    }).catch((e) => {
      console.warn("[confirmInfinitepayReturn] processPaidPayment", e);
      return { processed: false, reason: "validation_failed" };
    });
    return { ok: result.processed || result.reason === "already_paid" || result.reason === "order_already_paid", status: result.processed ? "paid" : "pending" };
  });

// (adminConfirmPayment vive em admin.functions.ts, com verificação de role)

// Retorna o e-mail associado a um pagamento aprovado, para o fallback
// da página /pagamento/liberado quando a sessão não foi estabelecida.
const paidEmailSchema = z.object({ paymentId: z.string().uuid() });

export const getPaidEmail = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof paidEmailSchema>) => paidEmailSchema.parse(d))
  .handler(async ({ data }): Promise<{ email: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status, order_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment || payment.status !== "paid") return { email: null };
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("email")
      .eq("id", payment.order_id)
      .maybeSingle();
    return { email: order?.email ?? null };
  });