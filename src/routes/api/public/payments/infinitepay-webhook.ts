import { createFileRoute } from "@tanstack/react-router";

// Webhook oficial da InfinitePay Checkout.
// A InfinitePay POSTa neste endpoint quando há mudança de status de
// pagamento. Como o Checkout público não fornece assinatura HMAC,
// tratamos o webhook como *gatilho* e reconfirmamos o pagamento chamando
// o endpoint oficial payment_check (server-side, source of truth).
export const Route = createFileRoute("/api/public/payments/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const { handleInfinitepayWebhook } = await import(
            "@/lib/payments/infinitepay-webhook.server"
          );
          const outcome = await handleInfinitepayWebhook(rawBody);
          return Response.json(outcome.body, { status: outcome.httpStatus });
        } catch (e) {
          console.error("[infinitepay-webhook]", e);
          return Response.json(
            { success: false, message: "Erro ao processar notificação" },
            { status: 400 },
          );
        }
      },
      // Health check pra confirmar que a rota está publicamente acessível.
      GET: async () =>
        Response.json({
          ok: true,
          endpoint: "/api/public/payments/infinitepay-webhook",
          provider: "infinitepay",
        }),
    },
  },
});