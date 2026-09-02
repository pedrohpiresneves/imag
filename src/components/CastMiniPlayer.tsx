import { Pause, Play, Rewind, FastForward, X, Volume2, VolumeX } from "lucide-react";
import { useCastPlayer, formatTime } from "@/lib/podcast/player-context";

export function CastMiniPlayer() {
  const p = useCastPlayer();
  if (!p.track || p.expanded) return null;

  const pct = p.duration > 0 ? (p.current / p.duration) * 100 : 0;

  return (
    <div
      role="region"
      aria-label="MAGcast em reprodução"
      className="fixed inset-x-0 z-[60]"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 66px)",
        pointerEvents: "none",
      }}
    >
      <div
        className="mx-auto max-w-[640px] px-3 sm:px-4"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className="rounded-[18px] px-3 py-2.5 sm:px-4"
          style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            border: "1px solid var(--hair, #ECEBE5)",
            boxShadow: "0 12px 32px -20px rgba(15,23,42,0.25)",
          }}
        >
          {/* progress line */}
          <div
            className="mb-2 h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: "rgba(15,23,42,0.08)" }}
          >
            <div
              className="h-full transition-[width] duration-150"
              style={{ width: `${pct}%`, background: "#C6A15B" }}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => p.seekBy(-15)}
              aria-label="Retroceder 15 segundos"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04] sm:flex"
            >
              <Rewind className="h-4 w-4" strokeWidth={1.6} />
            </button>

            <button
              type="button"
              onClick={p.toggle}
              aria-label={p.playing ? "Pausar" : "Reproduzir"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white transition hover:opacity-90"
            >
              {p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => p.seekBy(15)}
              aria-label="Avançar 15 segundos"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04] sm:flex"
            >
              <FastForward className="h-4 w-4" strokeWidth={1.6} />
            </button>

            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[13px] font-medium leading-tight"
                style={{ color: "#0A0A0A" }}
              >
                {p.track.title}
              </p>
              <p className="mt-0.5 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                MAGcast · {formatTime(p.current)} / {formatTime(p.duration)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => p.setVolume(p.volume > 0 ? 0 : 1)}
              aria-label={p.volume > 0 ? "Silenciar" : "Ativar som"}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04] md:flex"
            >
              {p.volume > 0 ? <Volume2 className="h-4 w-4" strokeWidth={1.6} /> : <VolumeX className="h-4 w-4" strokeWidth={1.6} />}
            </button>

            <button
              type="button"
              onClick={p.close}
              aria-label="Fechar player"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04]"
            >
              <X className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}