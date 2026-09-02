import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Check, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { ImagLogo } from "@/components/ImagLogo";
import { createStripeHostedCheckoutSession } from "@/lib/stripe/checkout.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { formatBRL, monthlyEquivalent, PRICE_CENTS } from "@/lib/pricing";

type Search = { plan?: string };

export const Route = createFileRoute("/checkout/stripe")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  component: CheckoutStripePage,
  head: () => ({
    meta: [
      { title: "Checkout · iMAG" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type PlanInfo = {
  priceId: string;
  name: string;
  price: string;
  cadence: string;
  periodDescription: string;
  totalLabel: string;
  ctaAmount: string;
};

const PLANS: Record<string, PlanInfo> = {
  imag_fundador_anual: {
    priceId: "imag_fundador_anual",
    name: "iMAG Anual",
    price: formatBRL(PRICE_CENTS.annual),
    cadence: "por ano",
    periodDescription: `Acesso completo à plataforma durante 12 meses. Equivale a ${monthlyEquivalent(PRICE_CENTS.annual)} por mês.`,
    totalLabel: "Plano anual · preço de fundador",
    ctaAmount: formatBRL(PRICE_CENTS.annual),
  },
  imag_mensal_fundador: {
    priceId: "imag_mensal_fundador",
    name: "iMAG Mensal",
    price: formatBRL(PRICE_CENTS.monthly),
    cadence: "por mês",
    periodDescription: "Acesso completo à plataforma com renovação mensal.",
    totalLabel: "Plano mensal",
    ctaAmount: formatBRL(PRICE_CENTS.monthly),
  },
  imag_anual_v2: {
    priceId: "imag_anual_v2",
    name: "iMAG Anual",
    price: formatBRL(PRICE_CENTS.annual),
    cadence: "por ano",
    periodDescription: "Acesso completo à plataforma durante 12 meses.",
    totalLabel: "Plano anual",
    ctaAmount: formatBRL(PRICE_CENTS.annual),
  },
  imag_mensal_v2: {
    priceId: "imag_mensal_v2",
    name: "iMAG Mensal",
    price: formatBRL(PRICE_CENTS.monthly),
    cadence: "por mês",
    periodDescription: "Acesso completo à plataforma com renovação mensal.",
    totalLabel: "Plano mensal",
    ctaAmount: formatBRL(PRICE_CENTS.monthly),
  },
};

const BENEFITS = [
  "Diagnóstico estratégico personalizado",
  "Direção diária criada pela MAG",
  "Planejamento profissional contínuo",
  "Acesso às ferramentas e conteúdos iMAG",
  "Evolução acompanhada dentro da plataforma",
];

function CheckoutStripePage() {
  const navigate = useNavigate();
  const { plan } = Route.useSearch();
  const [ready, setReady] = useState<null | { priceId: string; returnUrl: string }>(null);
  const [hostedLoading, setHostedLoading] = useState(false);
  const [hostedError, setHostedError] = useState<string | null>(null);

  async function openHosted() {
    const urlPlan =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("plan") ?? undefined
        : undefined;
    const effectivePlan = plan ?? urlPlan;
    if (!effectivePlan || !PLANS[effectivePlan]) return;
    setHostedLoading(true);
    setHostedError(null);
    try {
      const origin = window.location.origin;
      const result = await createStripeHostedCheckoutSession({
        data: {
          priceId: effectivePlan,
          successUrl: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/planos`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (e) {
      console.error("[checkout] hosted fallback falhou", e);
      setHostedError("Não foi possível abrir o checkout. Tente novamente em instantes.");
      setHostedLoading(false);
    }
  }

  useEffect(() => {
    // First render may hand us `plan: undefined` before the router
    // finishes hydrating the URL search. If the URL clearly carries a
    // plan, prefer that value; only redirect once we're sure the user
    // arrived without one.
    const urlPlan =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("plan") ?? undefined
        : undefined;
    const effectivePlan = plan ?? urlPlan;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({
          to: "/auth",
          search: { next: `/checkout/stripe?plan=${effectivePlan ?? ""}` } as never,
        });
        return;
      }
      if (!effectivePlan || !PLANS[effectivePlan]) {
        navigate({ to: "/planos" });
        return;
      }
      const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
      setReady({ priceId: effectivePlan, returnUrl });
    })();
  }, [plan, navigate]);

  const urlPlanForInfo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("plan") ?? undefined
      : undefined;
  const activePlan = plan ?? urlPlanForInfo;
  const info = activePlan && PLANS[activePlan] ? PLANS[activePlan] : null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-neutral-900 font-sans">
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="iMAG" className="inline-flex items-center text-neutral-900">
            <ImagLogo size={20} color="#0A0A0A" />
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <Lock className="h-3 w-3" strokeWidth={2.25} />
            <span>Checkout seguro</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
          {/* LEFT — Resumo */}
          <section className="order-2 lg:order-1">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900 sm:text-[32px]">
              Comece sua jornada com a iMAG.
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-600">
              Inteligência estratégica para transformar conhecimento em direção,
              consistência e crescimento profissional.
            </p>

            {info && (
              <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Plano selecionado
                    </p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">{info.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tracking-tight text-neutral-900">
                      {info.price}
                    </div>
                    <div className="text-xs text-neutral-500">{info.cadence}</div>
                  </div>
                </div>
                <p className="mt-3 text-[13.5px] text-neutral-600">{info.periodDescription}</p>

                <ul className="mt-6 space-y-2.5">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14px] text-neutral-700">
                      <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-[#335CFF]/10 text-[#335CFF]">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-neutral-100 pt-4 text-[14px]">
                  <div className="flex items-center justify-between text-neutral-600">
                    <span>{info.totalLabel}</span>
                    <span className="text-neutral-900">{info.price}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between font-semibold text-neutral-900">
                    <span>Total de hoje</span>
                    <span>{info.price}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 text-[12.5px] text-neutral-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-neutral-400" />
              <p>
                Pagamento processado com segurança pela Stripe. Seus dados são protegidos e não
                ficam armazenados pela iMAG.
              </p>
            </div>
          </section>

          {/* RIGHT — Pagamento */}
          <section className="order-1 lg:order-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-neutral-900">
                  Finalize sua assinatura
                </h2>
                <span className="text-[11px] font-medium text-neutral-400">SSL · Stripe</span>
              </div>

              {ready ? (
                <div className="-mx-1">
                  <StripeEmbeddedCheckout priceId={ready.priceId} returnUrl={ready.returnUrl} />
                </div>
              ) : (
                <div className="py-20 text-center text-sm text-neutral-500">
                  Preparando checkout seguro…
                </div>
              )}

              <div className="mt-6 border-t border-neutral-100 pt-4 text-center">
                <p className="text-[12.5px] text-neutral-500">
                  Está no navegador do Instagram ou o pagamento não aparece?
                </p>
                <button
                  type="button"
                  onClick={openHosted}
                  disabled={hostedLoading || !activePlan}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {hostedLoading ? "Abrindo…" : "Abrir checkout em nova página"}
                </button>
                {hostedError && (
                  <p className="mt-2 text-[12px] text-red-600">{hostedError}</p>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-[12px] text-neutral-500">
              Ao continuar você concorda com os{" "}
              <Link to="/privacidade" className="text-neutral-700 underline underline-offset-2">
                Termos de Uso
              </Link>{" "}
              ·{" "}
              <Link to="/privacidade" className="text-neutral-700 underline underline-offset-2">
                Política de Privacidade
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}