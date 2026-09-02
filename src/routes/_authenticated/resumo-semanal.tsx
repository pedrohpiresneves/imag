import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { WeeklyRecapStories, useWeeklyRecap } from "@/components/WeeklyRecap";

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

export const Route = createFileRoute("/_authenticated/resumo-semanal")({
  head: () => ({
    meta: [
      { title: "Resumo semanal · iMAG" },
      {
        name: "description",
        content:
          "Veja o que suas direções movimentaram na semana: execução, impacto e evolução do seu Campo Magnético.",
      },
      { property: "og:title", content: "Resumo semanal · iMAG" },
      {
        property: "og:description",
        content: "O que suas direções movimentaram esta semana, em 20 segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeeklyRecapPage,
});

function WeeklyRecapPage() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useWeeklyRecap(true);

  return (
    <div className="min-h-screen" style={{ background: "#FCFBF8" }}>
      <AppHeader />
      <main className="mx-auto w-full max-w-[720px] px-5 pb-32 pt-8">
        <h1 className="text-[32px] font-semibold leading-[1.1]" style={{ ...DISPLAY, color: INK }}>
          Resumo <span style={{ color: BLUE }}>semanal</span>
        </h1>
        <p className="mt-2 text-[14.5px]" style={{ color: MUTED }}>
          O que suas direções movimentaram nos últimos 7 dias.
        </p>

        {isLoading ? (
          <div className="mt-10 flex items-center gap-2 text-[14px]" style={{ color: MUTED }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando sua semana…
          </div>
        ) : data ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-7 w-full rounded-[22px] px-5 py-6 text-left"
            style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
          >
            <div className="grid grid-cols-2 gap-y-5">
              <Stat label="Direções recebidas" value={data.received} />
              <Stat label="Executadas" value={data.executed} />
              <Stat label="Impactos gerados" value={data.impacts.length} />
              <Stat label="Dias em movimento" value={data.activeDays} />
            </div>
            <span
              className="mt-6 inline-flex items-center gap-1.5 text-[14.5px] font-medium"
              style={{ color: BLUE }}
            >
              Ver meu resumo <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
            </span>
          </motion.button>
        ) : null}
      </main>
      {open && data && <WeeklyRecapStories recap={data} onClose={() => setOpen(false)} />}
      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[28px] font-semibold" style={{ ...DISPLAY, color: INK }}>
        {value}
      </p>
      <p className="text-[12.5px]" style={{ color: MUTED }}>
        {label}
      </p>
    </div>
  );
}