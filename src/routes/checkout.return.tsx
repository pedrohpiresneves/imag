import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStripeEnvironment } from "@/lib/stripe";
import { getStripeSubscriptionStatus } from "@/lib/stripe/checkout.functions";
import { SUBSCRIPTION_QUERY_KEY } from "@/lib/subscription-state";
import { AppHeader } from "@/components/AppHeader";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/checkout/return")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Assinatura confirmada · iMAG" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "ok"; trial: boolean }
    | { kind: "waiting" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const poll = async () => {
      tries += 1;
      try {
        const r = await getStripeSubscriptionStatus({
          data: { environment: getStripeEnvironment() },
        });
        if (cancelled) return;
        if ("hasAccess" in r && r.hasAccess) {
          void qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
          track("subscription_activated", {
            status: "status" in r ? r.status : "",
          });
          track("access_granted");
          const trial = "status" in r && r.status === "trialing";
          if (trial) track("trial_started");
          setStatus({ kind: "ok", trial });
          return;
        }
        if (tries >= 8) {
          setStatus({ kind: "waiting" });
          return;
        }
        setTimeout(poll, 1500);
      } catch (e) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Falha ao confirmar.",
        });
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="mx-auto max-w-lg px-6 pt-28 pb-16 text-center">
        {status.kind === "loading" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Confirmando…</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Estamos liberando seu acesso.
            </p>
          </>
        )}
        {status.kind === "ok" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              {status.trial ? "Seu teste começou 🎉" : "Assinatura ativa 🎉"}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              {status.trial
                ? "Você tem 10 dias completos com a iMAG."
                : "Bem-vindo à iMAG."}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/app" })}
              className="mt-8 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Entrar na iMAG
            </button>
          </>
        )}
        {status.kind === "waiting" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Quase lá…</h1>
            <p className="mt-2 text-sm text-neutral-600">
              O Stripe está confirmando o pagamento. Assim que o webhook chegar seu
              acesso será liberado — normalmente em segundos. Recarregue esta página
              em instantes ou volte pelo menu.
            </p>
            <Link
              to="/app"
              className="mt-6 inline-block text-sm text-blue-800 underline underline-offset-2"
            >
              Ir para a iMAG
            </Link>
          </>
        )}
        {status.kind === "error" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Não conseguimos confirmar</h1>
            <p className="mt-2 text-sm text-red-700">{status.message}</p>
            <Link
              to="/planos"
              className="mt-6 inline-block text-sm text-blue-800 underline underline-offset-2"
            >
              Voltar aos planos
            </Link>
          </>
        )}
      </main>
    </div>
  );
}