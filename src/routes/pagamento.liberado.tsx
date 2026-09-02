import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPaidEmail } from "@/lib/payments/checkout.functions";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/pagamento/liberado")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search.p === "string" ? search.p : "",
  }),
  head: () => ({
    meta: [
      { title: "Acesso liberado · iMAG" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessGrantedPage,
});

function AccessGrantedPage() {
  const { p: paymentId } = useSearch({ from: "/pagamento/liberado" });
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMsg, setResendMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    track("access_granted", { paymentId: paymentId || undefined });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const isIn = !!data.session;
      setSignedIn(isIn);
      if (paymentId) {
        try {
          const res = await getPaidEmail({ data: { paymentId } });
          if (!cancelled && res.email) setEmail(res.email);
        } catch (e) {
          console.warn("[pagamento/liberado] getPaidEmail", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  async function handleResend() {
    if (!email) return;
    setResendState("sending");
    setResendMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      setResendState("error");
      setResendMsg("Não foi possível reenviar agora. Tente novamente em instantes.");
    } else {
      setResendState("sent");
      setResendMsg("Novo link enviado. Confira sua caixa de entrada.");
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      <main className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full blur-2xl" style={{ background: "rgba(199,167,108,0.22)" }} />
          <div className="grid h-20 w-20 place-items-center rounded-full" style={{ border: "1px solid rgba(199,167,108,0.45)", background: "rgba(199,167,108,0.08)" }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
          </div>
        </div>

        <span className="mt-10 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em]" style={{ color: "var(--gold)" }}>
          <Sparkles className="h-3 w-3" /> Acesso ativado
        </span>
        <h1 className="mt-6 font-medium leading-[1.02] text-[10vw] sm:text-5xl" style={{ letterSpacing: "-0.04em" }}>
          Seu acesso foi liberado!
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-white/55 font-light">
          Seu pagamento foi confirmado com sucesso. Seu acesso à iMAG já está disponível.
        </p>

        {email && (
          <div className="mt-10 flex w-full max-w-[480px] items-center gap-3 rounded-2xl px-5 py-4 text-left" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            <Mail className="h-5 w-5 shrink-0" style={{ color: "var(--gold)" }} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">
                Enviamos um link seguro para
              </p>
              <p className="mt-1 truncate text-[15px] font-medium text-white">{email}</p>
            </div>
          </div>
        )}

        {signedIn === false && email && (
          <p className="mt-3 max-w-[48ch] text-[13px] leading-relaxed text-white/50">
            Esse link permite entrar na plataforma instantaneamente.
          </p>
        )}

        <div className="mt-8 flex w-full max-w-[420px] flex-col items-center gap-3">
          {signedIn !== false ? (
            <Link
              to="/app"
              search={{ welcome: 1 }}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-8 py-3 text-sm font-medium transition hover:opacity-95"
              style={{ background: "linear-gradient(135deg,#E6D7BB,#C6A15B 55%,#A77D36)", color: "#050505" }}
            >
              Entrar na plataforma
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={email ? { email } : undefined}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-8 py-3 text-sm font-medium transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg,#E6D7BB,#C6A15B 55%,#A77D36)", color: "#050505" }}
              >
                Acessar minha conta
              </Link>
              <p className="mt-2 text-[13px] text-white/50">
                Caso não tenha recebido, clique abaixo.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={!email || resendState === "sending" || resendState === "sent"}
                className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full px-6 py-3 text-[12px] text-white/70 transition hover:text-white disabled:opacity-60"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {resendState === "sending"
                  ? "Enviando..."
                  : resendState === "sent"
                    ? "✓ Link reenviado"
                    : "Reenviar link"}
              </button>
              {resendMsg && (
                <p
                  className={`text-sm ${resendState === "error" ? "text-red-400" : "text-white/55"}`}
                >
                  {resendMsg}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}