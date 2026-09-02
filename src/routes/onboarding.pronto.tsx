import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Info, Loader2 } from "lucide-react";
import { MagFull } from "@/components/mag/MagMascot";
import { useQueryClient } from "@tanstack/react-query";
import { useAccess } from "@/lib/use-access";
import { activateTrial } from "@/lib/trial.functions";
import { getTodayMeta } from "@/lib/plans.functions";
import { track } from "@/lib/analytics";
import { forceCompleteOnboarding } from "@/lib/magnetic-profile.functions";
import {
  getSubscriptionState,
} from "@/lib/subscription-state.functions";
import { subscriptionQueryKey } from "@/lib/subscription-state";

const BLUE = "#335CFF";

export const Route = createFileRoute("/onboarding/pronto")({

  ssr: false,
  head: () => ({
    meta: [
      { title: "Perfil pronto · iMAG" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OnboardingReady,
});

function OnboardingReady() {
  const navigate = useNavigate();
  const { userId, isLoggedIn, isLoading } = useAccess();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"generating" | "ready" | "failed">(
    "generating",
  );
  const attemptRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate({ to: "/auth" });
  }, [isLoading, isLoggedIn, navigate]);

  // Ativa o trial (idempotente) e gera a primeira MAG Meta.
  // O CTA só libera quando a meta está confirmada no banco.
  const generate = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus("generating");
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    try {
      await activateTrial({ data: undefined as never }).catch(() => null);
    } catch {
      /* trial ativação não bloqueia geração */
    }
    // Garante persistência da conclusão do onboarding antes de liberar /app.
    await forceCompleteOnboarding({ data: undefined as never }).catch(() => null);
    // Até 3 tentativas para gerar/confirmar a meta.
    let plan: Awaited<ReturnType<typeof getTodayMeta>> | null = null;
    for (let i = 0; i < 3; i++) {
      attemptRef.current = i + 1;
      try {
        plan = await getTodayMeta({ data: { local_date: localDate } });
        if (plan && (plan.first_action || plan.priority_title)) break;
      } catch (err) {
        console.error("[onboarding.pronto] geração falhou", err);
      }
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
    runningRef.current = false;
    if (plan && (plan.first_action || plan.priority_title)) {
      // Prime o cache do React Query para que /app renderize a meta
      // imediatamente após o redirect, sem novo round-trip.
      queryClient.setQueryData(["today-meta", localDate], plan);
      // Invalida caches de perfil/onboarding/acesso para refletir conclusão.
      await queryClient.invalidateQueries().catch(() => null);
      if (!userId) throw new Error("Sessão ainda não disponível");
      const access = await queryClient.fetchQuery({
        queryKey: subscriptionQueryKey(userId),
        queryFn: () => getSubscriptionState({ data: undefined as never }),
        staleTime: 0,
      });
      if (!access.hasAccess) throw new Error("Acesso gratuito ainda não confirmado");
      setStatus("ready");
      track("onboarding_ready_shown");
    } else {
      setStatus("failed");
    }
  }, [queryClient, userId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void generate();
  }, [isLoggedIn, generate]);

  // Redireciona automaticamente para /app assim que a direção estiver pronta.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (status !== "ready" || redirectedRef.current) return;
    redirectedRef.current = true;
    track("onboarding_first_meta_cta");
    const t = setTimeout(() => {
      navigate({ to: "/app", search: { welcome: 1 }, replace: true });
    }, 800);
    return () => clearTimeout(t);
  }, [status, navigate]);

  // Watchdog global: nunca deixar o usuário preso nesta tela.
  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setTimeout(() => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      console.error("[onboarding.pronto] watchdog: seguindo para /app sem meta confirmada");
      void (async () => {
        await forceCompleteOnboarding({ data: undefined as never }).catch(() => null);
        if (!userId) return;
        const access = await queryClient.fetchQuery({
          queryKey: subscriptionQueryKey(userId),
          queryFn: () => getSubscriptionState({ data: undefined as never }),
          staleTime: 0,
        }).catch(() => null);
        if (access?.hasAccess) {
          navigate({ to: "/app", search: { welcome: 1 }, replace: true });
        } else {
          redirectedRef.current = false;
          setStatus("failed");
        }
      })();
    }, 12000);
    return () => clearTimeout(t);
  }, [isLoggedIn, navigate, queryClient, userId]);

  const isFailed = status === "failed";
  const isReady = status === "ready";


  // Etapas visuais de processamento (avançam sozinhas; concluem quando pronto)
  const [phase, setPhase] = useState(1);
  useEffect(() => {
    if (isFailed) return;
    const t1 = setTimeout(() => setPhase((p) => Math.max(p, 2)), 2200);
    const t2 = setTimeout(() => setPhase((p) => Math.max(p, 3)), 5200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFailed]);
  useEffect(() => {
    if (isReady) setPhase(4);
  }, [isReady]);

  const steps = [
    "Analisando sua rotina",
    "Definindo suas prioridades",
    "Preparando sua primeira direção",
  ];
  const progress = Math.min(phase / 3, 1);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-10"
      style={{ background: "#FCFBF8", color: "#0A0A0A", fontFamily: "var(--font-sans)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[460px] text-center"
      >
        <div className="flex flex-col items-center" aria-hidden>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <MagFull
              state={isFailed ? "attention" : isReady ? "success" : "organizing"}
              size={140}
            />
          </motion.div>
          <motion.div
            animate={{ opacity: [0.45, 0.85, 0.45], scaleX: [0.9, 1, 0.9] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="h-[24px] w-[136px] rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(51,92,255,0.28), rgba(51,92,255,0) 72%)",
              filter: "blur(6px)",
            }}
          />
        </div>

        <h1
          className="mt-5 text-[27px] leading-[1.15] font-medium tracking-[-0.02em] sm:text-[30px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isFailed ? (
            "Não conseguimos concluir agora."
          ) : (
            <>
              Entendi seu <span style={{ color: BLUE }}>momento.</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-[34ch] text-[14.5px] leading-[1.6] font-light text-[#4B5563]">
          {isFailed
            ? "Aguarde um instante e tente novamente."
            : "Agora estou organizando sua direção com base nas suas respostas."}
        </p>

        {!isFailed && (
          <div
            className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px]"
            style={{ background: "#F1F4FF", color: "#5A6480" }}
          >
            <Info className="h-3.5 w-3.5" style={{ color: BLUE }} />
            Esta página atualiza sozinha em alguns segundos.
          </div>
        )}

        {!isFailed && (
          <div
            className="mt-7 rounded-[22px] bg-white p-5 text-left"
            style={{
              border: "1px solid #ECEBE5",
              boxShadow: "0 20px 60px -40px rgba(0,0,0,0.22)",
            }}
          >
            <ul className="flex flex-col gap-3.5">
              {steps.map((label, i) => {
                const done = phase > i + 1;
                const active = phase === i + 1;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors"
                      style={{
                        background: done ? BLUE : active ? "#E7EDFF" : "#F3F3F0",
                        color: done ? "#FFFFFF" : BLUE,
                      }}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "#C9C9C4" }}
                        />
                      )}
                    </span>
                    <span
                      className="text-[14px] transition-colors"
                      style={{
                        color: done || active ? "#111318" : "#A3A3A0",
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div
              className="mt-5 h-[5px] w-full overflow-hidden rounded-full"
              style={{ background: "#EDECE6" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: BLUE }}
                animate={{ width: `${Math.max(progress, 0.12) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 24 }}
              />
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.5] text-[#8A8A90]">
              Você será direcionado automaticamente assim que sua direção
              estiver pronta.
            </p>
          </div>
        )}

        {isFailed && (
          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              onClick={() => void generate()}
              className="inline-flex h-12 w-full max-w-[320px] items-center justify-center rounded-full px-6 text-[14.5px] font-medium text-white transition"
              style={{
                background: BLUE,
                boxShadow: "0 14px 32px -16px rgba(51,92,255,0.65)",
              }}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                redirectedRef.current = true;
                navigate({ to: "/app", search: { welcome: 1 }, replace: true });
              }}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full px-6 text-[14px] font-medium"
              style={{ color: BLUE }}
            >
              Entrar mesmo assim
            </button>
          </div>
        )}

        <p className="mt-5 text-[11.5px] text-[#8A8A90]">
          10 dias grátis liberados · sem cartão de crédito
        </p>
      </motion.div>
    </div>
  );
}
