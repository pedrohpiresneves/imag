import { useEffect } from "react";
import { Pause, Play, Rewind, FastForward, Volume2, VolumeX } from "lucide-react";
import { useCastPlayer, formatTime, SPEEDS } from "@/lib/podcast/player-context";

type Props = {
  slug: string;
  title: string;
  subtitle?: string;
  durationHint?: number | null;
  onComplete?: () => void;
};

/**
 * Full-size MAGcast player. Mounted inside a chapter page's "Ouvir" tab.
 * Delegates all playback to the global provider so audio survives navigation
 * and the mini player can take over when this panel unmounts.
 */
export function CastExpandedPlayer({ slug, title, subtitle, durationHint, onComplete }: Props) {
  const p = useCastPlayer();
  const isActive = p.track?.slug === slug;

  // Suppress mini-player while this expanded panel is on screen for the active track.
  useEffect(() => {
    if (isActive) {
      p.setExpanded(true);
      return () => p.setExpanded(false);
    }
  }, [isActive, p]);

  // Fire onComplete once when track finishes for this slug.
  useEffect(() => {
    if (!isActive || !onComplete) return;
    if (p.duration > 0 && p.current / p.duration >= 0.98) onComplete();
  }, [isActive, p.current, p.duration, onComplete]);

  const start = () => p.play({ slug, title, subtitle, durationHint });

  if (!isActive) {
    return (
      <div
        className="rounded-[20px] p-6 sm:p-7"
        style={{ background: "#FFFFFF", border: "1px solid var(--hair, #ECEBE5)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[color:var(--text-muted)]">
          MAGcast
        </p>
        <h3 className="mt-3 text-[18px] font-medium leading-snug text-[#0A0A0A]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] font-light text-[color:var(--text-muted)]">
            {subtitle}
          </p>
        )}
        <button
          type="button"
          onClick={start}
          disabled={p.loading}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[12px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {p.loading ? "Preparando…" : "Ouvir capítulo"}
        </button>
        {p.error && (
          <p className="mt-3 text-[12px] text-red-600">{p.error}</p>
        )}
      </div>
    );
  }

  const pct = p.duration > 0 ? (p.current / p.duration) * 100 : 0;

  return (
    <div
      className="rounded-[20px] p-6 sm:p-7"
      style={{ background: "#FFFFFF", border: "1px solid var(--hair, #ECEBE5)" }}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[color:var(--text-muted)]">
          MAGcast · em reprodução
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[color:var(--text-muted)]">
          {p.duration > 0 ? `${formatTime(p.duration)}` : "…"}
        </span>
      </div>

      <h3 className="mt-3 text-[18px] font-medium leading-snug text-[#0A0A0A]">
        {title}
      </h3>

      <div className="mt-6">
        <input
          type="range"
          min={0}
          max={p.duration || 0}
          step={0.1}
          value={p.current}
          onChange={(e) => p.seek(Number(e.target.value))}
          aria-label="Progresso"
          className="podcast-range h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, #C6A15B 0%, #C6A15B ${pct}%, rgba(15,23,42,0.08) ${pct}%, rgba(15,23,42,0.08) 100%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
          <span>{formatTime(p.current)}</span>
          <span>{formatTime(p.duration)}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => p.seekBy(-15)}
          aria-label="Retroceder 15 segundos"
          className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04]"
        >
          <Rewind className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={p.toggle}
          aria-label={p.playing ? "Pausar" : "Reproduzir"}
          className="grid h-12 w-12 place-items-center rounded-full bg-black text-white transition hover:opacity-90"
        >
          {p.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => p.seekBy(15)}
          aria-label="Avançar 15 segundos"
          className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04]"
        >
          <FastForward className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => p.setVolume(p.volume > 0 ? 0 : 1)}
            aria-label={p.volume > 0 ? "Silenciar" : "Ativar som"}
            className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-black/[0.04]"
          >
            {p.volume > 0 ? <Volume2 className="h-4 w-4" strokeWidth={1.6} /> : <VolumeX className="h-4 w-4" strokeWidth={1.6} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={p.volume}
            onChange={(e) => p.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="podcast-range h-1 w-24 cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, #0A0A0A 0%, #0A0A0A ${p.volume * 100}%, rgba(15,23,42,0.08) ${p.volume * 100}%, rgba(15,23,42,0.08) 100%)`,
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => p.setRate(s)}
              aria-pressed={p.rate === s}
              className={`rounded-full px-2 py-1 text-[11px] font-mono tracking-wide transition ${
                p.rate === s
                  ? "bg-black text-white"
                  : "text-[color:var(--text-muted)] hover:text-black"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}