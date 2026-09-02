import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check, CheckCircle2, ChevronRight, MoreHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  completeTodayMeta,
  getTodayMeta,
  markDirectionAdapted,
  markDirectionPartial,
  markDirectionSkipped,
  startDirection,
} from "@/lib/plans.functions";
import { refreshTodayDirection } from "@/lib/refresh-direction.functions";
import { submitGoalFeedback } from "@/lib/goal-feedback.functions";
import { getDirectionResponse } from "@/lib/direction-responses.functions";
import { FocusSheet } from "@/components/home/FocusSheet";
import { DirectionMessage } from "@/components/home/DirectionMessage";
import { DirectionInteraction } from "@/components/home/DirectionInteraction";
import { classifyDirection } from "@/lib/mag/direction-format";
import {
  detectLifeArea,
  parseStoredInteraction,
  type InteractionConfig,
} from "@/lib/mag/interaction";
import { actionTitleFor, toCanonicalInteraction } from "@/lib/mag/direction-interaction";

import { haptic } from "@/lib/haptics";
import { emitMagnetoReward } from "@/components/MagnetoReward";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";


const BLUE = "#335CFF";
const BLUE_CARD = "#EDF1FF";
const BLUE_CARD_BORDER = "#D9E0FA";
const INK = "#111111";
const MUTED = "#7A7A80";

type Useful = "liked" | "disliked";

/** Motivos possíveis quando a direção não acontece — nunca punitivos. */
const SKIP_REASONS = [
  "Faltou tempo",
  "Não era prioridade",
  "Direção muito grande",
  "Dependia de outra pessoa",
  "Não fez sentido",
  "Outro motivo",
];

/** Formas de adaptar a direção sem perder o contexto anterior. */
const ADAPT_OPTIONS = [
  "Deixar mais simples",
  "Dividir em etapas",
  "Trocar o horário",
  "Escolher outra prioridade",
  "Não faz sentido hoje",
  "Explicar para a MAG",
];

const DOT: Record<string, string> = {
  pending: "#C7CBD4",
  running: "#E9A23B",
  completed: "#2FA36B",
  partial: "#E9A23B",
  skipped: "#D2635A",
};

function hhmm(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Converte a descrição da direção em etapas curtas (máx. 4). */
function toSteps(description?: string | null): string[] {
  if (!description) return [];
  const raw = description
    .split(/\n+/)
    // Numeração embutida no meio do texto ("... 3. Anote") vira etapa própria.
    .flatMap((line) => line.split(/\s+(?=\d{1,2}[.)]\s+[A-ZÀ-Ú])/))
    .flatMap((line) => (line.length > 140 ? line.split(/(?<=[.!?])\s+/) : [line]))
    .map((s) => s.replace(/^\s*(?:[-•–]|\d{1,2}[.)])\s*/, "").trim())
    .filter((s) => s.length > 2);
  return raw.slice(0, 3);
}


const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * Direção do dia — box azul de destaque: recado principal do dia.
 * O toque expande o conteúdo completo, com check-in e conclusão inline.
 */
export function DirectionToday({
  localDate,
  className = "",
  expanded: expandedProp,
  onExpandedChange,
}: {
  localDate: string;
  className?: string;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchMeta = useServerFn(getTodayMeta);
  const complete = useServerFn(completeTodayMeta);
  const sendFeedback = useServerFn(submitGoalFeedback);
  const start = useServerFn(startDirection);
  const setPartial = useServerFn(markDirectionPartial);
  const setSkipped = useServerFn(markDirectionSkipped);
  const setAdapted = useServerFn(markDirectionAdapted);
  const fetchResponse = useServerFn(getDirectionResponse);

  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = expandedProp ?? expandedLocal;
  const setExpanded = (v: boolean) => {
    if (onExpandedChange) onExpandedChange(v);
    else setExpandedLocal(v);
  };
  const [whyOpen, setWhyOpen] = useState(false);
  const [reply, setReply] = useState<{ text: string; adjust?: boolean } | null>(null);
  const replyRef = useRef<{ text: string; adjust?: boolean } | null>(null);
  replyRef.current = reply;
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | "skip" | "adapt">(null);
  /* Alternativas de conclusão com explicação opcional. */
  const [outcomePicker, setOutcomePicker] = useState<null | "partial">(null);
  /** Status escolhido no check-in — apenas um pode ficar selecionado. */
  const [checkin, setCheckin] = useState<null | "done" | "partial" | "skipped">(null);
  const [partialNote, setPartialNote] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [focusOpen, setFocusOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  /* Animação de entrada apenas uma vez por dia. */
  const introRef = useRef<boolean | null>(null);
  if (introRef.current === null) {
    let first = false;
    try {
      const key = `imag:direction-intro:${localDate}`;
      first = typeof window !== "undefined" && !window.localStorage.getItem(key);
      if (first) window.localStorage.setItem(key, "1");
    } catch {
      first = false;
    }
    introRef.current = first;
  }

  /* Recompensa visual: só após o backend confirmar uma nova transação. */
  const rewardOnce = (awarded: boolean) => {
    if (!awarded) return;
    const el =
      cardRef.current?.querySelector<HTMLElement>('[data-magneto-origin]') ?? cardRef.current;
    const rect = el?.getBoundingClientRect();
    if (rect) emitMagnetoReward(rect);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);


  const timezone = useRef<string>(
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    })(),
  ).current;

  const queryClient = qc;
  const {
    data: plan,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["today-meta", localDate],
    queryFn: () =>
      fetchMeta({ data: { local_date: localDate, timezone: timezone || undefined } }),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  /* "Tentar novamente": descarta a direção pendente no servidor e gera outra
     com o contexto atual — nunca restaura a direção de ontem nem o cache. */
  const [retrying, setRetrying] = useState(false);
  const [refreshOk, setRefreshOk] = useState(false);
  const refreshDirection = useServerFn(refreshTodayDirection);
  const forceRegenerate = async () => {
    setTimedOut(false);
    setRetrying(true);
    setRefreshOk(false);
    try {
      const fresh = await refreshDirection({
        data: { local_date: localDate, timezone: timezone || undefined },
      });
      queryClient.setQueryData(["today-meta", localDate], fresh);
      setRefreshOk(true);
      const t = setTimeout(() => setRefreshOk(false), 4000);
      return () => clearTimeout(t);
    } catch (err) {
      console.error("[DirectionToday] refresh failed", err);
      await refetch();
    } finally {
      setRetrying(false);
    }
  };


  /* Timeout técnico: se a geração passar de 25s, o loading para e o usuário
     recebe uma saída real em vez de girar para sempre. */
  const [timedOut, setTimedOut] = useState(false);
  const loading = ((isLoading || isFetching) && !plan) || retrying;
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 25_000);
    return () => clearTimeout(t);
  }, [loading]);

  const done = plan?.status === "completed";

  /* Concluída: o card azul se recolhe sozinho uma vez, com microanimação. */
  const autoCollapsedDone = useRef(false);
  useEffect(() => {
    if (done && !autoCollapsedDone.current) {
      autoCollapsedDone.current = true;
      const t = setTimeout(() => setExpanded(false), 900);
      return () => clearTimeout(t);
    }
    if (!done) autoCollapsedDone.current = false;
  }, [done]);

  const summary = plan?.first_action ?? plan?.priority_title ?? null;

  /* Lógica adaptativa global: a interface vem SEMPRE do que foi salvo na
     direção, reduzida ao contrato canônico. Direções antigas sem tipo salvo
     caem em `no_input` — nunca em formulários longos automáticos. */
  const stored = parseStoredInteraction(plan?.interaction_type, plan?.interaction_config);
  const canonical = toCanonicalInteraction(stored?.type ?? null, stored?.config ?? null);
  const legacyFormat = classifyDirection(plan?.priority_title, plan?.first_action);
  const isMessage = canonical.type === "suggested_message";
  const displayTitle = plan?.priority_title ?? "";
  const displayDescription = plan?.first_action ?? legacyFormat.description ?? null;
  /* Detecção dinâmica e geral: quando a direção pede para escrever, registrar,
     descrever ou listar algo — mesmo sem tipo salvo — o campo de resposta
     nasce automaticamente dentro do card. */
  const WRITES_BACK =
    /(regist|escrev|anot|descrev|list[ea]|respond|cont[ae]\b|reflita|relat|o que sentiu|como foi)/i;
  const detectedNeedsText =
    canonical.type === "no_input" &&
    WRITES_BACK.test(`${displayTitle} ${displayDescription ?? ""}`);
  const needsAnswer = (canonical.type !== "no_input" && !isMessage) || detectedNeedsText;
  const lifeArea = detectLifeArea(`${displayTitle} ${displayDescription ?? ""}`);
  const steps = toSteps(displayDescription);
  /* Quando existe componente interativo, a instrução vira uma frase só:
     nada de dividir uma ação simples em passos óbvios. */
  const visibleSteps = needsAnswer || isMessage ? steps.slice(0, 1) : steps;
  const actionTitle = actionTitleFor(canonical, `${displayTitle} ${displayDescription ?? ""}`);

  /* O conteúdo completo aparece ao expandir; a prévia é limitada a 3 linhas. */



  /* Registro alimentar: campo dedicado com título e exemplo de preenchimento. */
  const FOOD_LOG = /(comeu|comi\b|alimenta|refeiç|diário alimentar|o que voc[êe] come)/i;
  const baseFields =
    canonical.fields.length > 0
      ? canonical.fields
      : [
          {
            key: "resposta",
            label: "Sua resposta",
            type: "text" as const,
            required: true,
            placeholder: "Escreva aqui…",
          },
        ];
  const fields = baseFields.map((f, i) =>
    i === 0 &&
    f.type === "text" &&
    FOOD_LOG.test(`${displayTitle} ${displayDescription ?? ""} ${f.label}`)
      ? {
          ...f,
          label: "O que você comeu nas últimas 24 horas?",
          placeholder:
            "Ex.: 7h — café preto e pão com queijo\n12h30 — arroz, feijão, frango e salada\n16h — iogurte com frutas\n20h — sopa de legumes",
        }
      : f,
  );

  /* Config reduzida entregue ao renderizador genérico. */
  const canonicalConfig: InteractionConfig | null = needsAnswer
    ? {
        type: stored?.type ?? "text_response",
        fields,
        allow_add: false,
        min_fields: fields.length,
        max_fields: fields.length,
        ...(canonical.options.length
          ? {
              selection: {
                type: canonical.multiple ? ("multiple" as const) : ("single" as const),
                label: canonical.selectionLabel ?? "Qual é a sua resposta?",
                required: true,
                options: canonical.options,
              },
            }
          : {}),
        ...(canonical.helper ? { helper: canonical.helper } : {}),
        completion_label: canonical.completionLabel,
        completion_rule: "",
        reward_magnetos: 10,
      }
    : null;



  /* Máquina de estados persistida no banco. */
  const outcome = plan?.outcome ?? null;
  const started = Boolean(plan?.started_at) && !done && outcome === null;
  const state: keyof typeof DOT = done
    ? "completed"
    : outcome === "partial"
      ? "partial"
      : outcome === "skipped"
        ? "skipped"
        : started
          ? "running"
          : "pending";

  /* Direções com atividade interna só abrem o check-in depois que a resposta
     foi realmente salva — abrir o card nunca conta como execução. */
  const { data: savedResponse } = useQuery({
    queryKey: ["direction-response", plan?.id],
    queryFn: () => fetchResponse({ data: { plan_id: plan!.id } }),
    enabled: Boolean(plan?.id) && needsAnswer,
    staleTime: 60_000,
    retry: 0,
  });
  const canCheckIn = !needsAnswer || Boolean(savedResponse);

  /* Quando a direção pede resposta e ainda não há registro, o card abre
     sozinho — o campo aparece logo abaixo da instrução, sem toque extra. */
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (needsAnswer && !done && plan && savedResponse === null) {
      autoOpenedRef.current = true;
      setExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAnswer, done, plan?.id, savedResponse]);

  const begin = useMutation({
    mutationFn: async () => {
      if (!plan) return;
      return start({ data: { plan_id: plan.id } });
    },
    onSuccess: () => {
      haptic(8);
      qc.invalidateQueries({ queryKey: ["today-meta"] });
    },
  });

  /* Quando a direção já pede resposta dentro do card, o salvamento também
     marca o início — nenhum passo extra antes de "Salvar e concluir". */
  const ensureStarted = async () => {
    if (!plan || plan.started_at) return;
    await start({ data: { plan_id: plan.id } });
    qc.invalidateQueries({ queryKey: ["today-meta"] });
  };

  const partial = useMutation({
    mutationFn: async (note?: string) => {
      if (!plan) return;
      const trimmed = note?.trim();
      return setPartial({
        data: { plan_id: plan.id, ...(trimmed ? { note: trimmed } : {}) },
      });
    },
    onSuccess: (res) => {
      haptic([8, 24]);
      setOutcomePicker(null);
      setPartialNote("");
      rewardOnce(res?.awarded === true);
      qc.invalidateQueries({ queryKey: ["today-meta"] });
      qc.invalidateQueries({ queryKey: ["antenna-state"] });
      qc.invalidateQueries({ queryKey: ["weekly-focus"] });
    },
  });

  const skip = useMutation({
    mutationFn: async ({ reason, note }: { reason: string; note?: string }) => {
      if (!plan) return;
      try {
        await sendFeedback({
          data: {
            goal_id: plan.id,
            feedback: "disliked" as Useful,
            goal_title: plan.priority_title,
            goal_context: note?.trim() ? `${reason} — ${note.trim()}` : reason,
          },
        });
      } catch {
        /* aprendizado é silencioso */
      }
      const trimmed = note?.trim();
      return setSkipped({
        data: { plan_id: plan.id, reason, ...(trimmed ? { note: trimmed } : {}) },
      });
    },
    onSuccess: () => {
      haptic(6);
      setSkipNote("");
      qc.invalidateQueries({ queryKey: ["today-meta"] });
    },
  });

  const adapt = useMutation({
    mutationFn: async (note: string) => {
      if (!plan) return;
      return setAdapted({ data: { plan_id: plan.id, note } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-meta"] });
      navigate({ to: "/mentor" });
    },
  });

  const finish = useMutation({

    mutationFn: async (answer: { label: string; feedback: Useful } | null) => {
      if (!plan) return;
      if (answer) {
        try {
          await sendFeedback({
            data: {
              goal_id: plan.id,
              feedback: answer.feedback,
              goal_title: plan.priority_title,
              goal_context: answer.label,
            },
          });
        } catch {
          /* aprendizado é silencioso */
        }
      }
      return complete({ data: { local_date: localDate } });
    },
    onSuccess: (res) => {
      haptic([10, 40, 14]);
      rewardOnce(res?.awarded === true);
      qc.invalidateQueries({ queryKey: ["antenna-state"] });
      qc.invalidateQueries({ queryKey: ["today-meta"] });
      qc.invalidateQueries({ queryKey: ["current-plan"] });
      qc.invalidateQueries({ queryKey: ["goal-history"] });
      qc.invalidateQueries({ queryKey: ["goal-feedback"] });
      qc.invalidateQueries({ queryKey: ["active-circle"] });
      qc.invalidateQueries({ queryKey: ["magnetic-field"] });
      qc.invalidateQueries({ queryKey: ["weekly-focus"] });
      /* Ao concluir, o card recolhe suavemente e mostra o resumo compacto. */
      setTimeout(() => {
        setExpanded(false);
        setReply(null);
      }, 1200);
    },
  });

  const toggle = () => {
    haptic(6);
    setExpanded(!expanded);
    setWhyOpen(false);
  };

  /* Enquanto a MAG realmente prepara a direção, um sinal discreto — sem
     bloquear a Home e sem carregamento falso. */
  if ((isError || timedOut) && !summary) {
    return (
      <section className={className}>
        <div
          className="rounded-[20px] px-4 py-4"
          style={{ background: "#FFFFFF", border: "1px solid #ECEDF0" }}
        >
          <div className="flex items-center gap-2">
            <img src={magHeadOfficial.url} alt="" className="h-[18px] w-[18px] object-contain" />
            <span
              className="text-[9.5px] font-semibold uppercase"
              style={{ color: "#335CFF", letterSpacing: "0.14em" }}
            >
              MAG
            </span>
          </div>
          <p className="mt-2 text-[14px] font-medium leading-[1.4]" style={{ color: "#111111" }}>
            Não consegui preparar uma direção confiável agora. Vamos tentar novamente?
          </p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setTimedOut(false);
              void forceRegenerate();
            }}
            className="mt-3 rounded-full px-4 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: "#335CFF", color: "#FFFFFF" }}
          >
            {retrying ? "Gerando…" : "Tentar novamente"}
          </button>

        </div>
      </section>
    );
  }

  if (loading && !summary) {
    return (
      <section className={className}>
        <div className="flex items-center gap-2 px-1 py-2">
          <motion.img
            src={magHeadOfficial.url}
            alt=""
            className="h-[20px] w-[20px] object-contain"
            animate={{ y: [0, -2, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-[12.5px] font-light" style={{ color: "#7B7F89" }}>
            MAG está preparando sua primeira direção…
          </span>
        </div>
      </section>
    );
  }

  /* Sem foco da semana ativo a MAG não inventa direção: o convite vive apenas
     no card "Foco da Semana". Aqui não renderizamos nada. */
  if (!summary) return null;

  /* Concluída: o card fica azul-claro — recolhido ou expandido, mesma identidade. */
  if (done) {
    return (
      <section className={`relative ${className}`} data-tour="direction">
        <motion.div
          layout
          className="overflow-hidden rounded-[16px]"
          style={{ background: "#F5F7FF", border: "1px solid #E4E9FA" }}
        >
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition active:opacity-80"
          >
            <img
              src={magHeadOfficial.url}
              alt=""
              aria-hidden
              className="h-7 w-7 shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2
                  className="h-[14px] w-[14px] shrink-0"
                  strokeWidth={2}
                  style={{ color: "#2FA36B" }}
                  aria-hidden
                />
                <span className="text-[16px] font-semibold" style={{ color: INK }}>
                  Direção concluída
                </span>
              </span>
              <span className="block text-[13px] font-normal" style={{ color: MUTED }}>
                Ver o que você realizou
              </span>
            </span>
            <ChevronRight
              className="h-[16px] w-[16px] shrink-0 transition-transform duration-300"
              strokeWidth={1.9}
              style={{ color: BLUE, transform: expanded ? "rotate(90deg)" : "none" }}
            />
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div {...reveal} className="overflow-hidden">
                <div className="px-3.5 pb-3">
                  <div className="h-px w-full" style={{ background: "#E4E9FA" }} />
                  <p
                    className="mt-2.5 text-[14px] font-medium leading-[1.35]"
                    style={{ color: INK }}
                  >
                    {displayTitle}
                  </p>

                  {plan?.priority_reason ? (
                    <div className="mt-2">
                      <div className="h-px w-full" style={{ background: "#E4E9FA" }} />
                      <button
                        type="button"
                        onClick={() => {
                          haptic(4);
                          setWhyOpen((v) => !v);
                        }}
                        aria-expanded={whyOpen}
                        className="flex h-[36px] w-full items-center justify-between gap-2 text-left text-[12.5px] font-medium transition active:opacity-70"
                        style={{ color: BLUE }}
                      >
                        <span>Por que a MAG sugeriu isso?</span>
                        <ChevronRight
                          className="h-3.5 w-3.5 shrink-0 transition-transform duration-300"
                          strokeWidth={2}
                          style={{ transform: whyOpen ? "rotate(90deg)" : "none" }}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {whyOpen && (
                          <motion.p
                            {...reveal}
                            className="whitespace-pre-line break-words pb-1 text-[12.5px] font-normal leading-[1.5]"
                            style={{ color: MUTED }}
                          >
                            {plan.priority_reason}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : null}

                  <div className="mt-2 h-px w-full" style={{ background: "#E4E9FA" }} />
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: MUTED }}>
                    <CheckCircle2
                      className="h-[13px] w-[13px] shrink-0"
                      strokeWidth={2}
                      style={{ color: "#2FA36B" }}
                      aria-hidden
                    />
                    {plan?.completed_at ? `Concluída às ${hhmm(plan.completed_at)} · ` : ""}
                    +10 magnetos
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    );
  }



  return (
    <section
      ref={cardRef}
      className={`relative ${className}`}
      data-tour="direction"
      style={
        expanded
          ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }
          : undefined
      }
    >
      {refreshOk && (
        <div className="mb-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
          style={{ background: "rgba(15,118,110,0.10)", color: "#0F766E" }}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden style={{ color: "#0F766E" }} />
          Direção atualizada
        </div>
      )}

      <motion.div
        layout
        initial={introRef.current ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[20px]"
        style={{
          background: BLUE_CARD,
          border: `1px solid ${BLUE_CARD_BORDER}`,
          boxShadow: "0 4px 14px -8px rgba(51,92,255,0.18)",
          opacity: done ? 0.92 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <div className="flex w-full items-start">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 flex-col items-stretch px-4 py-3 text-left transition active:opacity-90"
          >
            <span className="flex items-center gap-2">
              <motion.img
                src={magHeadOfficial.url}
                alt=""
                aria-hidden
                initial={introRef.current ? { opacity: 0, scale: 0.7, y: 6 } : false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="h-[26px] w-[26px] shrink-0 object-contain"
                style={{ filter: "drop-shadow(0 2px 5px rgba(10,25,80,0.18))" }}
              />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="shrink-0 text-[15px] font-semibold leading-[1.15]"
                  style={{ color: INK }}
                >
                  MAG
                </span>

                <span className="flex min-w-0 items-center gap-1.5">
                  {state === "completed" ? (
                    <Check
                      className="h-[10px] w-[10px] shrink-0"
                      strokeWidth={3}
                      style={{ color: "#2FA36B" }}
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: DOT[state] }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate text-[12px] font-normal leading-[1.2]" style={{ color: MUTED }}>
                    {state === "completed"
                      ? "Concluída"
                      : state === "running"
                        ? "Em andamento"
                        : state === "partial"
                          ? "Feita em parte"
                          : state === "skipped"
                            ? "Não realizada"
                            : "Pendente"}
                  </span>
                </span>
              </span>

            </span>

            <span className="mt-2.5 flex items-start gap-2">
              <span
                data-magneto-origin
                className="min-w-0 flex-1 text-[15px] font-semibold"
                style={{
                  color: INK,
                  lineHeight: "20px",
                  ...(expanded
                    ? {}
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }),
                }}
              >
                {displayTitle}
              </span>
              <ChevronRight
                className="h-[16px] w-[16px] shrink-0 self-center transition-transform"
                strokeWidth={1.75}
                style={{ color: BLUE, transform: expanded ? "rotate(90deg)" : "none" }}
              />
            </span>

            {!expanded && displayTitle.length > 60 && (
              <span
                className="mt-1 text-[11.5px] font-medium"
                style={{ color: BLUE }}
              >
                Ver mais
              </span>
            )}

          </button>
          <button
            type="button"
            aria-label="Mais opções"
            onClick={() => {
              haptic(6);
              setMenuOpen((v) => !v);
            }}
            className="mr-1.5 mt-2.5 grid h-7 w-7 shrink-0 place-items-center rounded-full transition active:opacity-70"
            style={{ background: menuOpen ? "rgba(51,92,255,0.08)" : "transparent" }}
          >
            <MoreHorizontal className="h-[16px] w-[16px]" strokeWidth={2} style={{ color: INK }} />
          </button>
        </div>



        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div {...reveal} className="overflow-hidden">
              <div className="px-4 pb-3 pt-1">
                {/* Caixa branca interna — apenas os passos de execução */}
                {steps.length > 0 && !done && !savedResponse && (
                  <div
                    className="rounded-[18px] px-3.5 py-3"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #D9E0FA",
                      boxShadow: "0 1px 2px rgba(10,25,80,0.04)",
                    }}
                  >
                    <p
                      className="text-[10.5px] font-semibold uppercase"
                      style={{ color: BLUE, letterSpacing: "0.12em" }}
                    >
                      {actionTitle}
                    </p>
                    {visibleSteps.length === 1 ? (
                      <p
                        className="mt-2 text-[13.5px] leading-[1.5]"
                        style={{ color: "#2A2A30" }}
                      >
                        {visibleSteps[0]}
                      </p>
                    ) : (
                      <ol className="mt-3 space-y-2.5">
                        {visibleSteps.map((step, i) => (
                          <li key={`${i}-${step.slice(0, 12)}`} className="flex items-start gap-3">
                            <span
                              className="mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11.5px] font-semibold"
                              style={{ background: "#EEF2FF", color: BLUE }}
                            >
                              {i + 1}
                            </span>
                            <span
                              className="text-[13.5px] leading-[1.5]"
                              style={{ color: "#2A2A30" }}
                            >
                              {step}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {/* Linha discreta de raciocínio — sem caixa, no máximo 48 px */}
                {plan?.priority_reason && !savedResponse && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        haptic(4);
                        setWhyOpen((v) => !v);
                      }}
                      aria-expanded={whyOpen}
                      className="flex h-[44px] w-full items-center justify-between gap-2 text-left text-[13px] font-medium transition active:opacity-70"
                      style={{
                        color: BLUE,
                        borderTop: `1px solid ${BLUE_CARD_BORDER}`,
                      }}
                    >
                      <span>Por que a MAG sugeriu isso?</span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 transition-transform duration-300"
                        strokeWidth={2}
                        style={{ color: BLUE, transform: whyOpen ? "rotate(90deg)" : "none" }}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {whyOpen && (
                        <motion.p
                          {...reveal}
                          className="whitespace-pre-line break-words pb-1 text-[13px] font-light leading-[1.55]"
                          style={{ color: MUTED }}
                        >
                          {plan.priority_reason}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}


                {/* Campo de resposta — disponível desde o estado pendente;
                    salvar já conclui a direção e concede os magnetos. */}
                {needsAnswer && plan && canonicalConfig && !done && (started || state === "pending") ? (
                  <DirectionInteraction
                    planId={plan.id}
                    directionTitle={displayTitle}
                    lifeArea={lifeArea}
                    config={canonicalConfig}
                    done={done}
                    completeOnSave={false}
                    ensureStarted={ensureStarted}
                    onCompleted={(awarded) => {
                      qc.invalidateQueries({ queryKey: ["today-meta", localDate] });
                      qc.invalidateQueries({ queryKey: ["antenna-state"] });
                      qc.invalidateQueries({ queryKey: ["weekly-focus"] });
                      rewardOnce(awarded);
                    }}
                  />
                ) : null}

                {/* ─── Estado PENDENTE ─── */}
                {state === "pending" && picker === null && !needsAnswer ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      disabled={begin.isPending}
                      onClick={() => {
                        if (begin.isPending) return;
                        haptic(8);
                        begin.mutate();
                      }}
                      className="w-full rounded-[16px] px-4 py-3 text-[14px] font-semibold transition disabled:opacity-60"
                      style={{ background: "#FFFFFF", color: BLUE }}
                    >
                      Começar agora
                    </motion.button>
                  </div>
                ) : null}

                {/* ─── Fiz em parte (explicação opcional) ─── */}
                {outcomePicker === "partial" && !done ? (
                  <div
                    className="mt-4 rounded-[20px] px-4 py-4"
                    style={{ background: "#FFFFFF", border: "1px solid #E3E7F0" }}
                  >
                    <p className="text-[13.5px] font-semibold" style={{ color: INK }}>
                      O que você conseguiu fazer?
                    </p>
                    <input
                      value={partialNote}
                      onChange={(e) => setPartialNote(e.target.value)}
                      maxLength={200}
                      placeholder="Opcional — conte em uma frase"
                      className="mt-2.5 w-full rounded-[14px] px-3.5 py-2.5 text-[14px] font-normal outline-none placeholder:text-[#9AA0AB]"
                      style={{ background: "#F7F8FB", border: "1px solid #E3E7F0", color: INK }}
                    />
                    <div className="mt-3 flex items-center gap-4">
                      <button
                        type="button"
                        disabled={partial.isPending}
                        onClick={() => {
                          haptic(6);
                          partial.mutate(partialNote);
                        }}
                        className="rounded-full px-4 py-2.5 text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
                        style={{ background: BLUE, color: "#FFFFFF" }}
                      >
                        Registrar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOutcomePicker(null);
                          setPartialNote("");
                        }}
                        className="text-[12px] font-light transition active:opacity-60"
                        style={{ color: MUTED }}
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* ─── Adaptar direção ─── */}
                {picker === "adapt" ? (
                  <div
                    className="mt-4 rounded-[20px] px-4 py-4"
                    style={{ background: "#FFFFFF", border: "1px solid #E3E7F0" }}
                  >
                    <p className="text-[13.5px] font-semibold" style={{ color: INK }}>
                      Como quer adaptar?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ADAPT_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={adapt.isPending}
                          onClick={() => {
                            haptic(6);
                            adapt.mutate(opt);
                          }}
                          className="rounded-full px-3 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-60"
                          style={{ background: "#F4F6FB", color: BLUE }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPicker(null)}
                      className="mt-3 text-[12px] font-light transition active:opacity-60"
                      style={{ color: MUTED }}
                    >
                      Voltar
                    </button>
                  </div>
                ) : null}

                {/* ─── Check-in minimalista ─── */}
                {state === "running" && picker !== "skip" && outcomePicker === null && canCheckIn ? (
                  <div
                    className="mt-3 flex items-stretch"
                    style={{ borderTop: `1px solid ${BLUE_CARD_BORDER}` }}
                  >
                    <button
                      type="button"
                      disabled={finish.isPending}
                      onClick={() => {
                        if (finish.isPending) return;
                        haptic(8);
                        setCheckin("done");
                        finish.mutate(null);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 py-3 text-[13.5px] font-medium transition active:opacity-60 disabled:opacity-60"
                      style={{ color: INK }}
                    >
                      <ThumbsUp className="h-[17px] w-[17px]" strokeWidth={1.7} aria-hidden />
                      Fiz
                    </button>
                    <span className="my-2.5 w-px" style={{ background: BLUE_CARD_BORDER }} aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        haptic(4);
                        setCheckin("skipped");
                        setPicker("skip");
                      }}
                      className="flex flex-1 items-center justify-center gap-2 py-3 text-[13.5px] font-medium transition active:opacity-60"
                      style={{ color: INK }}
                    >
                      <ThumbsDown className="h-[17px] w-[17px]" strokeWidth={1.7} aria-hidden />
                      Não Fiz
                    </button>
                  </div>
                ) : null}

                {/* ─── Motivo de não realização ─── */}
                {picker === "skip" ? (
                  <div
                    className="mt-4 rounded-[20px] px-4 py-4"
                    style={{ background: "#FFFFFF", border: "1px solid #E3E7F0" }}
                  >
                    <p className="text-[13.5px] font-semibold" style={{ color: INK }}>
                      O que dificultou essa direção?
                    </p>
                    <input
                      value={skipNote}
                      onChange={(e) => setSkipNote(e.target.value)}
                      maxLength={200}
                      placeholder="Quer contar o que aconteceu? (opcional)"
                      className="mt-3 w-full rounded-[14px] px-3.5 py-2.5 text-[14px] font-normal outline-none placeholder:text-[#9AA0AB]"
                      style={{ background: "#F7F8FB", border: "1px solid #E3E7F0", color: INK }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SKIP_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={skip.isPending}
                          onClick={() => {
                            haptic(6);
                            setPicker(null);
                            skip.mutate({ reason: r, note: skipNote });
                          }}
                          className="rounded-full px-3 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-60"
                          style={{ background: "#F4F6FB", color: "#3A3A40" }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPicker(null)}
                      className="mt-3 text-[12px] font-light transition active:opacity-60"
                      style={{ color: MUTED }}
                    >
                      Voltar
                    </button>
                  </div>
                ) : null}

                {/* ─── Resultado registrado ─── */}
                {state === "partial" || state === "skipped" ? (
                  <div
                    className="mt-4 rounded-[20px] px-4 py-3.5"
                    style={{ background: "#FFFFFF", border: "1px solid #E3E7F0" }}
                  >
                    <p className="text-[13.5px] font-medium leading-[1.4]" style={{ color: INK }}>
                      {state === "partial"
                        ? "Progresso registrado. Vou considerar isso na próxima direção."
                        : "Registrado. Posso deixar a próxima direção mais simples."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        navigate({ to: "/mentor" });
                      }}
                      className="mt-3 rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                      style={{ background: "#EEF2FF", color: BLUE }}
                    >
                      Falar com a MAG
                    </button>
                  </div>
                ) : null}

                {/* ─── Faixa de conclusão — uma linha, ~60 px ─── */}
                {done ? (
                  <div
                    className="mt-3 flex h-[60px] items-center gap-2 rounded-[16px] px-4"
                    style={{ background: "#E9F7F0" }}
                  >
                    <CheckCircle2
                      className="h-[16px] w-[16px] shrink-0"
                      strokeWidth={2}
                      style={{ color: "#1B7F55" }}
                      aria-hidden
                    />
                    <p className="text-[13px] font-medium" style={{ color: "#1B7F55" }}>
                      {plan?.completed_at ? `Concluída às ${hhmm(plan.completed_at)} · ` : ""}
                      +10 magnetos
                    </p>
                  </div>
                ) : null}


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Material sugerido — card branco separado, fora do card azul */}
      <AnimatePresence initial={false}>
        {expanded && isMessage && plan && !done && (
          <motion.div {...reveal} className="overflow-hidden">
            <DirectionMessage
              planId={plan.id}
              title={displayTitle}
              description={displayDescription}
              done={done}
              pending={finish.isPending}
              onSent={() => finish.mutate(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-2 top-12 z-30 w-[210px] overflow-hidden rounded-[16px]"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 12px 32px rgba(17,17,17,0.16)",
              border: "1px solid #ECEDF0",
            }}
          >
            <button
              type="button"
              onClick={() => {
                haptic(6);
                setMenuOpen(false);
                setFocusOpen(true);
              }}
              className="w-full px-4 py-3 text-left text-[14px] font-medium transition active:bg-[#F5F6F8]"
              style={{ color: INK }}
            >
              Mudar foco
            </button>
            <div className="h-px w-full" style={{ background: "#F1F2F5" }} />
            <button
              type="button"
              onClick={() => {
                haptic(6);
                setMenuOpen(false);
                navigate({ to: "/mentor" });
              }}
              className="w-full px-4 py-3 text-left text-[14px] font-medium transition active:bg-[#F5F6F8]"
              style={{ color: INK }}
            >
              Conversar com a MAG
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FocusSheet open={focusOpen} onClose={() => setFocusOpen(false)} />
    </section>

  );
}
