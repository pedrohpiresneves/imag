import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/haptics";

const BLUE = "#335CFF";
/** Silhueta exata da antena original da MAG. */
const ANTENNA_MASK = "/mag-antenna-mask.png";

export type MagnetoRewardDetail = { x: number; y: number; points?: number };

/** Evento global disparado após os Magnetos serem registrados no banco. */
export const MAGNETO_EVENT = "imag:magneto-earned";

export function emitMagnetoReward(origin: DOMRect, points = 10) {
  window.dispatchEvent(
    new CustomEvent<MagnetoRewardDetail>(MAGNETO_EVENT, {
      detail: { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2, points },
    }),
  );
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Flight = {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  points: number;
  reduced: boolean;
};

/**
 * Microanimação de recompensa: uma única antena sai da direção concluída,
 * percorre uma curva sutil até a aba Progresso e desaparece.
 */
export function MagnetoReward({ onArrive }: { onArrive?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<MagnetoRewardDetail>).detail;
      if (!detail) return;
      const target = document.querySelector('[data-tour="nav-progresso"] svg');
      const rect = target?.getBoundingClientRect();
      const reduced = prefersReducedMotion();
      const to = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: detail.x, y: detail.y };
      const id = Date.now();
      setFlight({ id, from: { x: detail.x, y: detail.y }, to, points: detail.points ?? 10, reduced });
      const duration = reduced ? 700 : 1100;
      window.setTimeout(() => {
        haptic(8);
        onArrive?.();
        setFlight((f) => (f?.id === id ? null : f));
      }, duration);
    };
    window.addEventListener(MAGNETO_EVENT, handler);
    return () => window.removeEventListener(MAGNETO_EVENT, handler);
  }, [onArrive]);

  if (!mounted) return null;

  const overlay = (
    <AnimatePresence>
      {flight && (
        <div
          key={flight.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[70]"
        >
          {/* +10 Magnetos — discreto, acima do card */}
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-6, -14, -18, -24] }}
            transition={{ duration: 0.9, times: [0, 0.18, 0.6, 1], ease: "easeOut" }}
            className="absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
            style={{
              left: flight.from.x,
              top: flight.from.y,
              color: BLUE,
              background: "rgba(255,255,255,0.94)",
              boxShadow: "0 6px 18px -10px rgba(51,92,255,0.55)",
            }}
          >
            +{flight.points} Magnetos
          </motion.span>

          {!flight.reduced && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.7, 1, 0.94, 0.7],
                x: [0, (flight.to.x - flight.from.x) * 0.55, flight.to.x - flight.from.x],
                y: [
                  0,
                  (flight.to.y - flight.from.y) * 0.35 - 46,
                  flight.to.y - flight.from.y,
                ],
              }}
              transition={{ duration: 1.05, times: [0, 0.18, 0.75, 1], ease: [0.22, 1, 0.36, 1] }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: flight.from.x, top: flight.from.y, width: 34, height: 34 }}
            >
              <span
                className="block h-full w-full"
                style={{
                  background: BLUE,
                  filter: "drop-shadow(0 0 6px rgba(51,92,255,0.35))",
                  WebkitMaskImage: `url(${ANTENNA_MASK})`,
                  maskImage: `url(${ANTENNA_MASK})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                }}
              />
            </motion.span>
          )}
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
