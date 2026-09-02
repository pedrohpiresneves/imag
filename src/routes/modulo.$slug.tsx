import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { MODULES, getModule, getModuleIndex } from "@/lib/modules";
import {
  fetchFavorites,
  markModuleRead,
  toggleFavorite,
} from "@/lib/user-data";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import manualPdf from "@/assets/manual-pdf.asset.json";
import { CastExpandedPlayer } from "@/components/CastExpandedPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useCastPlayer } from "@/lib/podcast/player-context";

export const Route = createFileRoute("/modulo/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Capítulo · iMAG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ModuleReader,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-10 text-center text-black/70">
      Capítulo não encontrado.
    </div>
  ),
});

const DEFAULT_PREVIEW = 2;

function ModuleReader() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mod = getModule(slug);
  if (!mod) throw notFound();

  const idx = getModuleIndex(slug);
  const prev = idx > 0 ? MODULES[idx - 1] : null;
  const next = idx < MODULES.length - 1 ? MODULES[idx + 1] : null;

  const { userId, isPaid, isLoggedIn } = useAccess();

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", userId],
    queryFn: () => fetchFavorites(userId!),
    enabled: !!userId,
  });
  const isFav = favorites.includes(slug);

  useEffect(() => {
    if (userId && isPaid) {
      markModuleRead(userId, slug, false).catch(() => {});
      qc.invalidateQueries({ queryKey: ["progress", userId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, userId, isPaid]);

  const favMutation = useMutation({
    mutationFn: (on: boolean) => toggleFavorite(userId!, slug, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", userId] }),
  });

  const markComplete = useMutation({
    mutationFn: () => markModuleRead(userId!, slug, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress", userId] });
      if (next) navigate({ to: "/modulo/$slug", params: { slug: next.slug } });
      else navigate({ to: "/app" });
    },
  });

  const canAutoComplete = isPaid && !!userId;

  // Check if this module has an audio registered (metadata only, no signed URL yet)
  const { data: audioMeta } = useQuery({
    queryKey: ["module_audio_meta", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("module_audio")
        .select("module_slug, duration_seconds")
        .eq("module_slug", slug)
        .maybeSingle();
      return data;
    },
    enabled: !!isLoggedIn,
  });
  const hasAudio = !!audioMeta;

  const [mode, setMode] = useState<"read" | "listen">("read");
  const player = useCastPlayer();

  // Deep-link: /modulo/<slug>#audio opens the MAGcast tab automatically.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#audio" && hasAudio) {
      setMode("listen");
      // Auto-start playback if not already playing this track.
      if (isPaid && player.track?.slug !== slug) {
        void player.play({ slug, title: mod.title, subtitle: mod.subtitle, durationHint: audioMeta?.duration_seconds ?? null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAudio, slug, isPaid]);

  // Signed URL is fetched lazily by the global player when the user hits play.

  const previewCount = isPaid ? mod.paragraphs.length : (mod.freePreview ?? 1);
  const visibleParagraphs = mod.paragraphs.slice(0, previewCount);
  const truncated = visibleParagraphs.length < mod.paragraphs.length;
  const showIntro = isPaid || previewCount > 0;

  // Tempo de leitura aproximado (~220 palavras/min)
  const wordCount =
    (mod.intro?.split(/\s+/).length ?? 0) +
    mod.paragraphs.reduce((acc, p) => acc + p.split(/\s+/).length, 0);
  const readMinutes = Math.max(1, Math.round(wordCount / 220));

  function handleFavorite() {
    if (!isLoggedIn) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isPaid) return; // gate shows below
    favMutation.mutate(!isFav);
  }

  return (
    <div
      className="surface-light min-h-screen text-black"
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, rgba(198,161,91,0.10), transparent 60%), #FAFAF7",
        fontFamily: "var(--font-sans)",
      }}
    >
      <AppHeader />
      <main className="mx-auto max-w-[680px] px-6 pt-14 pb-24 sm:px-8 sm:pt-20">
        {/* Meta bar */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-black/45">
          <span>
            Capítulo {String(mod.number).padStart(2, "0")}
            <span className="mx-2 text-black/25">·</span>
            {readMinutes} min de leitura
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleFavorite}
              disabled={!isPaid}
              title={!isPaid ? "Desbloqueie para favoritar" : "Favoritar"}
              aria-label="Favoritar"
              className="transition hover:text-[color:var(--accent)] disabled:opacity-40"
            >
              {isFav ? "★" : "☆"}
            </button>
            {isPaid ? (
              <a
                href={manualPdf.url}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-[color:var(--accent)]"
              >
                PDF
              </a>
            ) : (
              <span className="opacity-40" title="Desbloqueie para baixar">
                PDF
              </span>
            )}
          </div>
        </div>

        {/* Título */}
        <h1
          className="mt-8 text-[2.25rem] font-medium leading-[1.1] tracking-[-0.02em] text-black sm:text-[2.75rem]"
        >
          {mod.title}
        </h1>
        <p className="mt-4 text-lg leading-snug text-black/60">
          {mod.subtitle}
        </p>

        {hasAudio && (
          <div className="mt-10">
            <div
              role="tablist"
              aria-label="Modo de leitura"
              className="inline-flex overflow-hidden rounded-full border border-black/10 bg-black/[0.03] p-1 backdrop-blur"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "read"}
                onClick={() => setMode("read")}
                className={`rounded-full px-5 py-1.5 text-[11px] uppercase tracking-[0.22em] transition ${
                  mode === "read"
                    ? "bg-[color:var(--accent)] text-black"
                    : "text-black/60 hover:text-black"
                }`}
              >
                Ler
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "listen"}
                onClick={() => setMode("listen")}
                className={`rounded-full px-5 py-1.5 text-[11px] uppercase tracking-[0.22em] transition ${
                  mode === "listen"
                    ? "bg-[color:var(--accent)] text-black"
                    : "text-black/60 hover:text-black"
                }`}
              >
                Ouvir
              </button>
            </div>

            {mode === "listen" && (
              <div className="mt-5">
                {!isPaid && (
                  <p className="rounded-2xl border border-black/10 bg-black/[0.03] p-5 text-black/70">
                    Assine um plano para ouvir a versão narrada.
                  </p>
                )}
                {isPaid && (
                  <CastExpandedPlayer
                    slug={slug}
                    title={mod.title}
                    subtitle={mod.subtitle}
                    durationHint={audioMeta?.duration_seconds ?? null}
                    onComplete={
                      canAutoComplete
                        ? () => {
                            markModuleRead(userId!, slug, true)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ["progress", userId] }),
                              )
                              .catch(() => {});
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}

        <article
          className={`space-y-7 text-[1.075rem] leading-[1.75] text-black/75 ${
            mode === "listen" && hasAudio ? "mt-10" : "mt-14"
          }`}
          hidden={mode === "listen" && hasAudio && isPaid}
        >
          {showIntro && (
            <p className="text-[1.35rem] leading-[1.55] text-black/85 tracking-[-0.005em]">
              {mod.intro}
            </p>
          )}
          {visibleParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {mod.quote && !truncated && (
            <blockquote className="border-l-2 border-[color:var(--accent)]/60 pl-6 text-black/70">
              {mod.quote}
            </blockquote>
          )}
        </article>

        {truncated && (
          <div className="mt-14">
            <AccessGate variant="chapter" />
          </div>
        )}

        {!truncated && isPaid && (
          <div className="mt-14 flex justify-end">
            <button
              onClick={() => markComplete.mutate()}
              className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-[11px] uppercase tracking-[0.24em] text-black transition hover:brightness-110"
            >
              {markComplete.isPending ? "Salvando…" : "Marcar como concluído"}
            </button>
          </div>
        )}

        {/* Navegação prev/next em cards minimalistas */}
        <nav className="mt-20 grid grid-cols-1 gap-3 border-t border-black/[0.08] pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              to="/modulo/$slug"
              params={{ slug: prev.slug }}
              className="group rounded-2xl border border-black/[0.08] bg-black/[0.02] p-5 transition hover:border-black/15 hover:bg-black/[0.04]"
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                ← Anterior · {String(prev.number).padStart(2, "0")}
              </div>
              <div className="mt-2 text-black/80 group-hover:text-black">{prev.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to="/modulo/$slug"
              params={{ slug: next.slug }}
              className="group rounded-2xl border border-black/[0.08] bg-black/[0.02] p-5 text-right transition hover:border-black/15 hover:bg-black/[0.04]"
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Próximo · {String(next.number).padStart(2, "0")} →
              </div>
              <div className="mt-2 text-black/80 group-hover:text-black">{next.title}</div>
            </Link>
          ) : (
            <Link
              to="/app"
              className="group rounded-2xl border border-black/[0.08] bg-black/[0.02] p-5 text-right transition hover:border-black/15 hover:bg-black/[0.04]"
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Voltar ao painel →
              </div>
              <div className="mt-2 text-black/80 group-hover:text-black">Início iMAG</div>
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
