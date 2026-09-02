import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowRight, Check, Download, Share2, Sparkles } from "lucide-react";
import {
  getWeeklyRecap,
  completeWeeklyRecap,
  saveWeeklyRecalibration,
  FOCUS_OPTIONS,
  type WeeklyRecap as Recap,
} from "@/lib/weekly-recap.functions";
import { drawWeeklyCard } from "@/lib/share-cards/weekly-card";

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

const DAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function useWeeklyRecap(enabled: boolean) {
  return useQuery({
    queryKey: ["weekly-recap"],
    queryFn: () => getWeeklyRecap(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Convite discreto exibido aos domingos, enquanto o resumo não foi concluído. */
export function WeeklyRecapPrompt({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
      className="w-full rounded-[22px] px-5 py-5 text-left"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 1px 2px rgba(10,10,10,0.03), 0 24px 48px -34px rgba(51, 92, 255,0.16)",
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
        style={{ background: "#EEF2FF", color: BLUE }}
      >
        <Sparkles className="h-3 w-3" strokeWidth={1.8} />
        Domingo
      </span>
      <p className="mt-3 text-[19px] font-semibold leading-[1.2]" style={{ ...DISPLAY, color: INK }}>
        Seu resumo semanal está pronto.
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
        Veja o que suas direções movimentaram esta semana.
      </p>
      <span
        className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium"
        style={{ color: BLUE }}
      >
        Ver meu resumo <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
      </span>
    </motion.button>
  );
}

type Props = { recap: Recap; onClose: () => void };

export function WeeklyRecapStories({ recap, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [adjusting, setAdjusting] = useState(false);
  const [focuses, setFocuses] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const slides = useMemo(() => buildSlides(recap), [recap]);
  const total = slides.length;
  const isRecalibration = step === total - 2;
  const isFinal = step === total - 1;
  const autoAdvance = step < total - 2;

  // Duração automática por tela (telas densas ganham mais tempo)
  const durations = useMemo(
    () =>
      slides.map((s) => {
        const key = String((s as { key?: string })?.key ?? "");
        return key === "field" || key === "reading" ? 8600 : 5200;
      }),
    [slides],
  );
  const duration = durations[step] ?? 5200;

  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("imag_recap_hint_seen")) {
      setHint(true);
      window.localStorage.setItem("imag_recap_hint_seen", "1");
      const t = setTimeout(() => setHint(false), 4200);
      return () => clearTimeout(t);
    }
  }, []);

  const complete = useMutation({
    mutationFn: () => completeWeeklyRecap({ data: { weekKey: recap.weekKey } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-recap"] }),
  });
  const recalibrate = useMutation({
    mutationFn: (input: { keep: boolean; focuses: string[] }) =>
      saveWeeklyRecalibration({ data: input }),
  });

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, total - 1));
  }, [total]);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Progresso com rAF — pausa e retoma exatamente de onde parou
  useEffect(() => {
    setProgress(0);
    if (!autoAdvance) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) elapsed += dt;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p >= 1) {
        next();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoAdvance, next, step, duration]);

  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Toque: rápido navega, segurar pausa
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  const onPointerDown = useCallback(() => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, 220);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (heldRef.current) {
        heldRef.current = false;
        setPaused(false);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width * 0.33) prev();
      else next();
    },
    [next, prev],
  );

  const onPointerCancel = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    heldRef.current = false;
    setPaused(false);
  }, []);

  useEffect(() => {
    if (isFinal && !complete.isPending && !complete.isSuccess) complete.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  function toggleFocus(label: string) {
    setFocuses((f) =>
      f.includes(label) ? f.filter((x) => x !== label) : f.length >= 2 ? f : [...f, label],
    );
  }

  const body = (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#FFFFFF" }}>
      {/* Barra de progresso */}
      <div className="flex gap-1.5 px-4 pt-[max(14px,env(safe-area-inset-top))]">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: HAIRLINE }}>
            <div
              className="h-full rounded-full"
              style={{
                background: BLUE,
                width:
                  i < step
                    ? "100%"
                    : i === step
                      ? autoAdvance
                        ? `${progress * 100}%`
                        : "100%"
                      : "0%",
                transition: i === step && autoAdvance ? "none" : "width 0.25s linear",
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar resumo"
        className="absolute right-3 top-[max(30px,calc(env(safe-area-inset-top)+22px))] z-20 grid h-9 w-9 place-items-center rounded-full"
        style={{ background: "#F5F5F3", color: INK }}
      >
        <X className="h-4 w-4" strokeWidth={1.9} />
      </button>

      {/* Zonas de toque */}
      {!isRecalibration && !isFinal && (
        <div
          className="absolute bottom-0 left-0 right-0 top-16 z-10 select-none"
          style={{ touchAction: "manipulation" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="pointer-events-none absolute inset-x-0 bottom-[max(26px,env(safe-area-inset-bottom))] z-20 flex justify-center px-6"
          >
            <span
              className="rounded-full px-3.5 py-2 text-[12px] font-medium"
              style={{ background: "#F5F5F3", color: MUTED, border: `1px solid ${HAIRLINE}` }}
            >
              Toque para avançar · Segure para pausar
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-7 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: easeOut }}
            className="mx-auto w-full max-w-[440px]"
          >
            {isRecalibration ? (
              <Recalibration
                goal={recap.goal}
                adjusting={adjusting}
                focuses={focuses}
                onKeep={() => {
                  recalibrate.mutate({ keep: true, focuses: [] });
                  next();
                }}
                onAdjust={() => setAdjusting(true)}
                onToggle={toggleFocus}
                onConfirm={() => {
                  recalibrate.mutate({ keep: false, focuses });
                  next();
                }}
              />
            ) : isFinal ? (
              <FinalCard recap={recap} onClose={onClose} saved={saved} setSaved={setSaved} />
            ) : (
              slides[step]
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

// ─── Slides ──────────────────────────────────────────────────────────
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[30px] font-semibold leading-[1.14] sm:text-[34px]"
      style={{ ...DISPLAY, color: INK }}
    >
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] uppercase tracking-[0.16em]" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function buildSlides(r: Recap): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  slides.push(
    <div key="mov">
      <Label>Movimento</Label>
      <Title>
        Você esteve em movimento por{" "}
        <span style={{ color: BLUE }}>
          {r.activeDays} {r.activeDays === 1 ? "dia" : "dias"}
        </span>{" "}
        esta semana.
      </Title>
      <div className="mt-8 flex gap-2.5">
        {r.dayFlags.map((on, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12 + i * 0.07, duration: 0.4, ease: easeOut }}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className="h-14 w-full rounded-[12px]"
              style={{ background: on ? BLUE : "#F4F4F2", opacity: on ? 1 : 1 }}
            />
            <span className="text-[11px]" style={{ color: on ? INK : MUTED }}>
              {DAYS[i]}
            </span>
          </motion.div>
        ))}
      </div>
    </div>,
  );

  slides.push(
    <div key="exec">
      <Label>Execução</Label>
      <Title>
        Você recebeu{" "}
        <span style={{ color: BLUE }}>
          {r.received} {r.received === 1 ? "direção" : "direções"}
        </span>{" "}
        esta semana.
      </Title>
      <div className="mt-8 space-y-3">
        <Row label="Direções recebidas" value={String(r.received)} />
        <Row label="Executadas" value={String(r.executed)} />
        <Row label="Execução" value={`${r.executionPct}%`} accent />
      </div>
    </div>,
  );

  slides.push(
    <div key="imp">
      <Label>Impacto</Label>
      <Title>
        {r.impacts.length > 0 ? (
          <>
            <span style={{ color: BLUE }}>
              {r.impacts.length} {r.impacts.length === 1 ? "direção sua" : "das suas direções"}
            </span>{" "}
            {r.impacts.length === 1 ? "gerou" : "geraram"} impacto.
          </>
        ) : (
          <>Nenhum impacto registrado ainda esta semana.</>
        )}
      </Title>
      <div className="mt-7 space-y-3">
        {r.impacts.map((i, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + idx * 0.1, duration: 0.4, ease: easeOut }}
            className="rounded-[16px] px-4 py-3.5"
            style={{ border: `1px solid ${HAIRLINE}` }}
          >
            <p className="text-[15px] leading-[1.45]" style={{ color: INK }}>
              {i.text}
            </p>
            {i.direction && (
              <p className="mt-1 text-[12.5px]" style={{ color: MUTED }}>
                {i.direction}
              </p>
            )}
          </motion.div>
        ))}
        {r.impacts.length === 0 && (
          <p className="text-[14.5px] leading-[1.5]" style={{ color: MUTED }}>
            Registrar o resultado das suas direções é o que transforma execução em prova.
          </p>
        )}
      </div>
    </div>,
  );

  slides.push(
    <div key="main">
      <Label>Principal movimento</Label>
      <Title>
        Seu principal movimento foi:{" "}
        <span style={{ color: BLUE }}>{r.mainMovement ?? "ainda em formação"}</span>.
      </Title>
      <p className="mt-5 text-[15px] leading-[1.55]" style={{ color: MUTED }}>
        {r.mainMovement
          ? "A MAG identificou esse foco a partir das direções que você executou nos últimos 7 dias."
          : "Com mais direções executadas, a MAG identifica automaticamente seu foco predominante."}
      </p>
    </div>,
  );

  slides.push(<FieldSlide key="field" r={r} />);

  slides.push(
    <div key="reading">
      <Label>Leitura da MAG</Label>
      <div className="space-y-4">
        {(r.reading.length ? r.reading : ["Sua semana ainda não tem dados suficientes para uma leitura precisa."]).map(
          (p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.15, duration: 0.5, ease: easeOut }}
              className="text-[18px] leading-[1.5]"
              style={{ color: i === 0 ? INK : MUTED }}
            >
              {p}
            </motion.p>
          ),
        )}
      </div>
    </div>,
  );

  // Placeholders: recalibração e card final são renderizados pelo container.
  slides.push(null);
  slides.push(null);
  return slides;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center justify-between rounded-[16px] px-4 py-3.5"
      style={{ border: `1px solid ${HAIRLINE}` }}
    >
      <span className="text-[14.5px]" style={{ color: MUTED }}>
        {label}
      </span>
      <span
        className="text-[19px] font-semibold"
        style={{ ...DISPLAY, color: accent ? BLUE : INK }}
      >
        {value}
      </span>
    </div>
  );
}

function FieldSlide({ r }: { r: Recap }) {
  const f = r.field;
  const rings = [
    { key: "magnetism", label: "Impacto", radius: 96, width: 11, alpha: 1 },
    { key: "authority", label: "Execução", radius: 76, width: 10, alpha: 0.75 },
    { key: "consistency", label: "Consistência", radius: 57, width: 9, alpha: 0.55 },
    { key: "focus", label: "Foco", radius: 39, width: 8, alpha: 0.35 },
  ] as const;
  return (
    <div>
      <Label>Campo Magnético</Label>
      <Title>
        {r.deltaPct != null ? (
          <>
            Seu campo{" "}
            <span style={{ color: BLUE }}>
              {r.deltaPct >= 0 ? "+" : ""}
              {r.deltaPct}% {r.deltaPct >= 0 ? "↑" : "↓"}
            </span>{" "}
            esta semana.
          </>
        ) : (
          <>Seu Campo Magnético está se formando.</>
        )}
      </Title>

      <div className="mt-8 flex justify-center">
        <svg width="224" height="224" viewBox="0 0 224 224">
          {rings.map((ring, i) => {
            const value = f ? (f[ring.key] as number) : 0;
            const c = 2 * Math.PI * ring.radius;
            return (
              <g key={ring.key} transform="rotate(-90 112 112)">
                <circle
                  cx="112"
                  cy="112"
                  r={ring.radius}
                  fill="none"
                  stroke={HAIRLINE}
                  strokeWidth={ring.width}
                />
                <motion.circle
                  cx="112"
                  cy="112"
                  r={ring.radius}
                  fill="none"
                  stroke={BLUE}
                  strokeOpacity={ring.alpha}
                  strokeWidth={ring.width}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: c - (c * Math.max(2, value)) / 100 }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: easeOut }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-7 space-y-2">
        {rings.map((ring) => (
          <div key={ring.key} className="flex items-center justify-between">
            <span className="text-[13.5px]" style={{ color: MUTED }}>
              {ring.label}
            </span>
            <span className="text-[13.5px]" style={{ color: INK }}>
              {f ? Math.round(f[ring.key] as number) : "—"}
              {r.prevField && f ? (
                <span style={{ color: MUTED }}>
                  {" "}
                  · semana passada {Math.round(r.prevField[ring.key] as number)}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Recalibration({
  goal,
  adjusting,
  focuses,
  onKeep,
  onAdjust,
  onToggle,
  onConfirm,
}: {
  goal: string | null;
  adjusting: boolean;
  focuses: string[];
  onKeep: () => void;
  onAdjust: () => void;
  onToggle: (label: string) => void;
  onConfirm: () => void;
}) {
  if (adjusting) {
    return (
      <div>
        <Label>Recalibração</Label>
        <Title>O que merece mais atenção agora?</Title>
        <p className="mt-2 text-[13.5px]" style={{ color: MUTED }}>
          Escolha até 2.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((opt) => {
            const on = focuses.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className="rounded-full px-4 py-2.5 text-[14px] font-medium transition"
                style={{
                  background: on ? BLUE : "#FFFFFF",
                  color: on ? "#FFFFFF" : INK,
                  border: `1px solid ${on ? BLUE : HAIRLINE}`,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={focuses.length === 0}
          className="mt-8 w-full rounded-full px-5 py-3.5 text-[15px] font-medium transition disabled:opacity-40"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          Confirmar novo foco
        </button>
      </div>
    );
  }
  return (
    <div>
      <Label>Recalibração</Label>
      <Title>Antes de começarmos uma nova semana:</Title>
      <p className="mt-4 text-[18px] leading-[1.45]" style={{ color: MUTED }}>
        Seu objetivo continua sendo{" "}
        <span style={{ color: BLUE }}>{goal ?? "crescer profissionalmente"}</span>?
      </p>
      <div className="mt-8 space-y-2.5">
        <button
          type="button"
          onClick={onKeep}
          className="w-full rounded-full px-5 py-3.5 text-[15px] font-medium"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          Sim, continuar
        </button>
        <button
          type="button"
          onClick={onAdjust}
          className="w-full rounded-full px-5 py-3.5 text-[15px] font-medium"
          style={{ background: "#FFFFFF", color: INK, border: `1px solid ${HAIRLINE}` }}
        >
          Quero ajustar
        </button>
      </div>
    </div>
  );
}

function FinalCard({
  recap,
  onClose,
  saved,
  setSaved,
}: {
  recap: Recap;
  onClose: () => void;
  saved: boolean;
  setSaved: (v: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const data = useMemo(
    () => ({
      received: recap.received,
      executed: recap.executed,
      impacts: recap.impacts.length,
      activeDays: recap.activeDays,
      mainMovement: recap.mainMovement,
      deltaPct: recap.deltaPct,
      field: recap.field
        ? {
            focus: recap.field.focus,
            consistency: recap.field.consistency,
            authority: recap.field.authority,
            magnetism: recap.field.magnetism,
          }
        : null,
    }),
    [recap],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await drawWeeklyCard(canvas, data);
      if (alive) setPreview(canvas.toDataURL("image/png"));
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [data]);

  async function toBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    await drawWeeklyCard(canvas, data);
    return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "minha-semana-imag.png";
        a.click();
        URL.revokeObjectURL(url);
        setSaved(true);
      }
    } catch {}
    setBusy(false);
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (blob) {
        const file = new File([blob], "minha-semana-imag.png", { type: "image/png" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({
            files: [file],
            title: "Minha semana na iMAG",
            text: "Menos ruído. Mais direção. imag.net.br",
          });
        } else {
          await save();
        }
      }
    } catch {}
    setBusy(false);
  }

  return (
    <div>
      <Label>Minha semana na iMAG</Label>
      {preview ? (
        <img
          src={preview}
          alt="Card do resumo semanal da iMAG"
          className="mx-auto w-full max-w-[280px] rounded-[18px]"
          style={{ border: `1px solid ${HAIRLINE}` }}
        />
      ) : (
        <div
          className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-[18px]"
          style={{ border: `1px solid ${HAIRLINE}` }}
        />
      )}

      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          onClick={share}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-medium disabled:opacity-50"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          <Share2 className="h-4 w-4" strokeWidth={1.8} /> Compartilhar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-medium disabled:opacity-50"
          style={{ background: "#FFFFFF", color: INK, border: `1px solid ${HAIRLINE}` }}
        >
          {saved ? <Check className="h-4 w-4" strokeWidth={2} /> : <Download className="h-4 w-4" strokeWidth={1.8} />}
          Salvar imagem
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-[14px]"
          style={{ color: MUTED }}
        >
          Fechar
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}