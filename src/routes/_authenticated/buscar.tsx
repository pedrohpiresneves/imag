import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MODULES } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/buscar")({
  component: SearchPage,
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function SearchPage() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const query = normalize(q.trim());
    if (query.length < 2) return [];
    return MODULES.flatMap((m) => {
      const haystacks = [m.title, m.subtitle, m.intro, ...(m.paragraphs ?? []), m.quote ?? ""];
      const matches = haystacks.filter((h) => normalize(h).includes(query));
      if (matches.length === 0) return [];
      const snippet = matches[0];
      const idx = normalize(snippet).indexOf(query);
      const start = Math.max(0, idx - 40);
      const end = Math.min(snippet.length, idx + query.length + 80);
      return [{ module: m, snippet: (start > 0 ? "…" : "") + snippet.slice(start, end) + (end < snippet.length ? "…" : "") }];
    });
  }, [q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[420px] px-6 py-10 sm:max-w-[560px] sm:px-10 sm:py-14">
        <div className="flex items-center gap-3 border-b border-foreground/20 pb-3">
          <span className="font-mono text-muted-foreground">/</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Buscar no manual…"
            className="w-full bg-transparent font-serif text-2xl italic outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="mt-10 space-y-8">
          {q.trim().length < 2 && (
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Digite ao menos 2 caracteres
            </p>
          )}
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Nenhum resultado
            </p>
          )}
          {results.map(({ module: m, snippet }) => (
            <Link
              key={m.slug}
              to="/modulo/$slug"
              params={{ slug: m.slug }}
              className="block border-b border-border pb-6"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Capítulo {String(m.number).padStart(2, "0")}
              </span>
              <h4 className="mt-1 font-serif text-xl italic">{m.title}</h4>
              <p className="mt-2 text-sm leading-normal text-muted-foreground">{snippet}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
