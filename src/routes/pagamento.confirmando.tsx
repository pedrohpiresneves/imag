import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmInfinitepayReturn,
  getPaymentStatus,
} from "@/lib/payments/checkout.functions";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/pagamento/confirmando")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search.p === "string" ? search.p : "",
    transaction_nsu: typeof search.transaction_nsu === "string" ? search.transaction_nsu : "",
    receipt_url: typeof search.receipt_url === "string" ? search.receipt_url : "",
    slug: typeof search.slug === "string" ? search.slug : "",
    order_nsu: typeof search.order_nsu === "string" ? search.order_nsu : "",
  }),
  head: () => ({
    meta: [
      { title: "Pagamento recebido · iMAG" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentConfirmingPage,
});

function PaymentConfirmingPage() {
  const search = useSearch({ from: "/pagamento/confirmando" });
  const navigate = useNavigate();
  const paymentId = search.p;
  const [state, setState] = useState<"checking" | "pending" | "paid" | "failed">("checking");
  const [attempts, setAttempts] = useState(0);
  const cancelled = useRef(false);

  async function checkPayment() {
    if (!paymentId) {
      setState("failed");
      return;
    }
    setAttempts((value) => value + 1);
    try {
      await confirmInfinitepayReturn({
        data: {
          paymentId,
          transactionNsu: search.transaction_nsu || undefined,
          receiptUrl: search.receipt_url || undefined,
          slug: search.slug || undefined,
          orderNsu: search.order_nsu || undefined,
        },
      });
      const status = await getPaymentStatus({ data: { paymentId } });
      if (cancelled.current) return;
      if (status.status === "paid") {
        setState("paid");
        track("payment_confirmed", { paymentId });
        let signedIn = false;
        if (status.tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: status.tokenHash,
            type: "magiclink",
          });
          if (error) console.error("[pagamento/confirmando] verifyOtp", error);
          else signedIn = true;
        }
        if (!signedIn) {
          const { data: session } = await supabase.auth.getSession();
          signedIn = !!session.session;
        }
        // Se logou, vai direto pra plataforma. Se não, cai na página de
        // acesso liberado com fallback (reenviar link / acessar conta).
        window.setTimeout(() => {
          if (signedIn) navigate({ to: "/app", search: { welcome: 1 }, replace: true });
          else
            navigate({
              to: "/pagamento/liberado",
              search: { p: paymentId },
              replace: true,
            });
        }, 600);
        return;
      }
      if (status.status === "failed" || status.status === "cancelled" || status.status === "refunded") {
        setState("failed");
        return;
      }
      setState("pending");
    } catch (error) {
      console.warn("[pagamento/confirmando] check", error);
      if (!cancelled.current) setState("pending");
    }
  }

  useEffect(() => {
    cancelled.current = false;
    checkPayment();
    const timer = window.setInterval(checkPayment, 3000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 45000);
    return () => {
      cancelled.current = true;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      <main className="mx-auto flex min-h-screen max-w-[620px] flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <span className="text-[10px] uppercase tracking-[0.4em] text-white/40 inline-flex items-center gap-2">
          <span className="h-1 w-1 rounded-full" style={{ background: "var(--gold)" }} /> iMAG
        </span>
        <div className="mt-10 grid h-14 w-14 place-items-center rounded-full" style={{ border: "1px solid rgba(199,167,108,0.35)", background: "rgba(199,167,108,0.08)" }}>
          <span className="h-3 w-3 animate-pulse rounded-full" style={{ background: "var(--gold)" }} />
        </div>
        <h1 className="mt-10 font-medium leading-[1.02] text-[10vw] sm:text-5xl" style={{ letterSpacing: "-0.04em" }}>
          Pagamento recebido
        </h1>
        <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-white/55 font-light">
          Estamos confirmando sua compra e liberando seu acesso. Isso pode levar alguns segundos.
        </p>

        {state === "pending" && attempts > 5 && (
          <p className="mt-5 max-w-[48ch] text-sm leading-relaxed text-white/50">
            O pagamento já pode estar aprovado e a confirmação ainda estar sendo processada. Esta página continua verificando sem voltar ao checkout.
          </p>
        )}

        {state === "failed" && (
          <p className="mt-5 rounded-2xl px-4 py-3 text-sm text-white/60" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            Ainda não encontramos uma aprovação válida para este pedido. Se o valor foi debitado, clique para verificar novamente.
          </p>
        )}

        <button
          type="button"
          onClick={checkPayment}
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[12px] text-white/70 transition hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Verificar pagamento novamente
        </button>
      </main>
    </div>
  );
}