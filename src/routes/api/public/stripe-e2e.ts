/**
 * Simulador E2E dos handlers Stripe (SANDBOX apenas).
 * Protegido por header X-Cron-Secret === CRON_SECRET.
 * Chama os handlers diretamente (sem passar por assinatura HMAC) para exercitar
 * cenários: trial, ativação, cancelamento, past_due, refund, comissões etc.
 *
 * NÃO removê-lo antes de finalizar validação do sandbox — em produção pode ser
 * deletado com segurança.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  upsertSubscriptionRow,
  markSubscriptionCanceled,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleChargeRefunded,
  type StripeSubscription,
  type StripeInvoice,
  type StripeCharge,
} from "@/lib/stripe/webhook-handlers.server";

type Scenario =
  | "monthly_trial_start"
  | "annual_trial_start"
  | "trial_to_active"
  | "payment_failed"
  | "cancel_during_trial"
  | "cancel_after_paid"
  | "renewal"
  | "refund"
  | "duplicate_webhook"
  | "access_when_none";

function nowUnix(offsetSec = 0) {
  return Math.floor(Date.now() / 1000) + offsetSec;
}

function subFixture(overrides: Partial<StripeSubscription>): StripeSubscription {
  return {
    id: "sub_e2e_" + Math.random().toString(36).slice(2, 10),
    customer: "cus_e2e_" + Math.random().toString(36).slice(2, 10),
    status: "trialing",
    trial_end: nowUnix(10 * 86400),
    current_period_start: nowUnix(),
    current_period_end: nowUnix(10 * 86400),
    cancel_at_period_end: false,
    canceled_at: null,
    items: {
      data: [
        {
          current_period_start: nowUnix(),
          current_period_end: nowUnix(10 * 86400),
          price: {
            id: "price_e2e",
            lookup_key: "imag_mensal_recorrente",
            metadata: {},
          },
        },
      ],
    },
    metadata: {},
    ...overrides,
  };
}

function invoiceFixture(over: Partial<StripeInvoice>): StripeInvoice {
  return {
    id: "in_e2e_" + Math.random().toString(36).slice(2, 10),
    customer: "cus_e2e",
    subscription: "sub_e2e",
    status: "paid",
    billing_reason: "subscription_create",
    amount_paid: 2200,
    currency: "brl",
    paid: true,
    metadata: {},
    ...over,
  };
}

async function runScenario(
  scenario: Scenario,
  userId: string,
): Promise<Record<string, unknown>> {
  const env = "sandbox" as const;
  const log: Record<string, unknown> = { scenario, userId };

  switch (scenario) {
    case "monthly_trial_start": {
      const sub = subFixture({ metadata: { userId } });
      await upsertSubscriptionRow(sub, env);
      log.subscriptionId = sub.id;
      break;
    }
    case "annual_trial_start": {
      const sub = subFixture({
        metadata: { userId },
        items: {
          data: [
            {
              current_period_start: nowUnix(),
              current_period_end: nowUnix(375 * 86400),
              price: { id: "price_e2e_annual", lookup_key: "imag_anual_recorrente", metadata: {} },
            },
          ],
        },
        current_period_end: nowUnix(375 * 86400),
      });
      await upsertSubscriptionRow(sub, env);
      log.subscriptionId = sub.id;
      break;
    }
    case "trial_to_active": {
      const sub = subFixture({
        metadata: { userId },
        status: "active",
        trial_end: nowUnix(-1),
      });
      await upsertSubscriptionRow(sub, env);
      const inv = invoiceFixture({
        subscription: sub.id,
        billing_reason: "subscription_cycle",
        customer: sub.customer,
      });
      await handleInvoicePaid(inv, env);
      log.subscriptionId = sub.id;
      log.invoiceId = inv.id;
      break;
    }
    case "payment_failed": {
      const sub = subFixture({ metadata: { userId }, status: "past_due" });
      await upsertSubscriptionRow(sub, env);
      await handleInvoicePaymentFailed(
        invoiceFixture({ subscription: sub.id, status: "open", paid: false, amount_paid: 0 }),
      );
      log.subscriptionId = sub.id;
      break;
    }
    case "cancel_during_trial": {
      const sub = subFixture({ metadata: { userId }, status: "canceled", canceled_at: nowUnix() });
      await markSubscriptionCanceled(sub, env);
      log.subscriptionId = sub.id;
      break;
    }
    case "cancel_after_paid": {
      const sub = subFixture({
        metadata: { userId },
        status: "active",
        cancel_at_period_end: true,
      });
      await upsertSubscriptionRow(sub, env);
      log.subscriptionId = sub.id;
      break;
    }
    case "renewal": {
      const sub = subFixture({
        metadata: { userId },
        status: "active",
        current_period_start: nowUnix(),
        current_period_end: nowUnix(30 * 86400),
      });
      await upsertSubscriptionRow(sub, env);
      const inv = invoiceFixture({
        subscription: sub.id,
        billing_reason: "subscription_cycle",
        customer: sub.customer,
      });
      // Segunda fatura NÃO gera comissão.
      await handleInvoicePaid(inv, env);
      await handleInvoicePaid(
        invoiceFixture({
          subscription: sub.id,
          billing_reason: "subscription_cycle",
          customer: sub.customer,
        }),
        env,
      );
      log.subscriptionId = sub.id;
      break;
    }
    case "refund": {
      const sub = subFixture({ metadata: { userId }, status: "active" });
      await upsertSubscriptionRow(sub, env);
      const inv = invoiceFixture({
        subscription: sub.id,
        billing_reason: "subscription_create",
        customer: sub.customer,
      });
      await handleInvoicePaid(inv, env);
      const charge: StripeCharge = {
        id: "ch_e2e_" + Math.random().toString(36).slice(2, 10),
        customer: sub.customer,
        amount_refunded: 2200,
        refunded: true,
        invoice: inv.id,
      };
      await handleChargeRefunded(charge, env);
      log.subscriptionId = sub.id;
      log.invoiceId = inv.id;
      log.chargeId = charge.id;
      break;
    }
    case "duplicate_webhook": {
      const sub = subFixture({ metadata: { userId }, status: "active" });
      await upsertSubscriptionRow(sub, env);
      const inv = invoiceFixture({
        subscription: sub.id,
        billing_reason: "subscription_create",
        customer: sub.customer,
      });
      await handleInvoicePaid(inv, env);
      await handleInvoicePaid(inv, env); // duplicado
      log.subscriptionId = sub.id;
      log.invoiceId = inv.id;
      break;
    }
    case "access_when_none": {
      // Não cria nada. Só confirma que sem stripe row + sem trial no perfil,
      // has_active_access retorna false.
      break;
    }
  }

  // Coleta estado final para inspeção.
  const { data: subs } = await supabaseAdmin
    .from("stripe_subscriptions")
    .select("stripe_subscription_id, status, price_lookup_key, trial_end, current_period_end, cancel_at_period_end, first_invoice_paid_at")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: commissions } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, source, status, amount_cents, stripe_invoice_id, reversed_at, reversal_reason")
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("subscription_status, trial_ends_at, subscription_renews_at, access_type, has_access")
    .eq("id", userId)
    .maybeSingle();
  const { data: hasAccess } = await supabaseAdmin.rpc("has_active_access", {
    _user_id: userId,
  });

  log.state = { subs, commissions, profile: prof, has_active_access: hasAccess };
  return log;
}

export const Route = createFileRoute("/api/public/stripe-e2e")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await request.json()) as {
          scenario: Scenario;
          userId: string;
        };
        if (!body?.userId) {
          return Response.json({ error: "userId required" }, { status: 400 });
        }
        try {
          const result = await runScenario(body.scenario, body.userId);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === "object" && e
                ? JSON.stringify(e)
                : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});