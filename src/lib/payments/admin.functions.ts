import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso negado");
}

export type AdminPaymentRow = {
  id: string;
  provider: string;
  method: string;
  status: string;
  amount_cents: number;
  created_at: string;
  paid_at: string | null;
  provider_intent_id: string | null;
  order_id: string;
  order_nsu: string | null;
  email: string;
  user_id: string | null;
  has_access: boolean;
  access_type: string | null;
};

async function hydrateRows(
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    status: string;
    amount_cents: number;
    created_at: string;
    paid_at: string | null;
    provider_intent_id: string | null;
    order_id: string;
  }>,
): Promise<AdminPaymentRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return Promise.all(
    payments.map(async (p) => {
      const { data: o } = await supabaseAdmin
        .from("orders")
        .select("email, order_nsu, user_id")
        .eq("id", p.order_id)
        .maybeSingle();
      let hasAccess = false;
      let accessType: string | null = null;
      if (o?.user_id) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("has_access, access_type")
          .eq("id", o.user_id)
          .maybeSingle();
        hasAccess = Boolean(prof?.has_access);
        accessType = prof?.access_type ?? null;
      }
      return {
        ...p,
        email: o?.email ?? "",
        order_nsu: o?.order_nsu ?? null,
        user_id: o?.user_id ?? null,
        has_access: hasAccess,
        access_type: accessType,
      };
    }),
  );
}

export const listRecentPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPaymentRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, provider, method, status, amount_cents, created_at, paid_at, provider_intent_id, order_id")
      .order("created_at", { ascending: false })
      .limit(50);
    return hydrateRows(data ?? []);
  });

const searchSchema = z.object({ query: z.string().trim().min(1).max(200) });

export const searchPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof searchSchema>) => searchSchema.parse(d))
  .handler(async ({ data, context }): Promise<AdminPaymentRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    // Casa por e-mail (ilike), order_nsu exato, id do pedido ou do pagamento.
    const orderFilters = supabaseAdmin
      .from("orders")
      .select("id")
      .or(`email.ilike.%${q}%,order_nsu.eq.${q},id.eq.${isUuid(q) ? q : "00000000-0000-0000-0000-000000000000"}`);
    const { data: matchedOrders } = await orderFilters.limit(50);
    const orderIds = (matchedOrders ?? []).map((o) => o.id);
    let paymentQuery = supabaseAdmin
      .from("payments")
      .select("id, provider, method, status, amount_cents, created_at, paid_at, provider_intent_id, order_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (orderIds.length && isUuid(q)) {
      paymentQuery = paymentQuery.or(
        `order_id.in.(${orderIds.join(",")}),id.eq.${q},provider_intent_id.eq.${q}`,
      );
    } else if (orderIds.length) {
      paymentQuery = paymentQuery.or(
        `order_id.in.(${orderIds.join(",")}),provider_intent_id.eq.${q}`,
      );
    } else if (isUuid(q)) {
      paymentQuery = paymentQuery.or(`id.eq.${q},provider_intent_id.eq.${q}`);
    } else {
      paymentQuery = paymentQuery.eq("provider_intent_id", q);
    }
    const { data: payments } = await paymentQuery;
    return hydrateRows(payments ?? []);
  });

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const confirmSchema = z.object({ paymentId: z.string().uuid() });

export const adminConfirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof confirmSchema>) => confirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processPaidPayment } = await import("./webhook-core.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, provider, provider_intent_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) return { ok: false, error: "Pagamento não encontrado" };
    const result = await processPaidPayment({
      provider: (payment.provider as "manual" | "infinitepay" | "stripe" | "mercadopago") ?? "manual",
      providerIntentId: payment.provider_intent_id ?? `manual_${payment.id}`,
      eventId: `admin_confirm_${payment.id}_${Date.now()}`,
      eventType: "payment.paid",
      raw: { admin_confirm: true },
    });
    return { ok: true, ...result };
  });

// Reexecuta a verificação server-side (payment_check da InfinitePay) para um pagamento.
// Não força liberação — apenas tenta confirmar via provedor.
export const adminRecheckPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof confirmSchema>) => confirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, provider, provider_intent_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) return { ok: false, error: "Pagamento não encontrado" };
    if (payment.status === "paid") return { ok: true, status: "paid", reason: "already_paid" };
    if (payment.provider !== "infinitepay" || !payment.provider_intent_id) {
      return { ok: false, error: "Reverificação disponível apenas para InfinitePay" };
    }
    const { checkInfinitepayPayment } = await import("./providers/infinitepay.server");
    const check = await checkInfinitepayPayment(payment.provider_intent_id);
    if (!check.paid) {
      return { ok: false, status: "pending", check };
    }
    const { processPaidPayment } = await import("./webhook-core.server");
    const tx = check.transactions.find((t) => t.paid) ?? check.transactions[0];
    const result = await processPaidPayment({
      provider: "infinitepay",
      providerIntentId: payment.provider_intent_id,
      eventId: `admin_recheck_${payment.id}_${tx?.transaction_nsu ?? tx?.nsu ?? Date.now()}`,
      eventType: "payment.paid",
      raw: { source: "admin_recheck", verified: check },
    });
    return { ok: true, status: "paid", ...result };
  });