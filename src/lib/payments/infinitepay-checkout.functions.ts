import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutPlanInput = "monthly" | "annual";

export type CreateCheckoutResult =
  | { ok: true; checkoutUrl: string; orderId: string }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "Não foi possível iniciar o pagamento. Tente novamente em alguns instantes.";

/**
 * Cria (ou reaproveita) uma tentativa de pagamento e devolve APENAS a URL
 * segura do checkout da InfinitePay. O navegador não envia valores nem plano
 * livre: só "monthly" ou "annual", validados aqui.
 */
export const createInfinitepayCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: string }): { plan: CheckoutPlanInput } => {
    const plan = input?.plan;
    if (plan !== "monthly" && plan !== "annual") throw new Error("Plano inválido");
    return { plan };
  })
  .handler(async ({ data, context }): Promise<CreateCheckoutResult> => {
    const { userId, claims } = context;
    const { CHECKOUT_PLANS, createInfinitepayLink, infinitepayHandle } = await import(
      "./infinitepay-checkout.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!infinitepayHandle()) {
      console.error("[infinitepay] INFINITEPAY_HANDLE ausente");
      return { ok: false, error: GENERIC_ERROR };
    }

    const plan = data.plan;
    const price = CHECKOUT_PLANS[plan].price;

    try {
      // Anti-duplicidade: reaproveita tentativa pendente recente (10 min).
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: reusable } = await supabaseAdmin
        .from("payment_transactions")
        .select("id, checkout_url, external_order_id")
        .eq("user_id", userId)
        .eq("plan", plan)
        .eq("status", "pending")
        .not("checkout_url", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reusable?.checkout_url) {
        return {
          ok: true,
          checkoutUrl: reusable.checkout_url,
          orderId: reusable.external_order_id,
        };
      }

      const orderNsu = `imag_${plan}_${crypto.randomUUID()}`;

      // Registra a tentativa ANTES de chamar o provedor.
      const { data: attempt, error: insertError } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          user_id: userId,
          provider: "infinitepay",
          plan,
          amount: price,
          currency: "BRL",
          status: "pending",
          external_order_id: orderNsu,
        })
        .select("id")
        .single();
      if (insertError || !attempt) throw insertError ?? new Error("insert falhou");

      const email = (claims as { email?: string } | null)?.email ?? null;

      let checkoutUrl: string;
      try {
        checkoutUrl = await createInfinitepayLink({
          plan,
          orderNsu,
          userId,
          email,
        });
      } catch (providerError) {
        console.error("[infinitepay] criação do link falhou", providerError);
        await supabaseAdmin
          .from("payment_transactions")
          .update({
            status: "failed",
            raw_provider_status: {
              error: providerError instanceof Error ? providerError.message : "unknown",
            },
          })
          .eq("id", attempt.id);
        return { ok: false, error: GENERIC_ERROR };
      }

      await supabaseAdmin
        .from("payment_transactions")
        .update({ checkout_url: checkoutUrl })
        .eq("id", attempt.id);

      return { ok: true, checkoutUrl, orderId: orderNsu };
    } catch (err) {
      console.error("[infinitepay] createInfinitepayCheckout erro", err);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
