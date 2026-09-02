import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { verifyMyPayment } from "@/lib/payments/reconcile.functions";
import { SUBSCRIPTION_QUERY_KEY } from "@/lib/subscription-state";
import magHeadSad from "@/assets/mag-head-sad.png.asset.json";

const BLUE = "#335CFF";
const INK = "#111318";
const MUTED = "#6B7280";

type Screen = "expired" | "validating" | "released" | "not_found";

const POLL_MS = 3000;
const MAX_POLLS = 20; // ~60s

/**
 * Tela de bloqueio integral exibida quando o período gratuito termina
 * e não há assinatura ativa. Sem navegação, sem conteúdo interno.
 *
 * Se existir um pagamento em processamento, a tela valida sozinha no
 * servidor (nunca por parâmetro de URL) e libera o acesso automaticamente.
 */
export function AccessLockScreen({ initial = "B" }: { initial?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [screen, setScreen] = useState<Screen>("validating");
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  const polls = useRef(0);

  const release = useCallback(async () => {
    setScreen("released");
    await qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    await qc.invalidateQueries();
    setTimeout(() => {
      if (alive.current) navigate({ to: "/atividade", replace: true });
    }, 1200);
  }, [navigate, qc]);

  const check = useCallback(
    async (manual: boolean) => {
      if (!alive.current) return;
      setChecking(true);
      try {
        const r = await verifyMyPayment({ data: undefined as never });
        if (!alive.current) return;
        if (r.hasAccess || r.status === "active") {
          await release();
          return;
        }
        if (r.status === "processing") {
          setScreen("validating");
          if (polls.current < MAX_POLLS) {
            polls.current += 1;
            setTimeout(() => void check(false), POLL_MS);
          } else {
            setScreen("not_found");
          }
          return;
        }
        setScreen(manual ? "not_found" : "expired");
      } catch {
        if (alive.current) setScreen("expired");
      } finally {
        if (alive.current) setChecking(false);
      }
    },
    [release],
  );

  useEffect(() => {
    alive.current = true;
    void check(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  async function signOut() {
    setLeaving(true);
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    navigate({ to: "/" });
  }

  const copy: Record<Screen, { title: string; body: string }> = {
    expired: {
      title: "Seu período gratuito terminou",
      body: "Continue com a MAG para manter sua direção, organização e progresso.",
    },
    validating: {
      title: "Validando seu pagamento…",
      body: "Isso pode levar alguns instantes. Assim que for confirmado, seu acesso será liberado automaticamente.",
    },
    released: {
      title: "Pagamento confirmado!",
      body: "Seu acesso à iMAG foi liberado.",
    },
    not_found: {
      title: "Ainda não localizamos a confirmação",
      body: "Confira se o pagamento foi concluído ou solicite uma nova verificação.",
    },
  };


  return (
    <div
      className="min-h-screen"
      style={{ background: "#FFFFFF", colorScheme: "light", fontFamily: "var(--font-sans)" }}
    >
      <header
        className="flex items-center justify-end px-5"
        style={{
          background: BLUE,
          paddingTop: "calc(env(safe-area-inset-top) + 10px)",
          paddingBottom: 10,
        }}
      >
        <Link
          to="/perfil"
          aria-label="Perfil"
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-medium text-white"
          style={{ border: "1px solid rgba(255,255,255,0.55)" }}
        >
          {initial}
        </Link>
      </header>

      <main className="mx-auto flex max-w-[460px] flex-col items-center px-6 pt-16">
        <section
          className="w-full rounded-[26px] bg-white px-7 py-9 text-center"
          style={{
            border: "1px solid rgba(51,92,255,0.10)",
            boxShadow: "0 26px 60px -40px rgba(15,23,42,0.35), 0 1px 2px rgba(15,23,42,0.04)",
          }}
        >
          <div className="relative mx-auto h-[126px] w-[126px]">
            <img
              src={magHeadSad.url}
              alt="MAG"
              width={252}
              height={252}
              className="relative z-[1] h-full w-full select-none object-contain"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[2px] left-1/2 -translate-x-1/2 rounded-[50%]"
              style={{
                width: 74,
                height: 12,
                background: "rgba(15,23,42,0.16)",
                filter: "blur(7px)",
              }}
            />
          </div>

          <h1
            className="mt-5 text-[24px] font-semibold leading-[1.15]"
            style={{ color: INK, letterSpacing: "-0.02em" }}
          >
            {copy[screen].title}
          </h1>
          <p className="mx-auto mt-3 max-w-[32ch] text-[14.5px] font-light leading-[1.5]" style={{ color: MUTED }}>
            {copy[screen].body}
          </p>

          {screen === "validating" && (
            <div className="mt-6 flex justify-center">
              <span
                aria-label="Validando"
                className="h-6 w-6 animate-spin rounded-full"
                style={{ border: "2px solid #E6EAF2", borderTopColor: BLUE }}
              />
            </div>
          )}

          {screen !== "released" && screen !== "validating" && (
            <>
              <Link
                to="/planos"
                className="mt-7 inline-flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-medium text-white transition active:scale-[0.99]"
                style={{ background: BLUE, boxShadow: "0 18px 34px -22px rgba(51,92,255,0.75)" }}
              >
                {screen === "not_found" ? "Voltar aos planos" : "Ver planos"}
              </Link>

              <button
                type="button"
                onClick={() => void check(true)}
                disabled={checking}
                className="mt-3 w-full rounded-full py-3 text-[15px] font-medium disabled:opacity-60"
                style={{ border: "1px solid rgba(51,92,255,0.25)", color: BLUE }}
              >
                {checking
                  ? "Verificando pagamento…"
                  : screen === "not_found"
                    ? "Verificar novamente"
                    : "Já paguei"}
              </button>

              {screen === "not_found" && (
                <Link
                  to="/suporte"
                  className="mt-3 inline-block w-full py-2 text-[14px] font-normal"
                  style={{ color: MUTED }}
                >
                  Falar com o suporte
                </Link>
              )}
            </>
          )}

          {screen !== "released" && (
            <button
              type="button"
              onClick={signOut}
              disabled={leaving}
              className="mt-4 w-full py-2 text-[14.5px] font-normal disabled:opacity-60"
              style={{ color: MUTED }}
            >
              {leaving ? "Saindo…" : "Sair da conta"}
            </button>
          )}
        </section>

        <p className="mt-5 text-center text-[13px] font-light" style={{ color: "#9AA1AC" }}>
          Seus dados continuam salvos.
        </p>
      </main>
    </div>
  );
}
