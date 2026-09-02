import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  storageKey: string; // e.g. "am:audio:module:principios-do-magnetismo"
  title: string;
  subtitle?: string;
  onComplete?: () => void;
  durationLabel?: string;
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const COMPLETE_THRESHOLD = 0.98;

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PodcastPlayer({
  src,
  storageKey,
  title,
  subtitle,
  onComplete,
  durationLabel,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [ready, setReady] = useState(false);
  const completedRef = useRef(false);

  // Restore saved position + rate
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { t?: number; r?: number; done?: boolean };
        if (parsed.done) completedRef.current = true;
        if (typeof parsed.r === "number" && SPEEDS.includes(parsed.r as (typeof SPEEDS)[number])) {
          setRate(parsed.r);
        }
        if (typeof parsed.t === "number" && audioRef.current) {
          const applyTime = () => {
            if (audioRef.current && parsed.t! < (audioRef.current.duration || Infinity) - 1) {
              audioRef.current.currentTime = parsed.t!;
              setCurrent(parsed.t!);
            }
          };
          if (audioRef.current.readyState >= 1) applyTime();
          else audioRef.current.addEventListener("loadedmetadata", applyTime, { once: true });
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist position (throttled by event cadence)
  const persist = useCallback(
    (t: number, r: number, done = false) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ t, r, done }));
      } catch {}
    },
    [storageKey],
  );

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = rate;
  }, [rate]);

  // Media Session for background/lockscreen controls
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new window.MediaMetadata({
      title,
      artist: "Agenda Magnética",
      album: subtitle ?? "MAGCast",
    });
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => void audioRef.current?.play()],
      ["pause", () => audioRef.current?.pause()],
      ["seekbackward", () => seekBy(-15)],
      ["seekforward", () => seekBy(15)],
      [
        "seekto",
        (details) => {
          if (audioRef.current && typeof details.seekTime === "number") {
            audioRef.current.currentTime = details.seekTime;
          }
        },
      ],
    ];
    handlers.forEach(([a, h]) => {
      try {
        ms.setActionHandler(a, h);
      } catch {}
    });
    return () => {
      handlers.forEach(([a]) => {
        try {
          ms.setActionHandler(a, null);
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  const seekBy = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    const next = Math.max(0, Math.min((a.duration || 0), a.currentTime + delta));
    a.currentTime = next;
    setCurrent(next);
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  const onSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    setCurrent(t);
  };

  const progressPct = useMemo(
    () => (duration > 0 ? (current / duration) * 100 : 0),
    [current, duration],
  );

  return (
    <section
      aria-label="MAGCast"
      className="rounded-lg border border-[color:var(--accent)]/40 bg-black/90 p-4 text-white shadow-[0_10px_40px_-20px_rgba(212,175,55,0.6)] sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">🎧</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--accent)]">
            MAGCast
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          {durationLabel ?? (duration > 0 ? `≈ ${formatTime(duration)}` : "carregando…")}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => seekBy(-15)}
          aria-label="Retroceder 15 segundos"
          className="rounded-full border border-white/15 px-2.5 py-2 text-xs text-white/80 transition hover:border-[color:var(--accent)]/60 hover:text-white"
        >
          −15s
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar" : "Reproduzir"}
          disabled={!ready}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-black transition hover:bg-[color:var(--accent-soft)] disabled:opacity-50 sm:h-12 sm:w-12"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => seekBy(15)}
          aria-label="Avançar 15 segundos"
          className="rounded-full border border-white/15 px-2.5 py-2 text-xs text-white/80 transition hover:border-[color:var(--accent)]/60 hover:text-white"
        >
          +15s
        </button>

        <div className="flex flex-1 items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={onSeekInput}
            aria-label="Progresso do áudio"
            className="podcast-range h-1 flex-1 cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progressPct}%, rgba(255,255,255,0.15) ${progressPct}%, rgba(255,255,255,0.15) 100%)`,
            }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/60">
        <span>{formatTime(current)}</span>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setRate(s);
                persist(current, s, completedRef.current);
              }}
              className={`rounded px-1.5 py-0.5 transition ${
                rate === s
                  ? "bg-[color:var(--accent)] text-black"
                  : "text-white/60 hover:text-white"
              }`}
              aria-label={`Velocidade ${s}x`}
              aria-pressed={rate === s}
            >
              {s}x
            </button>
          ))}
        </div>
        <span>{formatTime(duration)}</span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          setDuration(a.duration || 0);
          a.playbackRate = rate;
          setReady(true);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          // persist every ~2s of audio
          if (Math.floor(a.currentTime) % 2 === 0) {
            persist(a.currentTime, rate, completedRef.current);
          }
          if (
            !completedRef.current &&
            a.duration > 0 &&
            a.currentTime / a.duration >= COMPLETE_THRESHOLD
          ) {
            completedRef.current = true;
            persist(a.currentTime, rate, true);
            onComplete?.();
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          if (audioRef.current) persist(audioRef.current.currentTime, rate, completedRef.current);
        }}
        onEnded={() => {
          setPlaying(false);
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          persist(audioRef.current?.currentTime ?? 0, rate, true);
        }}
      />
    </section>
  );
}
