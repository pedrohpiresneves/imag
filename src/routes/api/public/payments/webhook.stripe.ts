import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe.server";
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

async function recordEvent(
  env: StripeEnv,
  eventId: string,
  eventType: string,
  payload: unknown,
) {
  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    environment: env,
    stripe_event_id: eventId,
    event_type: eventType,
    payload: payload as never,
  });
  // 23505 = unique_violation → evento duplicado
  if (error && error.code !== "23505") throw error;
  return { duplicate: error?.code === "23505" };
}

async function markProcessed(env: StripeEnv, eventId: string, err?: string) {
  await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      ...(err ? { error: err } : {}),
    })
    .eq("environment", env)
    .eq("stripe_event_id", eventId);
}

export const Route = createFileRoute("/api/public/payments/webhook/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid_env" });
        }
        const env: StripeEnv = rawEnv;

        let event: Awaited<ReturnType<typeof verifyStripeWebhook>>;
        try {
          event = await verifyStripeWebhook(request, env);
        } catch (e) {
          console.error("[stripe][webhook] verify falhou", e);
          return new Response("invalid_signature", { status: 400 });
        }

        try {
          const { duplicate } = await recordEvent(
            env,
            event.id,
            event.type,
            event.data.object,
          );
          if (duplicate) {
            return Response.json({ received: true, deduped: true });
          }

          switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscriptionRow(
                event.data.object as StripeSubscription,
                env,
              );
              break;
            case "customer.subscription.deleted":
              await markSubscriptionCanceled(
                event.data.object as StripeSubscription,
                env,
              );
              break;
            case "invoice.paid":
            case "invoice.payment_succeeded":
              await handleInvoicePaid(event.data.object as StripeInvoice, env);
              break;
            case "invoice.payment_failed":
              await handleInvoicePaymentFailed(event.data.object as StripeInvoice);
              break;
            case "charge.refunded":
              await handleChargeRefunded(event.data.object as StripeCharge, env);
              break;
            default:
              // Não trata, mas registra como processado.
              break;
          }

          await markProcessed(env, event.id);
          return Response.json({ received: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[stripe][webhook] handler falhou", message);
          await markProcessed(env, event.id, message).catch(() => undefined);
          return new Response("handler_error", { status: 500 });
        }
      },
    },
  },
});