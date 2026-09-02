import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSubscriptionState } from "@/lib/subscription-state.functions";

const INK = "#111318";
const MUTED = "#6B7280";
const BLUE = "#335CFF";
const BORDER = "#E4E7EC";

export const Route = createFileRoute("/pagamento/sucesso")({
  ssr: false,
  component: SucessoPage,
  head: () => ({
    meta: [
      { title: "Pagamento · iMAG" },
      {
        name: "description",
        content: "Confirmação da sua assinatura iMAG. O acesso é liberado automaticamente.",
      },
      { property: "og:title", content: "Pagamento · iMAG" },
      { property: "og:description", content: "Confirmação da sua assinatura iMAG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function SucessoPage() {
  // Verificação com prazo: nunca infinita.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  // A assinatura só vira "active" quando o servidor/webhook confirma o
  // pagamento. Aqui apenas consultamos o estado real, nunca liberamos acesso.
  const { data } = useQuery({
    queryKey: ["access-state", "pagamento-sucesso"],
    queryFn: () => getSubscriptionState({ data: undefined as never }),
    refetchInterval: (q) =>
      (q.state.data?.hasAccess && q.state.data?.state !== "trialing") || timedOut ? false : 4000,
    retry: false,
  });

  const confirmed = Boolean(data?.hasAccess && data.state !== "trialing");

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-6 text-center">
        {confirmed ? (
          <>
            <h1
              className="text-[26px] font-semibold leading-[1.2] sm:text-[30px]"
              style={{ color: INK, letterSpacing: "-0.025em" }}
            >
              Tudo certo. Sua iMAG continua com você.
            </h1>
            <Link
              to="/app"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full py-3.5 text-[14px] font-medium text-white"
              style={{ background: BLUE }}
            >
              Ir para minha direção de hoje
            </Link>
          </>
        ) : timedOut ? (
          <>
            <h1
              className="text-[26px] font-semibold leading-[1.2] sm:text-[30px]"
              style={{ color: INK, letterSpacing: "-0.025em" }}
            >
              Seu pagamento ainda está sendo processado.
            </h1>
            <p className="mt-4 text-[14.5px] leading-[1.55]" style={{ color: MUTED }}>
              Você pode fechar esta página e voltar mais tarde. Assim que o pagamento
              for confirmado, seu acesso é liberado automaticamente.
            </p>
            <Link
              to="/app"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full border bg-white py-3.5 text-[14px] font-medium"
              style={{ borderColor: BORDER, color: INK }}
            >
              Voltar ao app
            </Link>
          </>
        ) : (
          <>
            <h1
              className="text-[26px] font-semibold leading-[1.2] sm:text-[30px]"
              style={{ color: INK, letterSpacing: "-0.025em" }}
            >
              Sua assinatura está sendo confirmada.
            </h1>
            <p className="mt-4 text-[14.5px] leading-[1.55]" style={{ color: MUTED }}>
              Assim que o pagamento for identificado, seu acesso será liberado
              automaticamente.
            </p>
            <div
              className="mt-8 flex items-center justify-center gap-2.5 text-[13px]"
              style={{ color: MUTED }}
              aria-live="polite"
            >
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-transparent"
                style={{ borderTopColor: BLUE, borderRightColor: BLUE }}
              />
              Verificando pagamento…
            </div>
            <Link
              to="/app"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full border bg-white py-3.5 text-[14px] font-medium"
              style={{ borderColor: BORDER, color: INK }}
            >
              Voltar ao app
            </Link>
          </>
        )}
      </main>
    </div>
  );
}