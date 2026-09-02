import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { generateMagneticPlan } from "@/lib/ai-tools.functions";
import { PaywallLock } from "@/components/PaywallLock";

export const Route = createFileRoute("/_authenticated/ferramentas/planner")({
  component: PlannerTool,
});

const STAGES = [
  { id: "comecando", label: "Começando" },
  { id: "instavel", label: "Instável" },
  { id: "faturando", label: "Faturando" },
  { id: "escalando", label: "Escalando" },
] as const;

const FOCI = [
  { id: "autoridade", label: "Autoridade" },
  { id: "atracao", label: "Atração" },
  { id: "conversao", label: "Conversão" },
  { id: "fidelizacao", label: "Fidelização" },
] as const;

type Stage = (typeof STAGES)[number]["id"];
type Focus = (typeof FOCI)[number]["id"];
type Result = { diagnosis: string; week1: string; week2: string; week3: string; week4: string; ritual: string };

function PlannerTool() {
  const [goal, setGoal] = useState("");
  const [currentStage, setStage] = useState<Stage>("instavel");
  const [hoursPerWeek, setHours] = useState(10);
  const [focus, setFocus] = useState<Focus>("atracao");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => generateMagneticPlan({ data: { goal, currentStage, hoursPerWeek, focus } }),
    onSuccess: (r) => { setResult(r); setError(null); },
    onError: (e: Error) => { setError(e.message); setResult(null); },
  });

  const fullText = result
    ? [
        `Diagnóstico:\n${result.diagnosis}`,
        `Semana 1:\n${result.week1}`,
        `Semana 2:\n${result.week2}`,
        `Semana 3:\n${result.week3}`,
        `Semana 4:\n${result.week4}`,
        `Ritual diário:\n${result.ritual}`,
      ].join("\n\n")
    : "";

  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 02</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Planner Magnético
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          Um plano sob medida para o seu momento. Quatro semanas mais um ritual diário.
        </p>

        <PaywallLock label="Gere seu plano de 30 dias após liberar seu acesso.">
          <form
            onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}
            className="mt-14 space-y-8 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-7 sm:p-10"
          >
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Qual é seu objetivo nos próximos 30 dias?</p>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
                rows={3}
                placeholder="Ex.: sair dos R$ 8k e travar R$ 20k por mês com harmonização facial."
                className="w-full resize-none rounded-[14px] border border-transparent bg-[#F5F4EF] p-4 text-[15px] text-[#0A0A0A] outline-none transition placeholder:text-[#8B7355]/70 focus:border-[#C6A15B] focus:bg-white"
              />
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Estágio atual</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => {
                  const active = currentStage === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStage(s.id)}
                      className={`rounded-full px-4 py-2 text-[13px] transition ${
                        active ? "bg-[#0A0A0A] text-white" : "border border-[rgba(0,0,0,0.1)] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Foco principal</p>
              <div className="flex flex-wrap gap-2">
                {FOCI.map((f) => {
                  const active = focus === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFocus(f.id)}
                      className={`rounded-full px-4 py-2 text-[13px] transition ${
                        active ? "bg-[#0A0A0A] text-white" : "border border-[rgba(0,0,0,0.1)] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Horas disponíveis / semana</p>
                <span className="text-[15px] tabular-nums text-[#0A0A0A]">{hoursPerWeek}h</span>
              </div>
              <input
                type="range"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHours(Number(e.target.value))}
                className="mt-4 w-full accent-[#0A0A0A]"
              />
            </div>
            <button
              type="submit"
              disabled={gen.isPending || goal.trim().length < 3}
              className="w-full rounded-full bg-[#0A0A0A] py-4 text-[13px] tracking-[0.04em] text-white transition hover:bg-[#1A1A1A] disabled:opacity-30"
            >
              {gen.isPending ? "Gerando seu plano…" : "Gerar plano de 30 dias"}
            </button>
          </form>
        </PaywallLock>

        {error && (
          <p className="mt-6 rounded-[14px] border border-[#C97064]/30 bg-[#FBF3F1] p-4 text-[14px] text-[#C97064]">{error}</p>
        )}

        {result && (
          <section className="mt-12 space-y-4 animate-fade-in">
            {result.diagnosis && <Block label="Diagnóstico" text={result.diagnosis} serif />}
            <WeekBlock week={1} text={result.week1} />
            <WeekBlock week={2} text={result.week2} />
            <WeekBlock week={3} text={result.week3} />
            <WeekBlock week={4} text={result.week4} />
            {result.ritual && <Block label="Ritual diário" text={result.ritual} />}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(fullText)}
              className="w-full rounded-full border border-[rgba(0,0,0,0.12)] py-3.5 text-[13px] tracking-[0.04em] text-[#0A0A0A] transition hover:border-[#0A0A0A]"
            >
              Copiar plano completo
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Block({ label, text, serif = false }: { label: string; text: string; serif?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#8B7355]">{label}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-full border border-[rgba(0,0,0,0.12)] px-3.5 py-1.5 text-[11px] tracking-[0.04em] text-[#0A0A0A] transition hover:border-[#0A0A0A]"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className={`mt-5 whitespace-pre-wrap ${serif ? "text-[16px] leading-relaxed text-[#0A0A0A]" : "text-[14px] leading-relaxed text-[#6B6B70]"}`}>{text}</p>
    </article>
  );
}

function WeekBlock({ week, text }: { week: number; text: string }) {
  if (!text) return null;
  return (
    <article className="rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-white p-6 sm:p-8">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#8B7355]">Semana {week}</p>
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#8B7355]">
          {week === 1 ? "Fundação" : week === 2 ? "Atração" : week === 3 ? "Conversão" : "Escala"}
        </span>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-[16px] leading-relaxed text-[#0A0A0A]">{text}</p>
    </article>
  );
}