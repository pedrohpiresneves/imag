import { AnimatePresence, motion } from "framer-motion";
import { MagHead } from "@/components/mag/MagHead";
import type { AntennaLevel } from "@/lib/antenna";

/** Celebração discreta ao desbloquear uma nova antena. */
export function AntennaUnlock({
  level,
  onClose,
}: {
  level: AntennaLevel | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {level && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] grid place-items-center px-8"
          style={{ background: "rgba(255,255,255,0.86)", backdropFilter: "blur(18px)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[320px] flex-col items-center text-center"
          >
            <span className="relative inline-block" style={{ width: 132, height: 132 }}>
              <MagHead
                size={92}
                level={level}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </span>


            <p
              className="mt-6 text-[19px] font-semibold"
              style={{ letterSpacing: "-0.03em", fontFamily: "var(--font-display)" }}
            >
              Nova frequência desbloqueada
            </p>
            <p className="mt-1.5 text-[14px] font-light" style={{ color: "#6B6B70" }}>
              Você alcançou a {level.name}.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-7 text-[14px] font-medium transition active:opacity-60"
              style={{ color: "#335CFF" }}
            >
              Continuar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
