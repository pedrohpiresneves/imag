import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { MODULES, moduleMeta } from "@/lib/modules";
import { fetchProgress } from "@/lib/user-data";
import { useAccess } from "@/lib/use-access";

export const Route = createFileRoute("/pilares")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Biblioteca Magnética · iMAG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PillarsPage,
});

function PillarsPage() {
  const { userId } = useAccess();
  const { data: progress = [] } = useQuery({
    queryKey: ["progress", userId],
    queryFn: () => fetchProgress(userId!),
    enabled: !!userId,
  });
  const applied = new Set(progress.filter((p) => p.completed).map((p) => p.module_slug));

  return (
    <div className="min-h-screen bg-background fade-rise">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] px-6 pt-20 pb-32 sm:px-10">
        <div className="max-w-[720px]">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Coleção completa
          </p>
          <h1
            className="mt-6 text-[clamp(40px,6vw,72px)] font-medium leading-[1.02] text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Biblioteca Magnética
          </h1>
          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-white/55 font-light">
            Dez capítulos. Um método. Cada capa é uma peça colecionável do manual iMAG.
          </p>
        </div>

        <div className="mt-16 sm:mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
          {MODULES.map((m, i) => {
            const done = applied.has(m.slug);
            const meta = moduleMeta(m.slug);
            return (
              <motion.div
                key={m.slug}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: (i % 3) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, scale: 1.015 }}
              >
                <Link
                  to="/modulo/$slug"
                  params={{ slug: m.slug }}
                  className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[24px] p-7 text-white"
                  style={{
                    background: meta.gradient,
                    boxShadow:
                      "0 30px 60px -30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.08)",
                  }}
                >
                  {/* Numeração gigante em marca d'água */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-4 bottom-2 select-none font-medium leading-none"
                    style={{
                      fontSize: "clamp(120px,20vw,200px)",
                      color: "rgba(255,255,255,0.08)",
                      letterSpacing: "-0.08em",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {String(m.number).padStart(2, "0")}
                  </span>

                  <div className="relative flex items-start justify-between">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/75" style={{ fontFamily: "var(--font-mono)" }}>
                      Capítulo {String(m.number).padStart(2, "0")} · {meta.duration}
                    </p>
                    {done && (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.3em]"
                        style={{ borderColor: "rgba(255,255,255,0.35)", color: "rgba(255,255,255,0.9)" }}
                      >
                        Lido
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <h2
                      className="text-[26px] font-medium leading-[1.05] text-white"
                      style={{ letterSpacing: "-0.035em" }}
                    >
                      {m.title}
                    </h2>
                    <p className="mt-3 text-[13px] leading-relaxed text-white/75 font-light">
                      {m.subtitle}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/80 transition group-hover:gap-3">
                      Abrir
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                        <path d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
