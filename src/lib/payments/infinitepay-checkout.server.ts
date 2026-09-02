/**
 * Checkout Integrado InfinitePay — camada server-only.
 *
 * Documentação oficial: https://www.infinitepay.io/checkout-documentacao
 *   POST https://api.checkout.infinitepay.io/links
 *   Autenticação: NÃO existe API key para este endpoint. A conta é
 *   identificada pelo campo `handle` (InfiniteTag, sem o "$").
 *   Valores SEMPRE em centavos (R$ 24,90 => 2490).
 *   Resposta: { "url": "https://checkout.infinitepay.com.br/..." }
 *
 * Nada aqui confia no navegador: preço, plano e usuário são resolvidos no
 * servidor. O acesso NUNCA é liberado por esta etapa — apenas pelo webhook.
 */

import { PRICE_CENTS } from "@/lib/pricing";

export type CheckoutPlan = "monthly" | "annual";

/** Catálogo fechado. Preço definido exclusivamente no servidor, em centavos. */
export const CHECKOUT_PLANS: Record<
  CheckoutPlan,
  { price: number; description: string }
> = {
  monthly: { price: PRICE_CENTS.monthly, description: "iMAG Mensal" },
  annual: { price: PRICE_CENTS.annual, description: "iMAG Anual" },
};

const LINKS_ENDPOINT = "https://api.checkout.infinitepay.io/links";

export function infinitepayHandle(): string {
  const raw = (process.env["INFINITEPAY_HANDLE"] ?? process.env["INFINITEPAY_TAG"] ?? "").trim();
  return raw.replace(/^[$@]+/, "");
}

export function siteUrl(): string {
  return (process.env["SITE_URL"] ?? process.env["PUBLIC_APP_URL"] ?? "https://imag.net.br").replace(
    /\/$/,
    "",
  );
}

export type CreateLinkInput = {
  plan: CheckoutPlan;
  orderNsu: string;
  userId: string;
  email?: string | null;
  name?: string | null;
};

/** Cria o link oficial de checkout e devolve a URL segura. */
export async function createInfinitepayLink(input: CreateLinkInput): Promise<string> {
  const handle = infinitepayHandle();
  if (!handle) throw new Error("INFINITEPAY_HANDLE não configurado");

  const plan = CHECKOUT_PLANS[input.plan];
  const origin = siteUrl();

  const payload: Record<string, unknown> = {
    handle,
    order_nsu: input.orderNsu,
    redirect_url: `${origin}/pagamento/sucesso`,
    webhook_url: `${origin}/api/public/payments/infinitepay-webhook`,
    items: [{ quantity: 1, price: plan.price, description: plan.description }],
  };

  if (input.email || input.name) {
    payload.customer = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.email ? { email: input.email } : {}),
    };
  }

  const res = await fetch(LINKS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[infinitepay] /links falhou", res.status, text.slice(0, 500));
    throw new Error(`InfinitePay respondeu ${res.status}`);
  }

  let parsed: { url?: string } = {};
  try {
    parsed = JSON.parse(text) as { url?: string };
  } catch {
    console.error("[infinitepay] resposta não-JSON", text.slice(0, 500));
    throw new Error("Resposta inválida da InfinitePay");
  }

  const url = parsed.url;
  if (!url || !url.startsWith("https://")) {
    console.error("[infinitepay] resposta sem url válida", text.slice(0, 500));
    throw new Error("InfinitePay não retornou a URL do checkout");
  }
  return url;
}
