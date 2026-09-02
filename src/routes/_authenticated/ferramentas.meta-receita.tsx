import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/ferramentas/meta-receita")({
  component: GoalCalculator,
});

function GoalCalculator() {
  const [goal, setGoal] = useState(20000);
  const [ticket, setTicket] = useState(500);

  const clientsMonth = ticket > 0 ? Math.ceil(goal / ticket) : 0;
  const clientsWeek = Math.ceil(clientsMonth / 4);
  const clientsDay = Math.ceil(clientsMonth / 22); // ~22 dias úteis/mês

  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 05</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Metas Semanais
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          Sua meta em números concretos. Clientes por mês, por semana e por dia útil.
        </p>

        <div className="mt-14 space-y-6 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-8 sm:p-10">
          <Row label="Faturamento desejado (R$/mês)" value={goal} set={setGoal} step={500} />
          <div className="h-px w-full bg-[#ECEBE5]" />
          <Row label="Ticket médio (R$)" value={ticket} set={setTicket} step={50} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Por mês" value={clientsMonth} />
          <Stat label="Por semana" value={clientsWeek} highlight />
          <Stat label="Por dia útil" value={clientsDay} sub="base 22 dias" />
        </div>

        <p className="mt-16 max-w-[46ch] text-[18px] leading-snug text-[#0A0A0A]" style={{ letterSpacing: "-0.02em" }}>
          Se você não sabe quantos clientes precisa hoje, sua semana já começou perdida.
        </p>
      </main>
    </div>
  );
}

function Row({ label, value, set, step, max }: { label: string; value: number; set: (n: number) => void; step: number; max?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#8B7355]">{label}</p>
        <input
          type="number"
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          step={step}
          max={max}
          className="w-40 rounded-[14px] border border-transparent bg-[#F5F4EF] px-4 py-2.5 text-right text-[15px] tabular-nums text-[#0A0A0A] outline-none transition focus:border-[#C6A15B] focus:bg-white"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight = false }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[20px] border p-6 transition ${highlight ? "border-transparent bg-[#0A0A0A] text-white" : "border-[rgba(0,0,0,0.06)] bg-white"}`}>
      <p className={`text-[10px] uppercase tracking-[0.35em] ${highlight ? "text-[#C6A15B]" : "text-[#8B7355]"}`}>
        {label}
      </p>
      <p className="mt-4 text-[44px] font-medium leading-none tabular-nums" style={{ letterSpacing: "-0.04em" }}>
        {value.toLocaleString("pt-BR")}
      </p>
      {sub && <p className={`mt-2 text-[11px] uppercase tracking-[0.3em] ${highlight ? "text-white/50" : "text-[#8B7355]"}`}>{sub}</p>}
    </div>
  );
}