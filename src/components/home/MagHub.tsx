import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarCheck, ChevronRight, Compass } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useDayContext } from "@/components/home/use-day-context";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";
const HAIR = "rgba(17,17,17,0.06)";

type Action = {
  key: string;
  label: string;
  hint: string;
  Icon: typeof Compass;
  meta?: string;
};

/**
 * Hub central da Home — a MAG pergunta, o usuário escolhe.
 * Cada ação muda de estado depois de usada (direção gerada, dia organizado).
 */
export function MagHub({
  onDirection,
  onOrganize,
  directionTitle,
  directionDone,
  localDate,
}: {
  onDirection: () => void;
  onOrganize: () => void;
  directionTitle?: string | null;
  directionDone?: boolean;
  localDate: string;
}) {
  const navigate = useNavigate();
  const ctx = useDayContext(localDate);

  const hasDirection = Boolean(directionTitle);
  const organized = ctx.loaded && (ctx.totalCount > 0 || ctx.events.length > 0);
  const next = ctx.nextEvent;
  const daySummary = organized
    ? [
        ctx.totalCount > 0
          ? `${ctx.totalCount} ${ctx.totalCount === 1 ? "tarefa" : "tarefas"}`
          : null,
        ctx.events.length > 0
          ? `${ctx.events.length} ${ctx.events.length === 1 ? "compromisso" : "compromissos"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const ACTIONS: Action[] = [
    hasDirection
      ? {
          key: "direction",
          label: "Sua direção",
          hint: directionTitle!,
          meta: directionDone ? "Concluída ✓ · Ver direção" : "Em andamento · Ver direção",
          Icon: Compass,
        }
      : {
          key: "direction",
          label: "Me direcionar",
          hint: "Receber minha direção de hoje",
          Icon: Compass,
        },
    organized
      ? {
          key: "day",
          label: "Seu dia está organizado",
          hint: daySummary,
          meta: next
            ? `Próximo: ${next.start_time.slice(0, 5)} · ${next.title} — Ver meu dia`
            : "Ver meu dia",
          Icon: CalendarCheck,
        }
      : {
          key: "day",
          label: "Organizar meu dia",
          hint: "Compromissos, tarefas e foco",
          Icon: CalendarCheck,
        },
  ];

  function run(key: string) {
    haptic(8);
    if (key === "day") {
      if (organized) navigate({ to: "/atividade" });
      else onOrganize();
    } else onDirection();
  }



  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[26px] px-5 pb-2.5 pt-4"
      style={{
        background: "linear-gradient(180deg, #F7F9FE 0%, #FCFDFF 100%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.16em]"
            style={{ color: BLUE }}
          >
            MAG
          </p>
          <h2
            className="mt-0.5 text-[18px] font-semibold leading-[1.2]"
            style={{ color: INK, letterSpacing: "-0.03em" }}
          >
            O que você precisa agora?
          </h2>
          <p className="mt-0.5 text-[12px] font-light" style={{ color: MUTED }}>
            Por onde começamos?
          </p>
        </div>
      </div>

      <ul className="mt-2.5">
        {ACTIONS.map(({ key, label, hint, Icon, meta }, i) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => run(key)}
              className="flex w-full items-center gap-3 py-2.5 text-left transition active:opacity-60"
              style={i > 0 ? { borderTop: `1px solid ${HAIR}` } : undefined}
            >
              <Icon
                aria-hidden
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={1.6}
                style={{ color: BLUE }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[14px] font-medium leading-tight"
                  style={{ color: INK, letterSpacing: "-0.015em" }}
                >
                  {label}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] font-light" style={{ color: MUTED }}>
                  {hint}
                </span>
                {meta && (
                  <span
                    className="mt-0.5 block truncate text-[10.5px] font-medium"
                    style={{ color: BLUE }}
                  >
                    {meta}
                  </span>
                )}
              </span>

              <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.6} style={{ color: "#C3C6CE" }} />
            </button>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
