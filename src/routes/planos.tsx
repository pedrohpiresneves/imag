import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { track } from "@/lib/analytics";
import { PLANS_ORDERED, PRICING_COPY, PRICE_LABELS, PLAN_PRICING } from "@/lib/pricing";
import type { PlanKey } from "@/lib/pricing";
import { createInfinitepayCheckout } from "@/lib/payments/infinitepay-checkout.functions";
import { verifyMyPayment } from "@/lib/payments/reconcile.functions";

const BLUE = "#335CFF";
const BLUE_SOFT = "#335CFF";
const INK = "#0A0A0A";
const MUTED = "#6B7280";
const HAIR = "rgba(15,23,42,0.08)";

export const Route = createFileRoute("/planos")({
  ssr: false,
  component: PlanosPage,
  head: () => ({
    meta: [
      { title: "Planos · iMAG" },
      {
        name: "description",
        content:
          `Continue avançando com direção. iMAG Anual (${PRICE_LABELS.annual}/ano) ou Mensal (${PRICE_LABELS.monthly}/mês). 10 dias gratuitos.`,
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const plans = PLANS_ORDERED;

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como funcionam os 10 dias gratuitos?",
    a: "Ao criar sua conta você acessa a experiência iMAG completa por 10 dias, sem cobrança. Basta cancelar antes do fim do período para não ser cobrado.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Você cancela em Configurações → Assinatura, em um clique. Durante o teste o acesso encerra na hora; depois de pago, mantém o acesso até o fim do período.",
  },
  {
    q: "Como é a cobrança?",
    a: "A cobrança é processada com segurança pela InfinitePay, no cartão informado no checkout. A renovação é automática (mensal ou anual) e você recebe recibo por e-mail."
  },
  {
    q: "O que é o preço de fundador?",
    a: "Uma condição especial para os primeiros profissionais que fizerem parte da iMAG. O valor permanece enquanto a sua assinatura estiver ativa.",
  },
  {
    q: "Posso mudar de plano depois?",
    a: "Sim. Você pode alternar entre mensal e anual a qualquer momento através do portal de assinatura em Configurações.",
  },
];

function PlanosPage() {
  const [, setAuthed] = useState<boolean | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstChargeDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    track("page_view", { page: "planos" });
  }, []);

  async function choose(plan: PlanKey) {
    if (loadingPlan) return; // impede cliques repetidos
    setError(null);
    setLoadingPlan(plan);
    try {
      track("checkout_start", { plan });
      const { data } = await supabase.auth.getSession();
      const isAuthed = !!data.session;
      setAuthed(isAuthed);
      if (!isAuthed) {
        window.location.assign(`/auth?next=${encodeURIComponent(`/planos?plan=${plan}`)}`);
        return;
      }
      // Já tem acesso? Não abre novo checkout nem gera segunda cobrança.
      const verification = await verifyMyPayment({ data: undefined as never });
      if (verification.hasAccess) {
        window.location.assign("/atividade");
        return;
      }
      // O link é criado no servidor com referência interna (order_nsu) e
      // webhook — é isso que permite liberar o acesso automaticamente.
      const result = await createInfinitepayCheckout({ data: { plan } });
      if (!result.ok) {
        setError(result.error);
        setLoadingPlan(null);
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError("Não foi possível abrir o checkout. Tente novamente em alguns instantes.");
      setLoadingPlan(null);
    }
  }


  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-14 sm:px-8">
        <header className="max-w-[620px]">
          <h1 className="text-[34px] font-semibold tracking-[-0.03em] sm:text-[44px]" style={{ color: INK }}>
            Escolha seu plano
          </h1>
          <p className="mt-3 text-[17px] font-medium tracking-[-0.02em]" style={{ color: BLUE }}>
            {PRICING_COPY.title}
          </p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: MUTED }}>
            {PRICING_COPY.body}
          </p>
        </header>

        {/* Cards de plano — anual primeiro no mobile e no desktop */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
          {plans.map((p) => (
            <article
              key={p.priceId}
              className="relative flex flex-col rounded-3xl p-6 sm:p-7"
              style={{
                border: p.featured ? `1px solid ${BLUE}` : `1px solid ${HAIR}`,
                background: p.featured ? "#F5F8FF" : "#fff",
              }}
            >
              {p.badge && (
                <span
                  className="mb-4 inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white"
                  style={{ background: BLUE }}
                >
                  {p.badge}
                </span>
              )}
              <h2 className="text-[15px] font-medium" style={{ color: p.featured ? BLUE : INK }}>
                {p.name}
              </h2>
              <div className="mt-3 flex items-end gap-1.5">
                <div className="text-[42px] font-semibold leading-none tracking-[-0.025em]" style={{ color: INK }}>
                  {p.price}
                </div>
                <div className="pb-1.5 text-[13px]" style={{ color: MUTED }}>
                  {p.cadence}
                </div>
              </div>
              {(p.note || p.savingsBadge) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.note && (
                    <span className="text-[13.5px]" style={{ color: MUTED }}>
                      {p.note}
                    </span>
                  )}
                  {p.savingsBadge && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                      style={{ background: "#E4ECFF", color: BLUE }}
                    >
                      {p.savingsBadge}
                    </span>
                  )}
                </div>
              )}
              <ul className="mt-5 flex-1 space-y-2.5 text-[13.5px]">
                {p.benefits.map((h) => (
                  <li key={h} className="flex items-start gap-2.5" style={{ color: "#111827" }}>
                    <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: BLUE }} strokeWidth={2.4} />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setConfirming(p.key)}
                disabled={loadingPlan !== null}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-medium transition disabled:opacity-60"
                style={
                  p.featured
                    ? {
                        color: "#fff",
                        background: BLUE_SOFT,
                      }
                    : {
                        color: BLUE,
                        background: "#fff",
                        border: `1px solid ${BLUE}`,
                      }
                }
              >
                {loadingPlan === p.key
                  ? "Abrindo checkout…"
                  : p.cta}
                {loadingPlan !== p.key && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </article>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-[13.5px]" role="alert" style={{ color: "#B42318" }}>
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-[12.5px]" style={{ color: MUTED }}>
          Renovação automática. Cancele quando quiser.
        </p>


        {/* FAQ */}
        <section className="mt-20">
          <h2 className="text-center text-[24px] font-semibold tracking-[-0.02em] sm:text-[30px]" style={{ color: INK }}>
            Perguntas frequentes
          </h2>
          <div className="mx-auto mt-8 max-w-[720px] divide-y" style={{ borderColor: HAIR }}>
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium" style={{ color: INK }}>
                  {item.q}
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] transition group-open:rotate-45"
                    style={{ border: `1px solid ${HAIR}`, color: MUTED }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed" style={{ color: MUTED }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-16 text-center text-[12px]" style={{ color: MUTED }}>
          <Link to="/" className="underline underline-offset-2">Voltar ao início</Link>
        </p>
      </main>

      {confirming && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
          style={{ background: "rgba(10,10,10,0.35)" }}
          onClick={() => loadingPlan === null && setConfirming(null)}
        >
          <div
            className="w-full max-w-[460px] rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const p = PLAN_PRICING[confirming];
              return (
                <>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>
                    Confirmar plano {p.name.toLowerCase()}
                  </h3>
                  <dl className="mt-4 space-y-2.5 text-[13.5px]">
                    <div className="flex justify-between gap-4">
                      <dt style={{ color: MUTED }}>Valor cobrado</dt>
                      <dd className="font-medium" style={{ color: INK }}>{p.price}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt style={{ color: MUTED }}>Periodicidade</dt>
                      <dd className="font-medium" style={{ color: INK }}>
                        {p.key === "annual" ? "Anual" : "Mensal"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt style={{ color: MUTED }}>Primeira cobrança</dt>
                      <dd className="font-medium" style={{ color: INK }}>Hoje, {firstChargeDate}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt style={{ color: MUTED }}>Renovação</dt>
                      <dd className="font-medium text-right" style={{ color: INK }}>{p.renewalLabel}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
                    Cancele quando quiser em Configurações → Assinatura. O valor de fundador
                    permanece enquanto a assinatura estiver ativa.
                  </p>
                  <button
                    type="button"
                    onClick={() => choose(p.key)}
                    disabled={loadingPlan !== null}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full py-3.5 text-[14px] font-medium text-white transition disabled:opacity-60"
                    style={{ background: BLUE }}
                  >
                    {loadingPlan ? "Abrindo checkout…" : `Confirmar e pagar ${p.price}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    disabled={loadingPlan !== null}
                    className="mt-2 w-full py-2 text-[13px]"
                    style={{ color: MUTED }}
                  >
                    Voltar
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}