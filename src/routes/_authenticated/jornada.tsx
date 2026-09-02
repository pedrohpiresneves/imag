import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MagnetRewards } from "@/components/MagnetRewards";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { MagField } from "@/components/progress/MagField";
import { AntennaUnlock } from "@/components/progress/AntennaUnlock";
import { getAntennaState, markAntennaSeen } from "@/lib/antenna.functions";
import { ANTENNA_LEVELS, levelForMagnetos, levelProgress, nextLevelFor } from "@/lib/antenna";


export const Route = createFileRoute("/_authenticated/jornada")({
  validateSearch: (search: Record<string, unknown>): { r?: string } => ({
    r: typeof search.r === "string" ? search.r.slice(0, 60) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Progresso · iMAG" },
      {
        name: "description",
        content: "Seu campo cresce a cada direção executada: execução, constância e marcos.",
      },
      { property: "og:title", content: "Progresso · iMAG" },
      {
        property: "og:description",
        content: "Seu campo cresce a cada direção executada: execução, constância e marcos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JornadaPage,
});

const MUTED = "#6B6B70";
const BLUE = "#335CFF";
const HAIR = "#ECEDF0";

const MILESTONES = [3, 7, 15, 30, 60, 100, 365];

/** Explicação simples de como cada métrica é calculada. */
const METRIC_HELP: Record<string, string> = {
  magnetos:
    "Magnetos são pontos de evolução: você ganha 10 a cada direção concluída. O total define a sua antena.",
  offered: "Direções é o total de direções que a MAG criou para você até agora.",
  execution:
    "Execução é a porcentagem de direções concluídas em relação às direções recebidas.",
  constancy:
    "Constância conta em quantos dos últimos 7 dias você concluiu ao menos uma direção.",
};

function JornadaPage() {
  const fetchAntenna = useServerFn(getAntennaState);
  const seenAntenna = useServerFn(markAntennaSeen);
  const [openMilestone, setOpenMilestone] = useState(false);
  const [metric, setMetric] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);

  const { data: antenna } = useQuery({
    queryKey: ["antenna-state"],
    queryFn: () => fetchAntenna({ data: { tzOffsetMinutes: new Date().getTimezoneOffset() } }),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (antenna?.celebrate) setCelebrating(antenna.celebrate);
  }, [antenna?.celebrate]);

  const magnetos = antenna?.total ?? 0;
  const level = levelForMagnetos(magnetos);
  const nextLevel = nextLevelFor(magnetos);
  const levelPct = levelProgress(magnetos);
  const celebratingLevel = ANTENNA_LEVELS.find((l) => l.key === celebrating) ?? null;

  const metrics = {
    offered: antenna?.directions ?? 0,
    execution: antenna?.execution ?? 0,
    constancy: antenna?.constancy ?? 0,
  };

  // Ritmo geral: execução e constância, sem score arbitrário.
  const rhythm = Math.min(1, (metrics.execution / 100) * 0.6 + (metrics.constancy / 7) * 0.4);

  const doneDays = antenna?.historyDays ?? 0;
  const target = MILESTONES.find((m) => m > doneDays) ?? null;
  const missing = target ? Math.max(0, target - doneDays) : 0;


  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: "#111111", fontFamily: "var(--font-sans)" }}
    >
      <AppHeader minimal light />

      <main className="relative mx-auto max-w-[520px] px-6 pb-44 pt-4">
        <h1
          className="text-[29px] font-semibold leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
        >
          Progresso
        </h1>

        <section className="mt-4 flex items-center gap-4">
          <MagField progress={rhythm} size={112} magnetos={magnetos} />
          <div className="min-w-0 flex-1">
            <p className="text-[16.5px] font-semibold" style={{ letterSpacing: "-0.025em" }}>
              {level.name}
            </p>
            <button
              type="button"
              onClick={() => setMetric((v) => (v === "magnetos" ? null : "magnetos"))}
              className="mt-0.5 block text-left text-[13.5px] font-light underline-offset-4 transition active:opacity-60"
              style={{ color: MUTED, textDecoration: "underline dotted" }}
            >
              {magnetos.toLocaleString("pt-BR")} Magnetos
            </button>
            <div
              className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: "#EDEEF1" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.round(levelPct * 100)}%`, background: level.color }}
              />
            </div>
            <p className="mt-2 text-[12.5px] font-light leading-[1.4]" style={{ color: MUTED }}>
              {nextLevel
                ? `Faltam ${(antenna?.missing ?? nextLevel.threshold - magnetos).toLocaleString("pt-BR")} para a ${nextLevel.name}`
                : "Você alcançou a última antena. Seu sinal está no máximo."}
            </p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3">
          {[
            { key: "offered", value: `${metrics.offered}`, label: "Direções", blue: false },
            { key: "execution", value: `${metrics.execution}%`, label: "Execução", blue: true },
            {
              key: "constancy",
              value: `${metrics.constancy}/7 dias`,
              label: "Constância",
              blue: false,
            },
          ].map((m, i) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setMetric((v) => (v === m.key ? null : m.key))}
              aria-expanded={metric === m.key}
              className="px-2 text-center transition active:opacity-60"
              style={i > 0 ? { borderLeft: `1px solid ${HAIR}` } : undefined}
            >
              <p
                className="text-[21px] font-semibold leading-none"
                style={{ letterSpacing: "-0.03em", color: m.blue ? BLUE : "#111111" }}
              >
                {m.value}
              </p>
              <p
                className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em]"
                style={{ color: MUTED }}
              >
                {m.label}
              </p>
            </button>
          ))}
        </section>

        <AnimatePresence initial={false}>
          {metric && (
            <motion.p
              key={metric}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden text-[12.5px] font-light leading-[1.5]"
              style={{ color: MUTED }}
            >
              <span className="mt-3 block">{METRIC_HELP[metric]}</span>
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-8 h-px w-full" style={{ background: HAIR }} />

        <section className="mt-7">
          <h2
            className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#9A9AA0" }}
          >
            Próximo marco
          </h2>
          {target ? (
            <>
              <button
                type="button"
                onClick={() => setOpenMilestone((v) => !v)}
                aria-expanded={openMilestone}
                className="mt-3 flex w-full items-center gap-4 text-left transition active:opacity-70"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold" style={{ letterSpacing: "-0.025em" }}>
                    {target} dias com direção
                  </span>
                  <span className="mt-0.5 block text-[13.5px] font-light" style={{ color: MUTED }}>
                    {missing === 1 ? "Falta 1 dia" : `Faltam ${missing} dias`}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[13px] font-medium"
                  style={{ color: level.color }}
                >
                  +{target} magnetos
                </span>

                <ChevronRight
                  className="h-[18px] w-[18px] shrink-0 transition-transform"
                  strokeWidth={1.75}
                  style={{ color: "#B7B7BD", transform: openMilestone ? "rotate(90deg)" : "none" }}
                />
              </button>
              <AnimatePresence initial={false}>
                {openMilestone && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <div
                        className="h-[3px] w-full overflow-hidden rounded-full"
                        style={{ background: "#EDEEF1" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, (doneDays / target) * 100)}%`,
                            background: BLUE,
                          }}
                        />
                      </div>
                      <p className="mt-2.5 text-[12.5px] font-light leading-[1.5]" style={{ color: MUTED }}>
                        {doneDays} de {target} dias com direção concluída. A cada dia concluído o
                        marco avança sozinho — depois de {target} dias, a MAG abre o próximo.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <p className="mt-3 text-[13.5px] font-light" style={{ color: MUTED }}>
              Todos os marcos alcançados. A MAG segue caminhando com você.
            </p>
          )}
        </section>

        <div className="mt-8 h-px w-full" style={{ background: HAIR }} />

        <section className="mt-7">
          <Link
            to="/magnetos"
            className="flex w-full items-center justify-between gap-4 text-left transition active:opacity-60"
          >
            <span className="min-w-0">
              <span
                className="block text-[10.5px] font-medium uppercase tracking-[0.16em]"
                style={{ color: "#9A9AA0" }}
              >
                Como ganhar Magnetos
              </span>
              <span className="mt-1.5 block text-[13.5px] font-light" style={{ color: MUTED }}>
                Recompensas por progresso real
              </span>
            </span>
            <ChevronRight
              className="h-[18px] w-[18px] shrink-0"
              strokeWidth={1.75}
              style={{ color: "#B7B7BD" }}
            />
          </Link>
        </section>

        <MagnetRewards />
      </main>


      <BottomNav />

      <AntennaUnlock
        level={celebratingLevel}
        onClose={() => {
          if (celebrating) void seenAntenna({ data: { levelKey: celebrating } });
          setCelebrating(null);
        }}
      />

    </div>
  );
}
