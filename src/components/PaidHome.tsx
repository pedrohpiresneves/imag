import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleDot, AlertCircle, Check, Loader2, Send } from "lucide-react";
import { HomeTopBar } from "@/components/home/HomeTopBar";
import { OPEN_DIRECTION_EVENT } from "@/components/home/HomeShortcuts";
import { MagHub } from "@/components/home/MagHub";


import {
  
  MagBubble,
  MagFull,
  MAG_PHRASES,
  magPhrase,
  useMagSpeech,
} from "@/components/mag/MagMascot";
import { DayPanel } from "@/components/home/DayPanel";
import { DayAiSheet } from "@/components/home/DayAiSheet";
import { useDayContext } from "@/components/home/use-day-context";
import { BottomNav } from "@/components/BottomNav";
import { MODULES } from "@/lib/modules";
import { getTodayMeta } from "@/lib/plans.functions";
import { HomeNoticeBar } from "@/components/HomeNoticeBar";
import { useAccess } from "@/lib/use-access";
import { getTodayReflection, submitReflection, type Reflection } from "@/lib/reflections.functions";
import { track } from "@/lib/analytics";
import { MetaFeedback } from "@/components/MetaFeedback";
import { DirectionConfidence } from "@/components/DirectionConfidence";
import { useServerFn } from "@tanstack/react-start";
import { listReceivedDirections } from "@/lib/shared-directions.functions";
import { listGoalHistory } from "@/lib/goal-history.functions";
import { ShareDirectionModal } from "@/components/ShareDirectionModal";
import { type ClosureKey } from "@/lib/mag/continuity";
import { haptic } from "@/lib/haptics";

// NOTE: MAGcast temporariamente removido do fluxo da MAG Meta.
// A infraestrutura (player-context, bucket, admin, módulos) permanece intacta
// para retomada futura sem alterações estruturais.

const easeOut = [0.22, 1, 0.36, 1] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const GOLD = "#C6A15B";
const BLUE = "#335CFF";
const BLUE_IMAG = "#335CFF";
const HAIRLINE_SOFT = "#ECECEF";

/** Extrai a mensagem real retornada pelo backend (server fn / Supabase). */
function errorMessage(err: unknown): string {
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  const anyErr = err as { message?: string; body?: { message?: string }; error?: string };
  return anyErr.body?.message ?? anyErr.message ?? anyErr.error ?? JSON.stringify(err).slice(0, 300);
}

type PaidHomeProps = {
  firstName: string;
  nextChapter: (typeof MODULES)[number];
  hasStarted: boolean;
  overallProgress: number;
  chaptersDone: number;
  pillarProgress: number;
  pillarsApplied: number;
  preview?: boolean;
};

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Destaca números, minutos/horas, pacientes/clientes e janelas temporais em azul iMAG.
function highlightMeta(text: string): React.ReactNode {
  if (!text) return text;
  const patterns: RegExp[] = [
    /\b\d+\s?(?:minutos?|min|horas?|dias?|semanas?|meses?)\b/gi,
    /\b\d+\s+(?:pacientes?|clientes?|leads?|contatos?|pessoas?|agendamentos?)\b/gi,
    /\b(?:esta|essa|próxima|proxima)\s+(?:semana|manhã|manha|tarde|noite)\b/gi,
    /\b(?:hoje|amanhã|amanha)\b/gi,
    /\b\d+(?:[.,]\d+)?\s?%/g,
    /\bR\$\s?\d[\d.,]*/g,
  ];
  const spans: { start: number; end: number }[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!spans.some((s) => start < s.end && end > s.start)) {
        spans.push({ start, end });
      }
    }
  }
  if (spans.length === 0) return text;
  spans.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    out.push(
      <span key={i} style={{ color: BLUE, fontWeight: 500 }}>
        {text.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

// Extrai "45 min" / "1h" do texto da meta para virar etiqueta.
function extractDuration(text: string): { text: string; duration: string | null } {
  const re = /[\s(,–—-]*\b(?:tempo estimado:?\s*)?(\d{1,3}\s?(?:min(?:utos?)?|h(?:oras?)?))\b[.)]?/i;
  const m = text.match(re);
  if (!m) return { text, duration: null };
  const cleaned = text.replace(re, "").replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
  const d = m[1].replace(/\s+/g, " ").replace(/minutos?/i, "min").replace(/horas?/i, "h");
  return { text: cleaned || text, duration: d };
}

// ─── Componente principal ──────────────────────────────────────────

// Check-in antigo removido: o fechamento da direção agora é conduzido
// exclusivamente pelo bloco conversacional da MAG (MetaFeedback).


export function PaidHome({
  firstName,
  nextChapter,
  preview = false,
}: PaidHomeProps) {
  const navigate = useNavigate();
  const [meta1Dismissed, setMeta1Dismissed] = useState(false);

  // Escopo do cache por usuário: nunca reaproveitar a meta de outra conta.
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Data local do usuário (YYYY-MM-DD no fuso do navegador).
  const localDate = new Date().toLocaleDateString("en-CA");

  // Marca o instante em que essa sessão de /app começou a tentar carregar
  // a meta. Depois de MAX_WAIT_MS sem sucesso, exibimos erro + botão de
  // "Tentar novamente", ao invés de deixar o usuário em loading infinito.
  const [queryStart, setQueryStart] = useState(() => Date.now());
  const [gaveUp, setGaveUp] = useState(false);
  const MAX_WAIT_MS = 30_000;

  // Guarda o motivo técnico real vindo do backend (RLS, acesso pago,
  // env ausente etc.) para exibir na UI e registrar no console.
  const [lastErrorDetail, setLastErrorDetail] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  useEffect(() => {
    const open = () => setOrganizeOpen(true);
    window.addEventListener("imag:open-day-ai", open);
    return () => window.removeEventListener("imag:open-day-ai", open);
  }, []);

  // A direção é gerada automaticamente a partir do contexto do usuário —
  // sem perguntar energia ou tempo disponível.
  const checkinResolved = true;

  /** Erros de autorização nunca devem chegar ao usuário como texto técnico. */
  function isAccessError(message: string) {
    return /forbidden|paid access|unauthorized|401|403/i.test(message);
  }

  async function fetchTodayMeta() {
    try {
      return await getTodayMeta({ data: { local_date: localDate } });
    } catch (err) {
      const message = errorMessage(err);
      console.error("[PaidHome] getTodayMeta falhou:", message, err);
      throw new Error(message);
    }
  }

  const {
    data: plan,
    error: planError,
    refetch: refetchPlan,
    isFetching: planFetching,
  } = useQuery({
    queryKey: ["today-meta", uid, localDate],
    queryFn: fetchTodayMeta,
    enabled: !preview && uid !== null && checkinResolved,
    staleTime: 1000 * 60 * 60, // 1h — a meta é imutável dentro do dia
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 6000),
    // Enquanto não temos meta (e ainda não desistimos), consulta a cada 3s
    // para pegar uma geração que possa estar acontecendo em paralelo
    // (ex.: onboarding concluído em outra aba).
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.first_action || d.priority_title)) return false;
      if (query.state.error) return false;
      if (Date.now() - queryStart > MAX_WAIT_MS) return false;
      return 3000;
    },
  });

  // Registra a causa técnica exata no console/observabilidade e libera o
  // estado de erro na UI após MAX_WAIT_MS.
  useEffect(() => {
    if (plan && (plan.first_action || plan.priority_title)) return;
    if (preview) return;
    if (!checkinResolved) return;
    if (planError) {
      const detail = errorMessage(planError);
      console.error("[PaidHome] getTodayMeta error:", detail, planError);
      // Nunca expõe mensagens técnicas de autorização na interface.
      setLastErrorDetail(
        detail === "trial_expired" || isAccessError(detail) ? null : detail,
      );
      setGaveUp(true);
      return;
    }
    const remaining = MAX_WAIT_MS - (Date.now() - queryStart);
    if (remaining <= 0) {
      setGaveUp(true);
      return;
    }
    const t = setTimeout(() => setGaveUp(true), remaining);
    return () => clearTimeout(t);
  }, [plan, planError, preview, queryStart, checkinResolved]);

  // O relógio de espera da direção só começa depois do check-in.
  useEffect(() => {
    if (checkinResolved) setQueryStart(Date.now());
  }, [checkinResolved]);

  async function retryPlan() {
    setLastErrorDetail(null);
    setGaveUp(false);
    setQueryStart(Date.now());
    try {
      const result = await refetchPlan();
      if (result.error) {
        console.error("[PaidHome] retry retornou erro", result.error);
      }
    } catch (e) {
      console.error("[PaidHome] retry falhou", e);
    }
  }

  const showLoading = !plan && !gaveUp && !preview;
  const showError = !plan && gaveUp && !preview;

  const queryClient = useQueryClient();
  const { data: todayCheckin } = useQuery({
    queryKey: ["today-reflection"],
    queryFn: () => getTodayReflection(),
    enabled: !preview,
  });

  // Estados vivos do card de direção.
  // idle → choosing (duas ações) → running (execução) → completed (recolhe)
  type Phase = "idle" | "choosing" | "running" | "completed";
  const [phase, setPhase] = useState<Phase>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [directionOpen, setDirectionOpen] = useState(false);
  const detailOpen = phase === "running";


  function scrollToDirection() {
    requestAnimationFrame(() =>
      document.getElementById("direcao-hoje")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function startNow() {
    haptic(10);
    setDirectionOpen(true);
    setPhase("running");
    setStartedAt((v) => v ?? Date.now());
    scrollToDirection();
  }

  // Atalho "Check-in" abre o detalhe da direção do dia.
  useEffect(() => {
    const handler = () => startNow();
    window.addEventListener(OPEN_DIRECTION_EVENT, handler);
    return () => window.removeEventListener(OPEN_DIRECTION_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // A descrição da meta é o "first_action" (mapeado no server para 'description').
  const metaDescription = plan?.first_action ?? plan?.priority_title ?? null;
  const dayComplete = !!todayCheckin || plan?.status === "completed";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const completedOutcome: Outcome =
    (todayCheckin?.outcome as Outcome | undefined) ??
    (plan?.status === "completed" ? "done" : "done");


  const metaText = metaDescription ? extractDuration(metaDescription) : null;


  // Microfrase: apenas a primeira frase do movimento, sem cortes com reticências.
  const microPhrase = metaText
    ? (metaText.text.match(/^[^.!?]+[.!?]?/)?.[0] ?? metaText.text).trim()
    : null;

  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (completeTimer.current) clearTimeout(completeTimer.current);
  }, []);

  /** Conclusão da direção: check, microfeedback breve e recolhimento do card. */
  function completeDirection() {
    haptic([10, 40, 14]);
    setPhase("completed");
    queryClient.invalidateQueries({ queryKey: ["goal-history"] });
    if (completeTimer.current) clearTimeout(completeTimer.current);
    completeTimer.current = setTimeout(() => setPhase("idle"), 3200);
  }


  // Direção nova do dia: indicador discreto no card, sem tela intermediária.
  const introKey = `imag_direction_intro:${uid ?? "anon"}:${localDate}`;
  const [introSeen, setIntroSeen] = useState(true);
  useEffect(() => {
    if (preview || !uid) return;
    try {
      setIntroSeen(localStorage.getItem(introKey) === "1");
    } catch {
      setIntroSeen(true);
    }
  }, [introKey, preview, uid]);

  function markDirectionSeen() {
    if (introSeen) return;
    try {
      localStorage.setItem(introKey, "1");
    } catch {}
    setIntroSeen(true);
  }

  const isNewDirection =
    !preview && !introSeen && !!plan && !!plan.priority_title && !dayComplete && !meta1Dismissed;

  // Fala contextual da MAG na abertura da Home (uma frase curta, depois silêncio).
  const magHome = useMagSpeech();
  const greeted = useRef(false);
  useEffect(() => {
    if (preview || greeted.current || !plan?.priority_title || dayComplete) return;
    greeted.current = true;
    const t = setTimeout(
      () => magHome.say(magPhrase(isNewDirection ? MAG_PHRASES.newDirection : MAG_PHRASES.home)),
      900,
    );
    return () => clearTimeout(t);
  }, [preview, plan?.priority_title, dayComplete, isNewDirection, magHome]);

  const statusLine =
    phase === "completed"
      ? "Direção concluída · +1 passo"
      : dayComplete
        ? "Você moveu o que importava."
        : phase === "running"
          ? "Você está em movimento."
          : "Sua direção está pronta.";

  return (
    <div className="relative">
      {!directionOpen && (
        <>
          <MagHub
            localDate={localDate}
            directionTitle={plan?.priority_title ?? null}
            directionDone={phase === "completed"}

            onOrganize={() => setOrganizeOpen(true)}
            onDirection={() => {
              setDirectionOpen(true);
              requestAnimationFrame(() =>
                document
                  .getElementById("direcao-hoje")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              );
            }}
          />
        </>
      )}



      <section
        id="direcao-hoje"
        className="scroll-mt-4"
        hidden={!directionOpen}
        aria-hidden={!directionOpen}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h1
            className="text-[21px] font-semibold leading-[1.1] sm:text-[25px]"
            style={{ ...DISPLAY, color: INK, letterSpacing: "-0.025em" }}
          >
            Minha direção
          </h1>
          <button
            type="button"
            onClick={() => setDirectionOpen(false)}
            className="text-[12px] font-light transition active:opacity-60"
            style={{ color: MUTED }}
          >
            Voltar
          </button>
        </div>

        <AnimatePresence mode="wait">
            <motion.p
              key={statusLine}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="mt-1 text-[11.5px] font-light"
              style={{ color: phase === "completed" ? BLUE_IMAG : MUTED, letterSpacing: "-0.01em" }}
            >
              {statusLine}
            </motion.p>
        </AnimatePresence>


        {plan && metaText && !meta1Dismissed && (
          <motion.article
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className={dayComplete ? "mt-4 rounded-[20px] px-5 py-4" : "mt-5 rounded-[20px] px-5 py-5"}
            style={{
              background: "#FFFFFF",
              border:
                dayComplete || phase === "completed"
                  ? `1px solid ${HAIRLINE_SOFT}`
                  : `1px solid rgba(51, 92, 255, 0.22)`,
              boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <span
                  className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: BLUE_IMAG }}
                >
                  MAG direciona
                </span>

                <h2
                  className="flex items-start gap-2 text-[16px] font-semibold leading-[1.34] sm:text-[17px]"
                  style={{ color: "#111111", letterSpacing: "-0.025em" }}
                >
                  {(dayComplete || phase === "completed") && (
                    <Check
                      className="mt-[3px] h-4 w-4 shrink-0"
                      strokeWidth={2.4}
                      style={{ color: BLUE_IMAG }}
                    />
                  )}
                  <span>{plan.priority_title}</span>
                </h2>
                {!dayComplete && microPhrase && (
                  <p
                    className="mt-1.5 line-clamp-1 text-[12.5px] font-light leading-[1.45]"
                    style={{ color: MUTED, letterSpacing: "-0.01em" }}
                  >
                    {highlightMeta(microPhrase)}
                  </p>
                )}
              </div>
              {!dayComplete && (
                <div className="flex shrink-0 flex-col items-end">
                  <MagBubble message={magHome.message} align="right" />
                  <MagFull
                    state={
                      phase === "completed"
                        ? "proud"
                        : phase === "running"
                          ? "attention"
                          : isNewDirection
                            ? "confident"
                            : "neutral"
                    }
                    size={64}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {!dayComplete && (
              <AnimatePresence mode="wait" initial={false}>
                {phase === "idle" && (
                  <motion.div
                    key="cta"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: easeOut }}
                    className="mt-4"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        haptic(8);
                        markDirectionSeen();
                        setPhase("choosing");
                      }}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium transition active:opacity-70"
                      style={{ color: BLUE_IMAG }}
                    >
                      Começar
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </motion.div>
                )}

                {phase === "choosing" && (
                  <motion.div
                    key="choose"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="mt-4 flex flex-wrap items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={startNow}
                      className="inline-flex h-[38px] items-center justify-center gap-2 rounded-full px-5 text-[13px] font-medium transition active:scale-[0.98]"
                      style={{ background: BLUE_IMAG, color: "#FFFFFF" }}
                    >
                      Fazer agora
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setPhase("idle");
                      }}
                      className="inline-flex h-[38px] items-center justify-center rounded-full px-5 text-[13px] font-normal transition active:scale-[0.98]"
                      style={{ border: `1px solid ${HAIRLINE_SOFT}`, color: MUTED }}
                    >
                      Depois
                    </button>
                    {metaText.duration && (
                      <span className="text-[12px] font-light" style={{ color: MUTED }}>
                        {metaText.duration}
                      </span>
                    )}
                  </motion.div>
                )}

                {phase === "running" && (
                  <motion.div
                    key="running"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="mt-4"
                  >
                    <DirectionProgress startedAt={startedAt} duration={metaText.duration} />
                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setPhase("idle");
                      }}
                      className="mt-3 text-[12.5px] font-light transition active:opacity-70"
                      style={{ color: MUTED }}
                    >
                      Fechar
                    </button>
                  </motion.div>
                )}

                {phase === "completed" && (
                  <motion.p
                    key="completed"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: easeOut }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
                    style={{ background: "#F3F6FF", color: BLUE_IMAG }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.6} />
                    Direção concluída · +1 passo
                  </motion.p>
                )}
              </AnimatePresence>
            )}


            <AnimatePresence initial={false}>
              {detailOpen && (
                <motion.div
                  key="detail"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: easeOut }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    {metaText.text !== microPhrase && (
                      <p
                        className="mb-3 text-[13.5px] font-light leading-[1.5]"
                        style={{ color: INK, letterSpacing: "-0.01em" }}
                      >
                        {highlightMeta(metaText.text)}
                      </p>
                    )}
                    <DirectionConfidence title={metaText.text} />

                    <MetaFeedback
                      goalId={plan.id}
                      goalTitle={plan.priority_title}
                      goalCategory={plan.source}
                      goalContext={plan.context_summary ?? plan.priority_reason ?? null}
                      alreadyClosed={!!todayCheckin}
                      onOutcome={(outcome) => {
                        if (todayCheckin) return;
                        submitReflection({
                          data: {
                            plan_id: plan.id,
                            outcome,
                            note: null,
                            activity_text: metaDescription!,
                            signal_key: null,
                            signal_answer: null,
                          },
                        })
                          .then(() => {
                            try {
                              track("tool_used", { tool: "checkin", source: "paid-home" });
                            } catch {
                              /* ignore */
                            }
                            queryClient.invalidateQueries({ queryKey: ["today-reflection"] });
                            queryClient.invalidateQueries({ queryKey: ["recent-reflections"] });
                            queryClient.invalidateQueries({ queryKey: ["goal-history"] });
                            queryClient.invalidateQueries({
                              queryKey: ["today-meta", uid, localDate],
                            });
                          })
                          .catch(() => {
                            /* silencioso: o check-in da MAG já foi registrado */
                          });
                      }}
                      onFinished={completeDirection}
                    />


                    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] font-light">
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="inline-flex items-center gap-1.5 transition hover:opacity-70"
                        style={{ color: MUTED }}
                      >
                        <Send className="h-3.5 w-3.5" strokeWidth={1.7} />
                        Compartilhar direção
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <ShareDirectionModal
              open={shareOpen}
              onClose={() => setShareOpen(false)}
              planId={plan.id}
              title={plan.priority_title ?? "MAG Meta"}
              description={metaText.text}
              reason={plan.priority_reason ?? null}
              duration={metaText.duration}
            />
          </motion.article>
        )}

        {showLoading && (
          <div
            className="mt-4 flex items-center gap-3 text-[13px]"
            style={{ color: MUTED }}
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BLUE_IMAG }} />
            <span>Carregando sua direção…</span>
          </div>
        )}
        {showError && (
          <div
            className="mt-4 max-w-[52ch] rounded-[20px] border p-5 text-[13.5px] leading-relaxed"
            style={{ borderColor: HAIRLINE_SOFT, background: "#FFFFFF", color: INK }}
            role="alert"
          >
            <p className="font-medium">Não conseguimos carregar sua direção agora.</p>
            <p className="mt-1" style={{ color: MUTED }}>
              {lastErrorDetail ?? "Tente novamente em instantes."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={retryPlan}
                disabled={planFetching}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition disabled:opacity-60"
                style={{ background: BLUE_IMAG, color: "#FFFFFF" }}
              >
                {planFetching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Tentando…
                  </>
                ) : (
                  <>Tentar novamente</>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <DayAiSheet
        open={organizeOpen}
        localDate={localDate}
        onClose={() => setOrganizeOpen(false)}
        onApplied={() => {
          queryClient.invalidateQueries({ queryKey: ["day-panel"] });
        }}
      />

    </div>
  );
}

// ─── Meu progresso ─────────────────────────────────────────────────

// ─── Estado "dia concluído" ────────────────────────────────────────
const IMAG_BLUE = "#335CFF";

type Outcome = ClosureKey;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatusSeal({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, { label: string; Icon: typeof CheckCircle2 }> = {
    done: { label: "Concluída", Icon: CheckCircle2 },
    partial: { label: "Avancei em parte", Icon: CircleDot },
    blocked: { label: "Não fiz", Icon: AlertCircle },
    skipped: { label: "Mudou de prioridade", Icon: CircleDot },
  };
  const { label, Icon } = map[outcome];
  const iconColor = outcome === "done" ? "#1DA55C" : IMAG_BLUE;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-normal"
      style={{ color: MUTED }}
    >
      <Icon className="h-3 w-3" strokeWidth={2} style={{ color: iconColor }} />
      {label}
    </span>
  );
}

// Retained for potential future recommendation tiles (MAGcast, etc.).
// Kept intentionally unused during the MAGcast pause.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _RecommendationTile({
  icon,
  eyebrow,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-[18px] px-5 py-4 text-left transition hover:bg-black/[0.02]"
      style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: "#FAF7EF", color: GOLD }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[9px] uppercase tracking-[0.4em]" style={{ ...MONO, color: MUTED }}>
          {eyebrow}
        </span>
        <span className="mt-1 block truncate text-[14px] font-medium" style={{ color: INK }}>
          {title}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] font-light" style={{ color: MUTED }}>
            {hint}
          </span>
        )}
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
        style={{ color: MUTED }}
        strokeWidth={1.6}
      />
    </button>
  );
}

// Wrapper padrão de página (usado por /app quando o usuário é pagante)
export function PaidHomeShell({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstName] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const name = (p as { full_name?: string | null } | null)?.full_name ?? "";
      if (alive) setFirstName(name.trim().split(/\s+/)[0] ?? "");
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="surface-light min-h-screen bg-background text-foreground fade-rise">
      <HomeTopBar firstName={firstName} />
      <HomeNoticeBar />
      <main className="relative mx-auto max-w-3xl px-6 pb-32 pt-4 sm:px-10">{children}</main>
      <BottomNav />
    </div>
  );
}

// ─── Progresso discreto da direção em execução ─────────────────────

function parseMinutes(duration: string | null): number | null {
  if (!duration) return null;
  const m = duration.match(/(\d+)\s*(min|h)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /h/i.test(m[2]) ? n * 60 : n;
}

function DirectionProgress({
  startedAt,
  duration,
}: {
  startedAt: number | null;
  duration: string | null;
}) {
  const total = parseMinutes(duration);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.max(0, (Date.now() - startedAt) / 60000));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const ratio = total ? Math.min(1, elapsed / total) : Math.min(0.9, elapsed / 30);

  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] font-light" style={{ color: MUTED }}>
        <span>Em andamento</span>
        {duration && <span>{duration}</span>}
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "#EEF1F7" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: BLUE_IMAG }}
          initial={false}
          animate={{ width: `${Math.max(6, ratio * 100)}%` }}
          transition={{ duration: 0.9, ease: easeOut }}
        />
      </div>
    </div>
  );
}
