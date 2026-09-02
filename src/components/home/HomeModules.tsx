import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays, Target, TrendingUp } from "lucide-react";
import { getHistoryOverview } from "@/lib/history-overview.functions";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";
const HAIR = "#ECECEF";

function Module({
  to,
  title,
  value,
  context,
  cta,
  Icon,
}: {
  to: string;
  title: string;
  value: string;
  context: string;
  cta: string;
  Icon: typeof Target;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col rounded-[16px] px-3 py-3 transition active:opacity-80"
      style={{ background: "#FFFFFF", border: `1px solid ${HAIR}` }}
    >
      <Icon aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.8} style={{ color: BLUE }} />
      <p
        className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.08em]"
        style={{ color: MUTED }}
      >
        {title}
      </p>
      <p
        className="mt-0.5 text-[15px] font-semibold leading-[1.2]"
        style={{ color: INK, letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] font-light leading-snug" style={{ color: MUTED }}>
        {context}
      </p>
      <span
        className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-medium"
        style={{ color: BLUE }}
      >
        {cta}
        <ArrowRight className="h-3 w-3" strokeWidth={2} />
      </span>
    </Link>
  );
}

/** Blocos verticais: Campo, Impacto e Resumo — hierarquia de dashboard. */
export function HomeModules() {
  const fetchOverview = useServerFn(getHistoryOverview);
  const { data } = useQuery({
    queryKey: ["history-overview", 7],
    queryFn: () => fetchOverview({ data: { days: 7 } }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const delta = data?.fieldDelta ?? null;
  const campoValue =
    delta === null || delta === undefined
      ? "Em construção"
      : `${delta > 0 ? "+" : ""}${delta}%`;
  const campoContext =
    delta === null || delta === undefined
      ? "Suas primeiras direções começam a formar seu campo."
      : "Quanto seu campo evoluiu nos últimos 7 dias.";

  const impacts = data?.impacts ?? 0;
  const impactValue = impacts === 1 ? "1 resultado" : `${impacts} resultados`;
  const impactContext =
    impacts > 0
      ? "Resultados gerados nesta semana."
      : "Nenhum resultado nesta semana.";

  const isSunday = new Date().getDay() === 0;

  return (
    <section className="mt-3 grid grid-cols-3 gap-2">
      <Module
        to="/campo-magnetico"
        title="Meu Campo"
        value={campoValue}
        context={campoContext}
        cta="Ver evolução"
        Icon={Target}
      />
      <Module
        to="/impacto"
        title="Impacto"
        value={impactValue}
        context={impactContext}
        cta="Ver impacto"
        Icon={TrendingUp}
      />
      <Module
        to="/resumo-semanal"
        title="Resumo iMAG"
        value={isSunday ? "Hoje" : "Domingo"}
        context="Seu resumo semanal fica pronto no domingo."
        cta="Ver resumo"
        Icon={CalendarDays}
      />
    </section>
  );
}
