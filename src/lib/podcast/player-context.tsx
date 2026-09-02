import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getModuleAudioSignedUrl } from "@/lib/podcast/podcast.functions";

type Track = {
  slug: string;
  title: string;
  subtitle?: string;
  durationHint?: number | null;
};

type PlayerState = {
  track: Track | null;
  url: string | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  current: number;
  duration: number;
  rate: number;
  volume: number;
  expanded: boolean; // true when the page hosts its own big player — hide mini
};

type PlayerApi = PlayerState & {
  play: (t: Track) => Promise<void>;
  toggle: () => void;
  seek: (t: number) => void;
  seekBy: (delta: number) => void;
  setRate: (r: number) => void;
  setVolume: (v: number) => void;
  close: () => void;
  setExpanded: (v: boolean) => void;
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const COMPLETE_THRESHOLD = 0.98;

const Ctx = createContext<PlayerApi | null>(null);

function storageKey(slug: string) {
  return `am:audio:module:${slug}`;
}

function readSaved(slug: string): { t?: number; r?: number; v?: number; done?: boolean } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveState(slug: string, data: { t: number; r: number; v: number; done: boolean }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(data));
  } catch {}
}

export function PodcastPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const completedRef = useRef(false);
  const persistAccumRef = useRef(0);

  const play = useCallback(async (t: Track) => {
    // Same track — just resume.
    if (track?.slug === t.slug && url) {
      const a = audioRef.current;
      if (a && a.paused) void a.play();
      return;
    }
    setLoading(true);
    setError(null);
    setTrack(t);
    setUrl(null);
    setCurrent(0);
    setDuration(t.durationHint ?? 0);
    completedRef.current = false;

    try {
      const signed = await getModuleAudioSignedUrl({ data: { module_slug: t.slug } });
      const saved = readSaved(t.slug);
      if (typeof saved.r === "number" && SPEEDS.includes(saved.r as (typeof SPEEDS)[number])) {
        setRateState(saved.r);
      }
      if (typeof saved.v === "number") setVolumeState(saved.v);
      if (saved.done) completedRef.current = true;
      setUrl(signed.url);
      // Autoplay after src assignment; browsers allow because caller was a user gesture.
      requestAnimationFrame(() => {
        const a = audioRef.current;
        if (!a) return;
        const resume = typeof saved.t === "number" ? saved.t : 0;
        const start = () => {
          if (resume > 0 && resume < (a.duration || Infinity) - 1) {
            a.currentTime = resume;
          }
          void a.play().catch(() => {});
        };
        if (a.readyState >= 1) start();
        else a.addEventListener("loadedmetadata", start, { once: true });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o áudio.");
    } finally {
      setLoading(false);
    }
  }, [track, url]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, t));
    setCurrent(a.currentTime);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
    setCurrent(a.currentTime);
  }, []);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPlaying(false);
    setTrack(null);
    setUrl(null);
    setCurrent(0);
    setDuration(0);
  }, []);

  // Apply rate/volume when audio element mounts / url changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = rate;
    a.volume = volume;
  }, [url, rate, volume]);

  // Media Session (lockscreen / bluetooth)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new window.MediaMetadata({
        title: track.title,
        artist: "iMAG · MAGcast",
        album: track.subtitle ?? "MAGcast",
      });
    } catch {}
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => void audioRef.current?.play()],
      ["pause", () => audioRef.current?.pause()],
      ["seekbackward", () => seekBy(-15)],
      ["seekforward", () => seekBy(15)],
      ["seekto", (d) => { if (typeof d.seekTime === "number") seek(d.seekTime); }],
    ];
    handlers.forEach(([a, h]) => { try { ms.setActionHandler(a, h); } catch {} });
    return () => {
      handlers.forEach(([a]) => { try { ms.setActionHandler(a, null); } catch {} });
    };
  }, [track, seek, seekBy]);

  const api = useMemo<PlayerApi>(() => ({
    track, url, loading, error, playing, current, duration, rate, volume, expanded,
    play, toggle, seek, seekBy, setRate, setVolume, close, setExpanded,
  }), [track, url, loading, error, playing, current, duration, rate, volume, expanded,
      play, toggle, seek, seekBy, setRate, setVolume, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Single global audio element — persists across route changes */}
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          setDuration(a.duration || 0);
          a.playbackRate = rate;
          a.volume = volume;
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          persistAccumRef.current += 1;
          if (track && persistAccumRef.current >= 8) {
            persistAccumRef.current = 0;
            saveState(track.slug, { t: a.currentTime, r: rate, v: volume, done: completedRef.current });
          }
          if (!completedRef.current && a.duration > 0 && a.currentTime / a.duration >= COMPLETE_THRESHOLD) {
            completedRef.current = true;
            if (track) saveState(track.slug, { t: a.currentTime, r: rate, v: volume, done: true });
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          const a = audioRef.current;
          if (track && a) saveState(track.slug, { t: a.currentTime, r: rate, v: volume, done: completedRef.current });
        }}
        onEnded={() => {
          setPlaying(false);
          if (track) saveState(track.slug, { t: duration, r: rate, v: volume, done: true });
        }}
      />
    </Ctx.Provider>
  );
}

export function useCastPlayer(): PlayerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCastPlayer must be used inside PodcastPlayerProvider");
  return c;
}

export { SPEEDS };

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}