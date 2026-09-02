import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/ferramentas/diagnostico")({
  component: DiagnosticTool,
});

type Q = { id: string; pillar: string; text: string };

const QUESTIONS: Q[] = [
  { id: "posicionamento", pillar: "Fundação", text: "Consigo dizer em uma frase quem é meu cliente ideal e o que entrego a ele." },
  { id: "preco", pillar: "Fundação", text: "Meu preço reflete meu posicionamento, não a média da concorrência." },
  { id: "perfil", pillar: "Perfil", text: "Meu perfil no Instagram comunica autoridade em menos de 5 segundos." },
  { id: "prova", pillar: "Autoridade", text: "Tenho prova social visível (depoimentos, resultados, antes/depois)." },
  { id: "frequencia", pillar: "Conteúdo", text: "Posto conteúdo consistente pelo menos 3x por semana." },
  { id: "gancho", pillar: "Conteúdo", text: "Sei escrever ganchos que fazem a pessoa parar de rolar." },
  { id: "cta", pillar: "Conversão", text: "Cada conteúdo meu tem um caminho claro para virar cliente." },
  { id: "objecao", pillar: "Conversão", text: "Sei responder à objeção de preço sem me justificar." },
  { id: "pos", pillar: "Fidelização", text: "Tenho um ritual de pós-atendimento que gera indicação natural." },
  { id: "meta", pillar: "Escala", text: "Sei exatamente quantos clientes preciso atender esta semana para bater minha meta." },
];

function DiagnosticTool() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answered = Object.keys(answers).length;
  const total = QUESTIONS.length;
  const score = useMemo(() => {
    const sum = Object.values(answers).reduce((a, b) => a + b, 0);
    return Math.round((sum / (total * 10)) * 100);
  }, [answers, total]);

  const verdict = getVerdict(score);

  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 01</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Diagnóstico Magnético
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          10 perguntas honestas. Cada uma vai de 0 a 10. No final, o retrato do seu negócio hoje.
        </p>

        {!submitted && (
          <>
            <div className="mt-12 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#8B7355]">Progresso</p>
              <p className="text-[13px] tabular-nums text-[#0A0A0A]">{answered}/{total}</p>
            </div>
            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#E6E4DE]">
              <div
                className="h-full bg-[#C6A15B] transition-all duration-700 ease-out"
                style={{ width: `${(answered / total) * 100}%` }}
              />
            </div>
            <ul className="mt-12 space-y-4">
              {QUESTIONS.map((q, i) => (
                <li key={q.id} className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-6 sm:p-8">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-[#8B7355]">
                    {String(i + 1).padStart(2, "0")} · {q.pillar}
                  </p>
                  <p className="mt-3 text-[17px] leading-snug text-[#0A0A0A]" style={{ letterSpacing: "-0.015em" }}>
                    {q.text}
                  </p>
                  <div className="mt-6 grid grid-cols-11 gap-1.5">
                    {Array.from({ length: 11 }).map((_, n) => {
                      const active = answers[q.id] === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: n }))}
                          className={`aspect-square rounded-[10px] text-[12px] tabular-nums transition ${
                            active
                              ? "bg-[#0A0A0A] text-white"
                              : "bg-[#F2F1EC] text-[#6B6B70] hover:bg-[#E6E4DE]"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={answered < total}
              className="mt-10 w-full rounded-full bg-[#0A0A0A] py-4 text-[13px] tracking-[0.04em] text-white transition hover:bg-[#1A1A1A] disabled:opacity-30"
            >
              {answered < total ? `Responda ${total - answered} restantes` : "Ver minha nota magnética"}
            </button>
          </>
        )}

        {submitted && (
          <section className="mt-16 animate-fade-in">
            <div className="rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white p-10 text-center sm:p-16">
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#8B7355]">Nota magnética</p>
              <p className="mt-6 text-[96px] font-medium leading-none text-[#0A0A0A] tabular-nums sm:text-[128px]" style={{ letterSpacing: "-0.06em" }}>
                {score}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">de 100</p>
              <p className="mt-10 text-[22px] font-medium text-[#0A0A0A]" style={{ letterSpacing: "-0.02em" }}>
                {verdict.title}
              </p>
              <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#4A4A4A]">{verdict.text}</p>
            </div>

            <p className="mt-16 text-[10px] uppercase tracking-[0.4em] text-[#8B7355]">Detalhamento</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {QUESTIONS.map((q) => {
                const v = answers[q.id] ?? 0;
                const weak = v <= 5;
                return (
                  <div
                    key={q.id}
                    className={`rounded-[18px] border p-5 ${weak ? "border-[#C97064]/30 bg-[#FBF3F1]" : "border-[rgba(0,0,0,0.06)] bg-white"}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-[#8B7355]">{q.pillar}</p>
                      <span className={`text-[14px] tabular-nums ${weak ? "text-[#C97064]" : "text-[#0A0A0A]"}`}>{v}/10</span>
                    </div>
                    <p className="mt-2 text-[14px] leading-snug text-[#0A0A0A]">{q.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => { setAnswers({}); setSubmitted(false); }}
                className="flex-1 rounded-full border border-[rgba(0,0,0,0.12)] py-3.5 text-[13px] tracking-[0.04em] text-[#0A0A0A] transition hover:border-[#0A0A0A]"
              >
                Refazer diagnóstico
              </button>
              <Link
                to="/ferramentas/planner"
                className="flex-1 rounded-full bg-[#0A0A0A] py-3.5 text-center text-[13px] tracking-[0.04em] text-white transition hover:bg-[#1A1A1A]"
              >
                Gerar plano de 30 dias →
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function getVerdict(score: number) {
  if (score >= 85) return { title: "Magnético", text: "Sua base está sólida. O jogo agora é escala e refinamento — não deixe cair a consistência." };
  if (score >= 65) return { title: "Consistente", text: "Você já atrai, mas ainda perde clientes por gargalos pontuais. Foque nos itens em vermelho." };
  if (score >= 45) return { title: "Instável", text: "Seu negócio tem picos e vales. Está na hora de virar processo, não sorte." };
  return { title: "Invisível", text: "Sua fundação precisa de atenção imediata. Comece pelos itens em vermelho antes de escalar qualquer coisa." };
}