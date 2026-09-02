import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useSubscriptionState } from "@/lib/subscription-state";
import { useWeeklyRecap, WeeklyRecapStories } from "@/components/WeeklyRecap";

const BLUE_DARK = "#335CFF";
const BORDER = "#E4E7EC";
const INK = "#111318";

function trialMessage(data: ReturnType<typeof useSubscriptionState>["data"]): string | null {
  if (!data) return null;
  if (data.state === "trialing" && data.daysRemaining != null) {
    const d = data.daysRemaining;
    if (d === 3) return "Você ainda tem 3 dias para experimentar a iMAG.";
    if (d === 2) return "Seu período gratuito termina amanhã.";
    if (d <= 1) return "Seu último dia de acesso gratuito.";
    return null;
  }
  if (data.state === "past_due") return "Não conseguimos confirmar seu pagamento. Atualize sua assinatura.";
  if (!data.hasAccess && data.state === "expired")
    return "Seu período gratuito terminou. Escolha um plano para continuar.";
  return null;
}

/**
 * Faixa única de avisos da Home.
 * Alterna suavemente entre o aviso do plano e o resumo semanal,
 * sem aumentar a altura. O resumo some 24h após a conclusão.
 */
export function HomeNoticeBar() {
  const { data: sub } = useSubscriptionState();
  const day = new Date().getDay();
  const { data: recap } = useWeeklyRecap(day === 0 || day === 1);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const plan = trialMessage(sub);

  let recapAvailable = false;
  if (recap) {
    if (!recap.completed) recapAvailable = day === 0;
    else if (recap.completedAt) {
      recapAvailable = Date.now() - new Date(recap.completedAt).getTime() < 24 * 60 * 60 * 1000;
    }
  }

  const items: ("plan" | "recap")[] = [];
  if (plan) items.push("plan");
  if (recapAvailable) items.push("recap");

  useEffect(() => {
    if (items.length < 2) {
      setIndex(0);
      return;
    }
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)]!;

  const shell =
    "flex h-[46px] items-center justify-between gap-3 rounded-2xl border px-4 text-[13px] transition hover:border-[#335CFF]/40";

  return (
    <div className="mx-auto mt-4 max-w-3xl px-6 sm:px-10">
      <div className="relative h-[46px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {current === "plan" ? (
              <Link
                to="/planos"
                className={shell}
                style={{ borderColor: BORDER, background: "#FFFFFF", color: INK }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: BLUE_DARK }}
                  />
                  <span className="truncate">{plan}</span>
                </span>
                <span className="whitespace-nowrap text-[12px] font-medium" style={{ color: BLUE_DARK }}>
                  Ver planos
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={`${shell} w-full text-left`}
                style={{ borderColor: BORDER, background: "#FFFFFF", color: INK }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: BLUE_DARK }}
                  />
                  <span className="truncate">
                    {recap?.completed
                      ? "Seu resumo semanal está disponível"
                      : "Seu resumo semanal está pronto"}
                  </span>
                </span>
                <span className="whitespace-nowrap text-[12px] font-medium" style={{ color: BLUE_DARK }}>
                  Ver resumo →
                </span>
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {open && recap && <WeeklyRecapStories recap={recap} onClose={() => setOpen(false)} />}
    </div>
  );
}
