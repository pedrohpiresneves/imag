import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/magnetos")({
  head: () => ({
    meta: [
      { title: "Como ganhar Magnetos · iMAG" },
      {
        name: "description",
        content: "Todas as regras de Magnetos: recompensas por progresso real na iMAG.",
      },
      { property: "og:title", content: "Como ganhar Magnetos · iMAG" },
      {
        property: "og:description",
        content: "Todas as regras de Magnetos: recompensas por progresso real na iMAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MagnetosPage,
});

const MUTED = "#6B6B70";
const BLUE = "#335CFF";
const HAIR = "#ECEDF0";

/** Regras de recompensa por progresso real. */
const MAGNET_RULES: { label: string; value: string }[] = [
  { label: "Concluir a direção do dia", value: "+10" },
  { label: "Concluir todas as tarefas do dia", value: "+10" },
  { label: "Concluir um Círculo", value: "+20" },
  { label: "Desafio com amigos (por participante ativo, até 5)", value: "+10" },
  { label: "Finalizar o onboarding (uma única vez)", value: "+5" },
  { label: "Retomar após 7 dias ou mais de ausência (1 a cada 30 dias)", value: "+10" },
];

/** Marcos por dias com direção — valor específico de cada marco. */
const MILESTONE_RULES: { label: string; value: string }[] = [
  { label: "3 dias com direção", value: "+3" },
  { label: "7 dias com direção", value: "+7" },
  { label: "15 dias com direção", value: "+15" },
  { label: "30 dias com direção", value: "+30" },
  { label: "60 dias com direção", value: "+60" },
  { label: "100 dias com direção", value: "+100" },
  { label: "365 dias com direção", value: "+365" },
];

function Rules({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="mt-3">
      {items.map((r) => (
        <li
          key={r.label}
          className="flex items-baseline justify-between gap-4 py-2.5"
          style={{ borderTop: `1px solid ${HAIR}` }}
        >
          <span className="text-[13.5px] font-light" style={{ color: "#4A4A50" }}>
            {r.label}
          </span>
          <span className="shrink-0 text-[13px] font-medium" style={{ color: BLUE }}>
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MagnetosPage() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: "#111111", fontFamily: "var(--font-sans)" }}
    >
      <div className="surface-light">
        <AppHeader minimal />
      </div>

      <main className="relative mx-auto max-w-[520px] px-6 pb-44 pt-4">
        <Link
          to="/jornada"
          className="inline-flex items-center gap-1 text-[13px] font-light transition active:opacity-60"
          style={{ color: MUTED }}
        >
          <ChevronLeft className="h-[16px] w-[16px]" strokeWidth={1.75} />
          Progresso
        </Link>

        <h1
          className="mt-3 text-[29px] font-semibold leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
        >
          Como ganhar Magnetos
        </h1>
        <p className="mt-1.5 text-[13.5px] font-light" style={{ color: MUTED }}>
          Recompensas por progresso real.
        </p>

        <section className="mt-8">
          <h2
            className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#9A9AA0" }}
          >
            Ações do dia
          </h2>
          <Rules items={MAGNET_RULES} />
        </section>

        <section className="mt-8">
          <h2
            className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#9A9AA0" }}
          >
            Marcos por dias com direção
          </h2>
          <Rules items={MILESTONE_RULES} />
        </section>

        <p className="mt-6 text-[12px] font-light leading-[1.5]" style={{ color: MUTED }}>
          Cada ação é recompensada uma única vez.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
