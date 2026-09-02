import { Link } from "@tanstack/react-router";
import { ChevronRight, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useDayContext } from "@/components/home/use-day-context";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";

/** Bloco compacto de atividade do dia — leve, útil e discreto. */
export function ActivityCard({
  localDate,
  className = "",
}: {
  localDate: string;
  className?: string;
}) {
  const ctx = useDayContext(localDate);
  const total = ctx.totalCount + ctx.events.length;
  const done = ctx.doneCount;
  const running = Math.max(0, total - done);

  const summary = !ctx.loaded
    ? "Carregando seu movimento…"
    : total === 0
      ? "Veja o que está em andamento hoje"
      : [
          running > 0 ? `${running} em andamento` : null,
          done > 0 ? `${done} concluída${done > 1 ? "s" : ""}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <Link
        to="/historico"
        search={{ f: undefined }}
        className="flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 transition active:scale-[0.99]"
        style={{
          boxShadow: "0 8px 26px -18px rgba(15,23,42,0.28), 0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(51,92,255,0.08)", color: BLUE }}
        >
          <Activity className="h-[17px] w-[17px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block text-[14px] font-semibold leading-tight"
            style={{ color: INK, letterSpacing: "-0.01em" }}
          >
            Hoje
          </span>
          <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: MUTED }}>
            {summary}
          </span>
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium"
          style={{ color: BLUE }}
        >
          Ver
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </Link>
    </motion.div>
  );
}
