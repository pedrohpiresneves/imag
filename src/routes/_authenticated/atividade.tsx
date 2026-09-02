import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { DayExecution } from "@/components/home/DayExecution";
import { DirectionToday } from "@/components/home/DirectionToday";
import { WeeklyFocusCard } from "@/components/home/WeeklyFocusCard";
import { DayCloseCard } from "@/components/home/DayCloseCard";
import { useLocalDate } from "@/components/home/use-day-context";
import { supabase } from "@/integrations/supabase/client";
import { MagnetRewards } from "@/components/MagnetRewards";
import { QuickShortcuts } from "@/components/home/QuickShortcuts";




export const Route = createFileRoute("/_authenticated/atividade")({
  head: () => ({
    meta: [
      { title: "Hoje · iMAG" },
      {
        name: "description",
        content: "Sua direção, compromissos e tarefas do dia em um só lugar.",
      },
      { property: "og:title", content: "Hoje · iMAG" },
      {
        property: "og:description",
        content: "Sua direção, compromissos e tarefas do dia em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AtividadePage,
});

function AtividadePage() {
  /** Data local viva: a virada do dia troca direção e tarefas automaticamente. */
  const localDate = useLocalDate();
  /** Um card expandido por vez — direção ou organização do dia. */
  const [open, setOpen] = useState<"direction" | "day" | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const name = ((p as { full_name?: string | null } | null)?.full_name ?? "").trim();
      if (alive) setFirstName(name.split(" ")[0] || null);
    })();
    return () => {
      alive = false;
    };
  }, []);



  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: "#111111", fontFamily: "var(--font-sans)" }}
    >
      <AppHeader minimal light />

      <main className="relative mx-auto max-w-[520px] px-5 pb-44 pt-3">
        <h1
          className="text-[32px] font-semibold leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
        >
          Hoje
        </h1>

        {/* 0.5 · Foco da semana — faixa compacta acima da direção */}
        <WeeklyFocusCard className="mt-3" localDate={localDate} />

        {/* 1 · Direção do dia — recado principal da MAG */}
        <DirectionToday
          className="mt-4"
          localDate={localDate}
          expanded={open === "direction"}
          onExpandedChange={(v) => setOpen(v ? "direction" : null)}
        />

        {/* 1.2 · Atalhos secundários — agenda, dinheiro e círculos */}
        <QuickShortcuts className="mt-5" />


        {/* 1.5 · Encerramento do dia — a partir do horário definido */}
        <DayCloseCard className="mt-4" localDate={localDate} firstName={firstName} />

        {/* 2/3 · Agenda, compromissos e prioridades */}
        <DayExecution className="mt-4" localDate={localDate} />

      </main>



      <MagnetRewards localDate={localDate} />
      <BottomNav />
    </div>
  );
}
