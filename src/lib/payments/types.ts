// Contrato único de provedor de pagamento.
// Todos os adapters (InfinitePay, Stripe, Mercado Pago, manual) implementam esta interface.
// O resto da aplicação só conhece este tipo — nunca importa nada de um provedor específico.

export type PaymentMethod = "pix" | "card" | "boleto" | "manual";
export type PaymentProviderId = "infinitepay" | "stripe" | "mercadopago" | "manual";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface CreateIntentInput {
  paymentId: string;          // uuid do nosso registro em `payments`
  orderId: string;
  orderNsu: string;           // identificador único do pedido enviado ao provedor
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  email: string;
  description: string;
  metadata?: Record<string, string>;
  // Dados do cartão só chegam aqui após tokenização client-side pelo SDK do provedor.
  cardToken?: string;
  installments?: number;
}

export interface PaymentIntent {
  providerIntentId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountCents: number;
  // PIX
  pixQrCode?: string;       // imagem base64 ou URL
  pixCopyPaste?: string;    // string EMV
  pixExpiresAt?: string;    // ISO
  // Cartão / redirect (fallback)
  redirectUrl?: string;
  // Payload cru pra auditoria
  raw?: unknown;
}

export interface WebhookEvent {
  eventId: string;                 // id único do evento (idempotência)
  eventType: string;
  providerIntentId: string;
  status: PaymentStatus;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly ready: boolean;         // true se credenciais estão configuradas
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  getIntent(providerIntentId: string): Promise<PaymentIntent>;
  verifyWebhook(request: Request, rawBody: string): Promise<WebhookEvent>;
}