import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { claimMagnetRewards } from "@/lib/rewards.functions";
import { emitMagnetoReward } from "@/components/MagnetoReward";

/** Evento local que pede uma verificação imediata de recompensas pendentes. */
export const CHECK_REWARDS_EVENT = "imag:check-rewards";

export function requestRewardCheck() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHECK_REWARDS_EVENT));
}

/**
 * Verifica e credita as recompensas de Magnetos pendentes (tarefas do dia,
 * onboarding, retomada e círculos). Marcos por dias com direção permanecem
 * no sistema já existente e não são duplicados aqui.
 */
export function MagnetRewards({ localDate }: { localDate?: string }) {
  const claim = useServerFn(claimMagnetRewards);
  const qc = useQueryClient();
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const res = await claim({ data: localDate ? { localDate } : {} });
      if (res.ok && res.awards.length > 0) {
        const points = res.awards.reduce((acc, a) => acc + a.amount, 0);
        const target =
          document.querySelector('[data-tour="nav-progresso"] svg') ??
          document.querySelector("main");
        const rect = target?.getBoundingClientRect();
        if (rect) emitMagnetoReward(rect, points);
        qc.invalidateQueries({ queryKey: ["antenna-state"] });
      }
    } catch {
      /* silencioso: recompensa nunca bloqueia a tela */
    } finally {
      running.current = false;
    }
  }, [claim, localDate, qc]);

  useEffect(() => {
    void run();
    const onCheck = () => void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener(CHECK_REWARDS_EVENT, onCheck);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(CHECK_REWARDS_EVENT, onCheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run]);

  return null;
}
