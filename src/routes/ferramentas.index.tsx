import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/ferramentas/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ferramentas Magnéticas · iMAG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ToolsIndex,
});

type Tool = {
  to:
    | "/ferramentas/whatsapp"
    | "/ferramentas/conteudo"
    | "/ferramentas/meta-receita"
    | "/ferramentas/checklist"
    | "/ferramentas/diagnostico"
    | "/ferramentas/planner";
  title: string;
  desc: string;
  ai: boolean;
  gradient: string;
  ink: "light" | "dark";
  glyph: ReactNode;
};

const G_BRONZE = "linear-gradient(160deg,#3A2A12 0%,#8B6A2E 55%,#C6A15B 100%)";
const G_TEAL   = "linear-gradient(160deg,#0A1E24 0%,#134152 55%,#2E7A8E 100%)";
const G_GREEN  = "linear-gradient(160deg,#0B1F14 0%,#12442C 55%,#2C8A5E 100%)";
const G_PURPLE = "linear-gradient(160deg,#1A0B24 0%,#3A1A52 55%,#6B32A0 100%)";
const G_GRAPH  = "linear-gradient(160deg,#151515 0%,#2A2A2A 55%,#4A4A4A 100%)";
const G_CREAM  = "linear-gradient(160deg,#EEE6D3 0%,#DFCFA6 55%,#C9B98A 100%)";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-14 w-14" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS: Tool[] = [
  { to: "/ferramentas/diagnostico",  title: "Diagnóstico Magnético",  desc: "10 perguntas. Uma nota. Um retrato honesto do seu negócio.",       ai: false, gradient: G_BRONZE, ink: "light", glyph: <Glyph d="M12 44 L32 12 L52 44 Z M22 44 h20" /> },
  { to: "/ferramentas/planner",      title: "Planner Magnético",      desc: "Um plano de ação personalizado para os próximos 30 dias.",         ai: true,  gradient: G_TEAL,   ink: "light", glyph: <Glyph d="M12 16 h40 M12 32 h40 M12 48 h28 M46 42 l6 6 -6 6" /> },
  { to: "/ferramentas/whatsapp",     title: "Mensagens Magnéticas",   desc: "Roteiros de WhatsApp prontos para copiar e enviar.",               ai: true,  gradient: G_GREEN,  ink: "light", glyph: <Glyph d="M12 52 l4 -10 A20 20 0 1 1 24 52 Z" /> },
  { to: "/ferramentas/conteudo",     title: "Laboratório de Conteúdo", desc: "Gancho, legenda, CTA, hashtags e ideias de imagem.",              ai: true,  gradient: G_PURPLE, ink: "light", glyph: <Glyph d="M16 16 h32 v32 h-32 z M16 32 h32 M32 16 v32" /> },
  { to: "/ferramentas/meta-receita", title: "Metas Semanais",         desc: "Sua meta ÷ ticket. Quantos clientes por dia, semana e mês.",       ai: false, gradient: G_GRAPH,  ink: "light", glyph: <Glyph d="M12 52 V32 M28 52 V22 M44 52 V12 M12 52 h40" /> },
  { to: "/ferramentas/checklist",    title: "Checklist de Captação",  desc: "15 sinais silenciosos de que sua fundação já está no ponto.",      ai: false, gradient: G_CREAM,  ink: "dark",  glyph: <Glyph d="M14 32 l8 8 20 -20 M14 46 l8 8 20 -20" /> },
];

function ToolsIndex() {
  return (
    <div className="surface-light min-h-screen fade-rise">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] px-6 pt-20 pb-32 sm:px-10">
        <div className="max-w-[720px]">
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ecossistema</p>
          <h1
            className="mt-6 text-[clamp(40px,6vw,72px)] font-medium leading-[1.02] text-[#0A0A0A]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Ferramentas Magnéticas
          </h1>
          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-[#4A4A4A]">
            Cada ferramenta transforma um pilar do método em ação prática — em minutos, não meses.
          </p>
        </div>

        <div className="mt-16 sm:mt-20 -mx-6 sm:-mx-10">
          <div className="rail-scroll flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-8 sm:px-10 sm:gap-8">
            {TOOLS.map((t, i) => (
              <motion.div
                key={t.to}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="snap-start shrink-0"
              >
                <Link
                  to={t.to}
                  onClick={() => track("tool_used", { tool: t.to.replace("/ferramentas/", "") })}
                  className="group relative flex h-[440px] w-[300px] flex-col justify-between overflow-hidden rounded-[28px] p-8 sm:h-[500px] sm:w-[360px] sm:p-10"
                  style={{
                    background: t.gradient,
                    boxShadow:
                      "0 30px 60px -30px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.08)",
                    color: t.ink === "dark" ? "#0A0A0A" : "#FFFFFF",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className={`opacity-70 ${t.ink === "dark" ? "text-[#0A0A0A]" : "text-white"}`}>
                      {t.glyph}
                    </div>
                    {t.ai && (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.3em]"
                        style={{
                          borderColor: t.ink === "dark" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)",
                          color: t.ink === "dark" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)",
                        }}
                      >
                        IA
                      </span>
                    )}
                  </div>
                  <div>
                    <p
                      className="text-[28px] sm:text-[32px] font-medium leading-[1.05]"
                      style={{ letterSpacing: "-0.035em" }}
                    >
                      {t.title}
                    </p>
                    <p
                      className="mt-4 text-[14px] leading-relaxed"
                      style={{ color: t.ink === "dark" ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.75)" }}
                    >
                      {t.desc}
                    </p>
                    <div
                      className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.3em] opacity-80 transition group-hover:opacity-100 group-hover:gap-3"
                    >
                      Abrir
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                        <path d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            <div className="shrink-0 w-2" aria-hidden />
          </div>
        </div>
      </main>
    </div>
  );
}