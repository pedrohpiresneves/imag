import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const { getProviderById } = await import("@/lib/payments/providers/registry.server");
          const { processPaidPayment, processRefundedPayment } = await import(
            "@/lib/payments/webhook-core.server"
          );

          const providerId = params.provider as
            | "infinitepay"
            | "stripe"
            | "mercadopago"
            | "manual";
          const provider = getProviderById(providerId);
          const rawBody = await request.text();
          const event = await provider.verifyWebhook(request, rawBody);

          if (event.status !== "paid") {
            if (event.status === "refunded" || event.status === "cancelled") {
              await processRefundedPayment({
                provider: provider.id,
                providerIntentId: event.providerIntentId,
                reason: event.status,
              });
            }
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("webhook_events").upsert(
              {
                provider: provider.id,
                event_id: event.eventId,
                event_type: event.eventType,
                payload: event.raw as never,
                processed_at: new Date().toISOString(),
              },
              { onConflict: "provider,event_id" },
            );
            return Response.json({ received: true, ignored: `status=${event.status}` });
          }

          const result = await processPaidPayment({
            provider: provider.id,
            providerIntentId: event.providerIntentId,
            eventId: event.eventId,
            eventType: event.eventType,
            raw: event.raw,
          });
          return Response.json({ received: true, ...result });
        } catch (e) {
          console.error("[webhook]", e);
          return new Response("invalid webhook", { status: 400 });
        }
      },
    },
  },
});