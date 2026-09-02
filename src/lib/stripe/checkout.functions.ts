import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
  IMAG_TRIAL_DAYS,
  IMAG_PRICE_MENSAL,
  IMAG_PRICE_ANUAL,
  IMAG_PRICE_MENSAL_V2,
  IMAG_PRICE_ANUAL_V2,
  IMAG_PRICE_FUNDADOR_ANUAL,
  IMAG_PRICE_MENSAL_FUNDADOR,
} from "@/lib/stripe.server";

// Preços aceitos em novos checkouts. Os IDs legados (V1) permanecem no
// Stripe para não impactar assinantes atuais, mas não são vendidos.
const ALLOWED_PRICES = new Set([
  // Preços de fundador (fase de lançamento).
  IMAG_PRICE_FUNDADOR_ANUAL,
  IMAG_PRICE_MENSAL_FUNDADOR,
  // Preços oficiais — usados quando a fase de fundador for encerrada.
  IMAG_PRICE_MENSAL_V2,
  IMAG_PRICE_ANUAL_V2,
  // Legado — mantidos por segurança para casos de re-tentativa manual.
  IMAG_PRICE_MENSAL,
  IMAG_PRICE_ANUAL,
]);

/**
 * O preço de fundador não tem limite de vagas: pode ser encerrado a qualquer
 * momento desativando FOUNDER_PRICING_ACTIVE em `@/lib/pricing`. Assinaturas
 * já criadas permanecem no preço contratado.
 */
async function assertFundadorAvailable(_environment: StripeEnv, _priceId: string) {
  return;
}

type CheckoutResult = { clientSecret: string } | { error: string };
type HostedCheckoutResult = { url: string } | { error: string };
type PortalResult = { url: string } | { error: string };
type CancelResult =
  | { ok: true; mode: "immediate" | "period_end"; endsAt: string | null }
  | { error: string };
type StatusResult =
  | {
      status: string;
      priceLookup: string | null;
      trialEnd: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      hasAccess: boolean;
    }
  | { status: "none"; hasAccess: false };

/**
 * Cria (ou reaproveita) o Stripe Customer com metadata.userId.
 */
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  env: StripeEnv,
  userId: string,
  email: string | null,
  savedCustomerId: string | null,
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("invalid_user_id");
  if (savedCustomerId) {
    try {
      const c = await stripe.customers.retrieve(savedCustomerId);
      if (c && !("deleted" in c && c.deleted)) return savedCustomerId;
    } catch {
      /* recria abaixo */
    }
  }
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (email) {
    const byEmail = await stripe.customers.list({ email, limit: 1 });
    if (byEmail.data.length) {
      const existing = byEmail.data[0];
      if (existing.metadata?.userId !== userId) {
        await stripe.customers.update(existing.id, {
          metadata: { ...existing.metadata, userId },
        });
      }
      return existing.id;
    }
  }
  const created = await stripe.customers.create({
    ...(email && { email }),
    metadata: { userId },
  });
  return created.id;
}

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
      if (!ALLOWED_PRICES.has(data.priceId)) throw new Error("invalid_price");
      if (!data.returnUrl.startsWith("http")) throw new Error("invalid_return_url");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { supabase, userId } = context;
      const stripe = createStripeClient(data.environment);
      await assertFundadorAvailable(data.environment, data.priceId);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "email, stripe_customer_id_sandbox, stripe_customer_id_live",
        )
        .eq("id", userId)
        .maybeSingle();

      const savedCustomerId =
        data.environment === "sandbox"
          ? profile?.stripe_customer_id_sandbox ?? null
          : profile?.stripe_customer_id_live ?? null;

      const customerId = await resolveOrCreateCustomer(
        stripe,
        data.environment,
        userId,
        (profile as { email?: string | null } | null)?.email ?? null,
        savedCustomerId,
      );

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("price_not_found");
      const stripePrice = prices.data[0];

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        subscription_data: {
          trial_period_days: IMAG_TRIAL_DAYS,
          metadata: { userId, env: data.environment },
          // Se falhar cobrança no fim do trial, cancela em vez de "incomplete"
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
        },
        payment_method_collection: "always",
        allow_promotion_codes: true,
        metadata: { userId, env: data.environment },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[stripe][checkout]", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Fallback: cria uma sessão de checkout hospedada pela Stripe (URL externa).
 * Usada quando o Embedded Checkout não é suportado — ex.: navegador in-app
 * do Instagram/Facebook, onde iframes de terceiros são bloqueados.
 */
export const createStripeHostedCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { priceId: string; successUrl: string; cancelUrl: string; environment: StripeEnv }) => {
      if (!ALLOWED_PRICES.has(data.priceId)) throw new Error("invalid_price");
      if (!data.successUrl.startsWith("http")) throw new Error("invalid_success_url");
      if (!data.cancelUrl.startsWith("http")) throw new Error("invalid_cancel_url");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<HostedCheckoutResult> => {
    try {
      const { supabase, userId } = context;
      const stripe = createStripeClient(data.environment);
      await assertFundadorAvailable(data.environment, data.priceId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, stripe_customer_id_sandbox, stripe_customer_id_live")
        .eq("id", userId)
        .maybeSingle();
      const savedCustomerId =
        data.environment === "sandbox"
          ? profile?.stripe_customer_id_sandbox ?? null
          : profile?.stripe_customer_id_live ?? null;
      const customerId = await resolveOrCreateCustomer(
        stripe,
        data.environment,
        userId,
        (profile as { email?: string | null } | null)?.email ?? null,
        savedCustomerId,
      );
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("price_not_found");
      const stripePrice = prices.data[0];
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        customer: customerId,
        subscription_data: {
          trial_period_days: IMAG_TRIAL_DAYS,
          metadata: { userId, env: data.environment },
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
        },
        payment_method_collection: "always",
        allow_promotion_codes: true,
        metadata: { userId, env: data.environment },
      });
      if (!session.url) throw new Error("missing_hosted_url");
      return { url: session.url };
    } catch (error) {
      console.error("[stripe][checkout-hosted]", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createStripePortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv }) => {
      if (!data.returnUrl.startsWith("http")) throw new Error("invalid_return_url");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<PortalResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from("stripe_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) return { error: "Nenhuma assinatura encontrada." };

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      console.error("[stripe][portal]", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Retorna o status atual da assinatura do usuário (sem consultar Stripe live).
 * Usado pela página de retorno para polling seguro.
 */
export const getStripeSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<StatusResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("stripe_subscriptions")
      .select(
        "status, price_lookup_key, trial_end, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return { status: "none", hasAccess: false };

    const { data: access } = await supabase.rpc("get_my_access_status");

    return {
      status: sub.status,
      priceLookup: sub.price_lookup_key,
      trialEnd: sub.trial_end,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      hasAccess: Boolean(access && typeof access === "object" && "has_access" in access && access.has_access === true),
    };
  });

/**
 * Cancelamento seguro pela iMAG:
 *  - Se assinatura está em `trialing` → cancela imediatamente (acesso encerra agora).
 *  - Caso contrário → agenda cancelamento para o fim do período pago
 *    (acesso mantido até `current_period_end`).
 * Reflete no banco pelo webhook `customer.subscription.updated/deleted`.
 */
export const cancelStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<CancelResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from("stripe_subscriptions")
        .select("stripe_subscription_id, status, current_period_end, trial_end")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_subscription_id) return { error: "Nenhuma assinatura encontrada." };

      const stripe = createStripeClient(data.environment);
      const isTrial = sub.status === "trialing";

      if (isTrial) {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        return { ok: true, mode: "immediate", endsAt: null };
      }

      const updated = await stripe.subscriptions.update(
        sub.stripe_subscription_id,
        { cancel_at_period_end: true },
      );
      const endsAt =
        sub.current_period_end ??
        (updated.items?.data?.[0]?.current_period_end
          ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
          : null);
      return { ok: true, mode: "period_end", endsAt };
    } catch (error) {
      console.error("[stripe][cancel]", error);
      return { error: getStripeErrorMessage(error) };
    }
  });