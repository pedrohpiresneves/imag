import { AnimatePresence, motion } from "framer-motion";

/**
 * Balão de fala do MAG — curto, branco, sombra mínima e efêmero.
 * Nunca ocupa espaço permanente na interface.
 */
export function MAGSpeechBubble({
  message,
  className = "",
  align = "left",
}: {
  message: string | null;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.span
          key={message}
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className={`inline-block max-w-[240px] rounded-[14px] bg-white px-3 py-1.5 text-[12px] font-medium leading-[1.35] ${className}`}
          style={{
            color: "#111111",
            border: "1px solid #ECEFF5",
            boxShadow: "0 8px 22px -14px rgba(15,23,42,0.30)",
            textAlign: align,
            letterSpacing: "-0.01em",
          }}
        >
          {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
