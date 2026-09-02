import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { getPillar, playbooksFor, PILLARS } from "@/lib/pillars";

export const Route = createFileRoute("/pilar/$slug")({
  head: () => ({
    meta: [
      { title: "Pilar · Agenda Magnética" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PillarDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center font-serif italic">Pilar não encontrado.</div>
  ),
});

function PillarDetail() {
  const { slug } = Route.useParams();
  const pillar = getPillar(slug);
  if (!pillar) throw notFound();
  const playbooks = playbooksFor(pillar);
  const idx = PILLARS.findIndex((p) => p.slug === slug);
  const next = PILLARS[idx + 1];
  const prev = PILLARS[idx - 1];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[820px] px-6 py-14 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Pilar 0{pillar.number} / 07
        </p>
        <h1 className="mt-3 font-serif text-4xl italic text-accent">{pillar.name}</h1>
        <p className="mt-2 font-serif italic text-xl text-muted-foreground">{pillar.tagline}</p>
        <p className="mt-6 max-w-[60ch] text-[16px] leading-relaxed">{pillar.description}</p>

        {/* Frameworks */}
        <section className="mt-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Frameworks
          </p>
          <div className="mt-4 space-y-px border border-border bg-border">
            {playbooks.map((pb) => (
              <Link
                key={pb.slug}
                to="/modulo/$slug"
                params={{ slug: pb.slug }}
                className="flex items-center justify-between bg-background p-5 hover:bg-muted"
              >
                <div>
                  <p className="font-serif text-lg italic text-accent">{pb.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{pb.subtitle}</p>
                </div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Ação da semana */}
        <section className="mt-12 border border-foreground p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em]">Ação desta semana</p>
          <p className="mt-3 font-serif text-lg italic leading-snug">{pillar.actionOfWeek}</p>
        </section>

        {/* Mentor prompt */}
        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Perguntar ao MAG
          </p>
          <Link
            to="/mentor"
            className="mt-3 block border border-border bg-muted p-5 text-[15px] leading-snug hover:bg-background"
          >
            "{pillar.mentorPrompt}"
            <span className="mt-3 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Conversar com o MAG →
            </span>
          </Link>
        </section>

        <nav className="mt-14 flex items-center justify-between border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest">
          {prev ? (
            <Link to="/pilar/$slug" params={{ slug: prev.slug }} className="text-muted-foreground">
              ← 0{prev.number} {prev.name}
            </Link>
          ) : (
            <Link to="/pilares" className="text-muted-foreground">
              ← Todos os pilares
            </Link>
          )}
          {next ? (
            <Link to="/pilar/$slug" params={{ slug: next.slug }}>
              0{next.number} {next.name} →
            </Link>
          ) : (
            <Link to="/app">Voltar ao workspace →</Link>
          )}
        </nav>
      </main>
    </div>
  );
}