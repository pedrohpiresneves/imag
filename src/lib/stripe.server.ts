import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace(
        "https://api.stripe.com",
        GATEWAY_STRIPE_BASE,
      );
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const se = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };
    const message = se.raw?.message ?? se.message;
    if (message) {
      const details = [
        se.raw?.type ?? se.type,
        se.raw?.code ?? se.code,
        se.raw?.decline_code ?? se.decline_code,
        se.raw?.param ?? se.param,
        se.raw?.requestId ?? se.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }
  return "Stripe request failed";
}

/**
 * Verifica assinatura HMAC-SHA256 do webhook Stripe sem depender do SDK.
 * Retorna o evento parseado. Lança se assinatura for inválida ou muito antiga.
 */
export async function verifyStripeWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ id: string; type: string; data: { object: unknown }; livemode: boolean }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("missing_signature_or_body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) {
    throw new Error("invalid_signature_format");
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("timestamp_too_old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");

  if (!v1Signatures.includes(expected)) throw new Error("invalid_signature");

  const parsed = JSON.parse(body) as {
    id: string;
    type: string;
    data: { object: unknown };
    livemode: boolean;
  };
  return parsed;
}

/**
 * Human-readable id conforme knowledge (lookup_key -> metadata fallback -> raw id).
 */
export function priceLookupFromStripe(price: unknown): string | null {
  const p = price as {
    lookup_key?: string;
    metadata?: Record<string, string>;
    id?: string;
  } | null;
  return p?.lookup_key ?? p?.metadata?.lovable_external_id ?? p?.id ?? null;
}

export const IMAG_PRICE_MENSAL = "imag_mensal_recorrente";
export const IMAG_PRICE_ANUAL = "imag_anual_recorrente";
// Novos preços (novembro/2026) — assinantes antigos permanecem nos preços legados.
export const IMAG_PRICE_MENSAL_V2 = "imag_mensal_v2";
export const IMAG_PRICE_ANUAL_V2 = "imag_anual_v2";
export const IMAG_PRICE_FUNDADOR_ANUAL = "imag_fundador_anual";
export const IMAG_PRICE_MENSAL_FUNDADOR = "imag_mensal_fundador";
export const IMAG_FUNDADOR_LIMIT = 100;
export const IMAG_TRIAL_DAYS = 10;

/** Comissão fixa por primeira compra do Círculo iMAG. */
export const IMAG_STRIPE_COMMISSION_CENTS: Record<string, number> = {
  [IMAG_PRICE_MENSAL]: 440, // R$ 4,40
  [IMAG_PRICE_ANUAL]: 3940, // R$ 39,40
  [IMAG_PRICE_MENSAL_V2]: 998, // R$ 9,98 (20% de R$ 49,90)
  [IMAG_PRICE_ANUAL_V2]: 7980, // R$ 79,80 (20% de R$ 399,00)
  [IMAG_PRICE_FUNDADOR_ANUAL]: 3940, // R$ 39,40 (20% de R$ 197,00)
  [IMAG_PRICE_MENSAL_FUNDADOR]: 498, // R$ 4,98 (20% de R$ 24,90)
};