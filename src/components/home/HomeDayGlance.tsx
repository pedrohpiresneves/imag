import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateDayPriority } from "@/lib/day-panel.functions";
import { useDayContext, useNowMinutes, formatIn } from "@/components/home/use-day-context";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";
const HAIR = "rgba(17,17,17,0.06)";

/**
 * Visão rápida do agora na Home — próximo compromisso + checklist compacto.
 * Só aparece depois que o usuário organizou o dia.
 */
export function HomeDayGlance({
  localDate,
  directionStatus,
  className = "",
}: {
  localDate: string;
  directionStatus: string;
  className?: string;
}) {
  const ctx = useDayContext(localDate);
  const nowMinutes = useNowMinutes();
  const qc = useQueryClient();
  const toggle = useServerFn(updateDayPriority);
  const [feedback, setFeedback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function flash() {
    setFeedback("✓ concluída");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 1600);
  }

  const key = ["day-panel", localDate];
  const mutate = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) =>
        old
          ? {
              ...old,
              priorities: old.priorities.map((p: any) =>
                p.id === v.id ? { ...p, done: v.done } : p,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(key, c.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const organized = ctx.loaded && (ctx.totalCount > 0 || ctx.events.length > 0 || !!ctx.note.trim());
  if (!organized) return null;

  const next = ctx.nextEvent;
  const remainingEvents = ctx.isToday
    ? ctx.events.filter((e) => {
        const [h, m] = e.start_time.split(":");
        return Number(h) * 60 + Number(m) >= nowMinutes;
      }).length
    : ctx.events.length;

  const visible = ctx.priorities.slice(0, 3);
  const allDone = ctx.totalCount > 0 && ctx.doneCount === ctx.totalCount;
  const parts = [
    `${remainingEvents} ${remainingEvents === 1 ? "compromisso" : "compromissos"}`,
    directionStatus === "—" ? "Direção pendente" : directionStatus,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className={`space-y-1.5 ${className}`}
    >
      {next && (
        <Link
          to="/atividade"
          className="flex items-center gap-2.5 rounded-[16px] px-3.5 py-2 transition active:opacity-80"
          style={{ background: "#FBFBFC", border: `1px solid ${HAIR}` }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(51,92,255,0.08)", color: BLUE }}
            aria-hidden
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M12 7.5V12l2.8 1.7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-[9.5px] font-medium uppercase tracking-[0.13em]"
              style={{ color: MUTED }}
            >
              Próximo compromisso
            </span>
            <span
              className="block truncate text-[12.5px] font-medium"
              style={{ color: INK, letterSpacing: "-0.01em" }}
            >
              {ctx.minutesToNextEvent !== null
                ? `${formatIn(ctx.minutesToNextEvent).replace("em ", "Em ")} · `
                : ""}
              {next.title} às {next.start_time.slice(0, 5)}
            </span>
          </span>
        </Link>
      )}

      <div
        className="rounded-[18px] px-4 py-3"
        style={{ background: "#FBFBFC", border: `1px solid ${HAIR}` }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium" style={{ color: INK }}>
            Seu dia
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={feedback ?? (allDone ? "done" : `${ctx.doneCount}/${ctx.totalCount}`)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] font-light tabular-nums"
              style={{ color: feedback || allDone ? BLUE : MUTED }}
            >
              {feedback ?? (allDone ? "Dia concluído ✓" : `${ctx.doneCount} de ${ctx.totalCount} concluídos`)}
            </motion.p>
          </AnimatePresence>
        </div>

        <div
          className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "rgba(17,17,17,0.06)" }}
        >
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${ctx.totalCount ? (ctx.doneCount / ctx.totalCount) * 100 : 0}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            style={{ background: BLUE }}
          />
        </div>

        {visible.length > 0 && (
          <ul className="mt-3 space-y-0.5">
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!p.done) flash();
                    mutate.mutate({ id: p.id, done: !p.done });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[10px] py-1.5 text-left transition active:opacity-70"
                >
                  <span
                    className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full transition"
                    style={
                      p.done
                        ? { background: BLUE, color: "#FFFFFF" }
                        : { border: "1.3px solid rgba(17,17,17,0.18)" }
                    }
                    aria-hidden
                  >
                    {p.done && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.2L4.8 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] transition-all duration-300"
                    style={{
                      color: p.done ? MUTED : INK,
                      textDecoration: p.done ? "line-through" : "none",
                      textDecorationColor: "rgba(17,17,17,0.25)",
                      opacity: p.done ? 0.75 : 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {p.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-light" style={{ color: MUTED }}>
            {parts.join(" · ")}
          </p>
          {ctx.totalCount > 3 && (
            <Link to="/atividade" className="text-[11px] font-medium" style={{ color: BLUE }}>
              Ver todas
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
