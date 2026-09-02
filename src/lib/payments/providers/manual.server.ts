// Provedor "manual" — usado como fallback quando nenhum provedor real está configurado.
// Cria intents pendentes que podem ser confirmadas manualmente via painel admin.
// Serve pra testar todo o fluxo (webhook, criação de usuário, entitlement, magic link)
// sem depender de credenciais externas.

import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentProvider,
  WebhookEvent,
} from "../types";

export const manualProvider: PaymentProvider = {
  id: "manual",
  ready: true,

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    // Gera um "QR code" fake só pra UI ter algo pra exibir em dev.
    const intentId = `manual_${input.paymentId}`;
    return {
      providerIntentId: intentId,
      status: "pending",
      method: input.method,
      amountCents: input.amountCents,
      pixQrCode: input.method === "pix" ? `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='240' height='240' fill='#111'/><text x='50%' y='50%' fill='#d4af37' font-family='monospace' font-size='11' text-anchor='middle' dominant-baseline='middle'>MODO MANUAL\n${intentId}</text></svg>`,
      )}` : undefined,
      pixCopyPaste: input.method === "pix" ? intentId : undefined,
    };
  },

  async getIntent(providerIntentId: string): Promise<PaymentIntent> {
    // Sem estado externo — status vem do nosso próprio banco no getPaymentStatus.
    return {
      providerIntentId,
      status: "pending",
      method: "manual",
      amountCents: 0,
    };
  },

  async verifyWebhook(_request: Request, rawBody: string): Promise<WebhookEvent> {
    // Webhook manual: aceita { paymentId, status } sem verificação.
    // Só é chamado internamente pelo painel admin.
    const body = JSON.parse(rawBody) as { paymentId: string; status: "paid" | "failed" };
    return {
      eventId: `manual_${body.paymentId}_${body.status}_${Date.now()}`,
      eventType: `payment.${body.status}`,
      providerIntentId: `manual_${body.paymentId}`,
      status: body.status,
      raw: body,
    };
  },
};