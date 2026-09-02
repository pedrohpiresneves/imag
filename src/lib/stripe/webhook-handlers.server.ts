/**
 * Handlers idempotentes de eventos Stripe.
 * Chamados apenas pelo route /api/public/payments/webhook.stripe após
 * verificação de assinatura HMAC.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  type StripeEnv,
  priceLookupFromStripe,
  IMAG_STRIPE_COMMISSION_CENTS,
} from "@/lib/stripe.server";

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  items: {
    data: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
      price: {
        id: string;
        lookup_key?: string;
        metadata?: Record<string, string>;
      };
    }>;
  };
  metadata?: Record<string, string>;
};

type StripeInvoice = {
  id: string;
  customer: string;
  subscription?: string | null;
  status: string | null;
  billing_reason?: string | null;
  amount_paid: number;
  currency: string;
  paid?: boolean;
  metadata?: Record<string, string>;
};

type StripeCharge = {
  id: string;
  customer: string;
  amount_refunded: number;
  refunded: boolean;
  invoice?: string | null;
};

async function findUserIdForSubscription(
  sub: StripeSubscription,
  env: StripeEnv,
): Promise<string | null> {
  // 1) Preferimos metadata.userId setado no create-checkout.
  const fromMeta = sub.metadata?.userId;
  if (fromMeta) return fromMeta;

  // 2) Fallback: procurar pelo stripe_customer_id no perfil.
  const column =
    env === "sandbox" ? "stripe_customer_id_sandbox" : "stripe_customer_id_live";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq(column, sub.customer)
    .maybeSingle();
  return data?.id ?? null;
}

export async function upsertSubscriptionRow(
  sub: StripeSubscription,
  env: StripeEnv,
): Promise<{ userId: string; priceLookup: string } | null> {
  const userId = await findUserIdForSubscription(sub, env);
  if (!userId) {
    console.warn("[stripe] subscription sem userId", sub.id);
    return null;
  }

  const item = sub.items?.data?.[0];
  const priceLookup = priceLookupFromStripe(item?.price) ?? "unknown";
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  const past_due_since =
    sub.status === "past_due" ? new Date().toISOString() : null;

  const { error } = await supabaseAdmin.from("stripe_subscriptions").upsert(
    {
      user_id: userId,
      environment: env,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      price_lookup_key: priceLookup,
      status: sub.status,
      trial_end: isoFromUnix(sub.trial_end),
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: isoFromUnix(sub.canceled_at),
      past_due_since,
      raw_metadata: sub.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "environment,stripe_subscription_id" },
  );
  if (error) throw error;

  // Espelha no profiles para o gate central (has_active_access) reconhecer
  // a assinatura Stripe além dos legados InfinitePay.
  const trialEndIso = isoFromUnix(sub.trial_end);
  const periodEndIso = isoFromUnix(periodEnd);
  const profilePatch: Record<string, unknown> = {
    subscription_status: sub.status,
    subscription_started_at: isoFromUnix(periodStart),
    subscription_renews_at: periodEndIso,
  };
  if (env === "sandbox") {
    profilePatch.stripe_customer_id_sandbox = sub.customer;
  } else {
    profilePatch.stripe_customer_id_live = sub.customer;
  }
  if (sub.status === "trialing" && trialEndIso) {
    profilePatch.trial_ends_at = trialEndIso;
    profilePatch.trial_used = true;
    profilePatch.access_type = "trial";
  } else if (sub.status === "active") {
    profilePatch.access_type = "annual";
  } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    profilePatch.access_type = "revoked";
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update(profilePatch as any)
    .eq("id", userId);
  if (profileErr) {
    console.warn("[stripe] profile mirror falhou", userId, profileErr.message);
  }

  return { userId, priceLookup };
}

/**
 * Marca assinatura como cancelada. Mantém current_period_end para gate de acesso
 * (usuário continua acessando até o fim do período pago).
 */
export async function markSubscriptionCanceled(
  sub: StripeSubscription,
  env: StripeEnv,
) {
  await upsertSubscriptionRow({ ...sub, status: sub.status ?? "canceled" }, env);
}

/**
 * Trata invoice.paid — primeira fatura libera comissão do Círculo (idempotente).
 */
export async function handleInvoicePaid(inv: StripeInvoice, env: StripeEnv) {
  if (!inv.subscription) return;
  const { data: sub } = await supabaseAdmin
    .from("stripe_subscriptions")
    .select("id, user_id, price_lookup_key, first_invoice_paid_at, environment")
    .eq("environment", env)
    .eq("stripe_subscription_id", inv.subscription)
    .maybeSingle();
  if (!sub) {
    console.warn("[stripe] invoice.paid sem subscription row", inv.id);
    return;
  }

  // Idempotência: só a primeira fatura de assinatura libera comissão.
  const isFirst = !sub.first_invoice_paid_at;
  if (isFirst) {
    await supabaseAdmin
      .from("stripe_subscriptions")
      .update({ first_invoice_paid_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  if (isFirst && IMAG_STRIPE_COMMISSION_CENTS[sub.price_lookup_key]) {
    const { createStripeReferralCommission } = await import("./referral.server");
    await createStripeReferralCommission({
      env,
      userId: sub.user_id,
      stripeSubscriptionId: inv.subscription,
      stripeInvoiceId: inv.id,
      priceLookupKey: sub.price_lookup_key,
    }).catch((e: unknown) => console.warn("[stripe][referral] falhou", e));
  }
}

/**
 * invoice.payment_failed — Stripe entra em retry (past_due).
 * Só reflete via subscription.updated; aqui apenas loga.
 */
export async function handleInvoicePaymentFailed(inv: StripeInvoice) {
  console.warn("[stripe] invoice.payment_failed", inv.id);
}

/**
 * charge.refunded — reverte comissão vinculada à fatura.
 */
export async function handleChargeRefunded(charge: StripeCharge, env: StripeEnv) {
  if (!charge.invoice) return;
  const { reverseStripeReferralCommission } = await import("./referral.server");
  await reverseStripeReferralCommission({
    env,
    stripeInvoiceId: charge.invoice,
    reason: "refund",
  }).catch((e: unknown) => console.warn("[stripe][refund] falhou", e));
}

export type { StripeSubscription, StripeInvoice, StripeCharge };