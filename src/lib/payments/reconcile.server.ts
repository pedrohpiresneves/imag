/**
 * Reconciliação de pagamentos InfinitePay — camada server-only.
 *
 * Nunca libera acesso por parâmetro de URL ou por toque do usuário: a única
 * fonte de verdade é a consulta oficial `payment_check` (server-to-server).
 * É idempotente — reprocessar o mesmo pagamento não duplica assinatura.
 */

export type ReconcileStatus = "active" | "processing" | "not_found";

export type ReconcileResult = {
  status: ReconcileStatus;
  /** Quantidade de pagamentos que passaram de pendente para pago agora. */
  activated: number;
};

const WINDOW_DAYS = 60;

export async function reconcileUserPayments(userId: string): Promise<ReconcileResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { checkInfinitepayPayment } = await import("./providers/infinitepay.server");
  const { activateSubscriptionFromPayment } = await import(
    "@/lib/subscriptions/subscription.server"
  );

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("payment_transactions")
    .select("id, user_id, plan, amount, status, external_order_id, external_transaction_id")
    .eq("user_id", userId)
    .eq("provider", "infinitepay")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[reconcile] leitura de payment_transactions falhou", {
      userId,
      message: error.message,
    });
    return { status: "not_found", activated: 0 };
  }

  const list = rows ?? [];
  if (list.length === 0) return { status: "not_found", activated: 0 };

  let activated = 0;
  let sawPaid = false;
  let sawPending = false;

  for (const tx of list) {
    if (tx.status === "paid") {
      sawPaid = true;
      // Garante que a assinatura existe mesmo se a ativação falhou antes.
      if (tx.external_transaction_id) {
        await activateSubscriptionFromPayment({
          userId,
          plan: tx.plan === "annual" ? "annual" : "monthly",
          paymentProvider: "infinitepay",
          externalPaymentId: tx.external_transaction_id,
        }).catch((e) => console.error("[reconcile] reativação falhou", { userId, e }));
      }
      continue;
    }

    if (tx.status !== "pending" || !tx.external_order_id) continue;
    sawPending = true;

    let check: Awaited<ReturnType<typeof checkInfinitepayPayment>>;
    try {
      check = await checkInfinitepayPayment(tx.external_order_id);
    } catch (e) {
      console.error("[reconcile] payment_check falhou", {
        userId,
        order: tx.external_order_id,
        message: e instanceof Error ? e.message : "unknown",
      });
      continue;
    }

    const paidTx = check.transactions.find((t) => t.paid === true);
    if (!check.paid || !paidTx) continue;

    // O valor confirmado precisa bater com o registrado no banco.
    if (typeof paidTx.amount === "number" && paidTx.amount !== tx.amount) {
      console.error("[reconcile] valor divergente", {
        userId,
        order: tx.external_order_id,
        esperado: tx.amount,
        recebido: paidTx.amount,
      });
      continue;
    }

    const transactionNsu =
      paidTx.transaction_nsu ?? paidTx.nsu ?? `${tx.external_order_id}_reconciled`;
    const now = new Date();

    const { error: updateError } = await supabaseAdmin
      .from("payment_transactions")
      .update({
        status: "paid",
        external_transaction_id: transactionNsu,
        paid_at: now.toISOString(),
        paid_amount: paidTx.amount ?? tx.amount,
        invoice_slug: paidTx.invoice_slug ?? null,
        installments: paidTx.installments ?? null,
        capture_method: paidTx.capture_method ?? null,
        receipt_url: paidTx.receipt_url ?? null,
        raw_provider_status: { source: "reconcile", verified: paidTx } as never,
      })
      .eq("id", tx.id)
      .eq("status", "pending"); // trava de concorrência

    if (updateError) {
      console.error("[reconcile] update da transação falhou", {
        userId,
        order: tx.external_order_id,
        message: updateError.message,
      });
      continue;
    }

    const plan = tx.plan === "annual" ? "annual" : "monthly";
    const end = new Date(now);
    if (plan === "annual") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    await activateSubscriptionFromPayment({
      userId,
      plan,
      paymentProvider: "infinitepay",
      externalPaymentId: transactionNsu,
      periodStart: now.toISOString(),
      periodEnd: end.toISOString(),
    });

    activated += 1;
    sawPaid = true;
    console.info("[reconcile] pagamento confirmado", {
      userId,
      order: tx.external_order_id,
      previous: "pending",
      current: "paid",
      source: "reconcile",
    });
  }

  if (sawPaid) return { status: "active", activated };
  if (sawPending) return { status: "processing", activated };
  return { status: "not_found", activated };
}
