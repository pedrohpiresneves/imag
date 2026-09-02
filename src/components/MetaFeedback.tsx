import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getGoalFeedback,
  submitGoalFeedback,
  type GoalFeedback,
} from "@/lib/goal-feedback.functions";
import { submitDirectionImpact, getDirectionImpact } from "@/lib/impact.functions";
import { track } from "@/lib/analytics";
import { ImpactActions } from "@/components/ImpactActions";
import { MagFull, MagBubble, type MagState } from "@/components/mag/MagMascot";

const INK = "#111111";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const BLUE_SOFT = "#EEF4FF";
const BLUE_BORDER = "#DCE7FB";
const GREEN = "#1DA55C";

type OutcomeKey = "done" | "partial" | "not_done" | "changed";

const OUTCOMES: {
  key: OutcomeKey;
  label: string;
  mag: MagState;
  reaction: string;
  followUp: string | null;
  chips: readonly string[];
  closing: string;
}[] = [
  {
    key: "done",
    label: "Concluí",
    mag: "celebrating",
    reaction: "Boa. Você avançou.",
    followUp: "Quer manter esse ritmo na próxima?",
    chips: ["Sim, mesmo ritmo", "Quero algo mais ousado", "Quero algo mais leve"],
    closing: "Boa. Mais um passo na sua jornada.",
  },
  {
    key: "partial",
    label: "Avancei parcialmente",
    mag: "confident",
    reaction: "Seguimos. Já existe progresso.",
    followUp: "O que faltou para concluir?",
    chips: ["Faltou tempo", "Ficou complexo", "Depende de outra pessoa", "Perdi o foco"],
    closing: "Seguimos. Já existe progresso.",
  },
  {
    key: "not_done",
    label: "Não fiz",
    mag: "empathetic",
    reaction: "Tudo bem. Vamos ajustar.",
    followUp: "O que mais te impediu?",
    chips: ["Faltou tempo", "Esqueci", "Não era prioridade", "Estava confuso", "Outro motivo"],
    closing: "Tudo bem. O importante é ajustar, não travar.",
  },
  {
    key: "changed",
    label: "Mudou de prioridade",
    mag: "thinking",
    reaction: "Entendi. O contexto mudou.",
    followUp: "O que virou prioridade?",
    chips: ["Um cliente", "Uma entrega urgente", "Algo pessoal", "Outra frente"],
    closing: "Certo. Vamos seguir com clareza.",
  },
];

function outcomeOf(text?: string | null) {
  if (!text) return null;
  return OUTCOMES.find((o) => text.startsWith(o.label)) ?? null;
}

function timeLabel(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

type Props = {
  goalId: string;
  goalTitle?: string | null;
  goalCategory?: string | null;
  goalContext?: string | null;
  /** Registra o fechamento no mesmo fluxo de reflexão do dia (sem duplicar). */
  onOutcome?: (outcome: OutcomeKey) => void;
  alreadyClosed?: boolean;
  /** Quando definido, substitui a navegação automática para /jornada. */
  onFinished?: (reason: string) => void;
};

type Step = "outcome" | "useful" | "detail" | "done";

export function MetaFeedback({
  goalId,
  goalTitle,
  goalCategory,
  goalContext,
  onOutcome,
  onFinished,
}: Props) {

  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchFeedback = useServerFn(getGoalFeedback);
  const submit = useServerFn(submitGoalFeedback);
  const submitImpact = useServerFn(submitDirectionImpact);
  const fetchImpact = useServerFn(getDirectionImpact);

  const feedbackKey = ["goal-feedback", goalId] as const;
  const impactKey = ["direction-impact", goalId] as const;

  const { data: feedbackRow } = useQuery({
    queryKey: feedbackKey,
    queryFn: () => fetchFeedback({ data: { goal_id: goalId } }),
    staleTime: 60_000,
  });
  const { data: impactRow } = useQuery({
    queryKey: impactKey,
    queryFn: () => fetchImpact({ data: { goal_id: goalId } }),
    staleTime: 60_000,
  });

  const savedFeedback: GoalFeedback | null = feedbackRow?.feedback ?? null;
  const savedText = impactRow?.outcome_text ?? null;
  const savedOutcome = outcomeOf(savedText);
  const published = Boolean(impactRow?.published);

  const [outcome, setOutcome] = useState<OutcomeKey | null>(null);
  const [useful, setUseful] = useState<GoalFeedback | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("outcome");
  const [mag, setMag] = useState<MagState>("attention");
  const [bubble, setBubble] = useState<string | null>("Como terminou essa direção?");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaura estado já registrado (recarregou a página depois do check-in).
  useEffect(() => {
    if (!savedOutcome || outcome) return;
    setOutcome(savedOutcome.key);
    setUseful(savedFeedback);
    setStep(savedFeedback ? "done" : "useful");
    setMag(savedFeedback ? "neutral" : savedOutcome.mag);
    setBubble(savedFeedback ? savedOutcome.closing : "Essa direção foi útil?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOutcome?.key, savedFeedback]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function react(state: MagState, text: string, next: () => void, delay = 1150) {
    setMag(state);
    setBubble(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, delay);
  }

  const current = outcome ? OUTCOMES.find((o) => o.key === outcome)! : null;

  const impactMutation = useMutation({
    mutationFn: (text: string) =>
      submitImpact({
        data: {
          goal_id: goalId,
          useful: useful === "liked",
          direction_title: goalTitle ?? null,
          outcome_text: text.slice(0, 300),
        },
      }),
    onSuccess: (_ok, text) => {
      qc.setQueryData(impactKey, {
        useful: useful === "liked",
        outcome_text: text,
        published,
        created_at: new Date().toISOString(),
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ feedback, reason }: { feedback: GoalFeedback; reason?: string | null }) =>
      submit({
        data: {
          goal_id: goalId,
          feedback,
          goal_title: goalTitle ?? null,
          goal_category: goalCategory ?? null,
          goal_context: [
            current ? `Encerramento: ${current.label}` : null,
            reason ? `Detalhe: ${reason}` : null,
            goalContext ?? null,
          ]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 4000),
        },
      }),
    onSuccess: (_ok, { feedback }) => {
      qc.setQueryData(feedbackKey, { feedback, at: new Date().toISOString() });
    },
  });

  function chooseOutcome(key: OutcomeKey) {
    if (step !== "outcome" || impactMutation.isPending) return;
    const o = OUTCOMES.find((x) => x.key === key)!;
    setOutcome(key);
    impactMutation.mutate(o.label);
    onOutcome?.(key);
    if (key === "done") {
      qc.invalidateQueries({ queryKey: ["goal-history"] });
    }
    react(o.mag, o.reaction, () => {
      setMag("waiting");
      setBubble("Essa direção foi útil?");
      setStep("useful");
    });
    try {
      track("tool_used", { tool: "meta_checkin", value: o.label });
    } catch {
      /* ignore */
    }
  }

  function chooseUseful(feedback: GoalFeedback) {
    if (step !== "useful" || feedbackMutation.isPending) return;
    setUseful(feedback);
    feedbackMutation.mutate({ feedback });
    const positive = feedback === "liked";
    react(
      positive ? "proud" : "thinking",
      positive
        ? "Ótimo. Vou considerar isso nas próximas."
        : "Entendi. Vou refinar sua próxima direção.",
      () => {
        if (current?.followUp) {
          setMag("waiting");
          setBubble(current.followUp);
          setStep("detail");
        } else {
          finish();
        }
      },
      1400,
    );
    try {
      track("tool_used", { tool: "meta_feedback", value: feedback });
    } catch {
      /* ignore */
    }
  }

  function finish(reason?: string | null) {
    setStep("done");
    setMag(outcome === "done" ? "celebrating" : outcome === "not_done" ? "empathetic" : "confident");
    setBubble(outcome === "done" ? "Boa. Você avançou." : (current?.closing ?? "Seguimos."));
    if (reason && current) {
      impactMutation.mutate(`${current.label} · ${reason}`);
      if (useful) feedbackMutation.mutate({ feedback: useful, reason });
    }
    // Transição suave: por padrão vai para a Jornada; quando a Home controla
    // o estado do card, ela recebe o aviso e reage no próprio lugar.
    if (timer.current) clearTimeout(timer.current);
    const label = outcome === "done" ? "Direção concluída" : "Check-in concluído";
    timer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["goal-history"] });
      if (onFinished) {
        onFinished(label);
        return;
      }
      navigate({ to: "/jornada", search: { r: label } });
    }, 1100);
  }



  function chooseDetail(chip: string) {
    if (step !== "detail") return;
    setDetail(chip);
    finish(chip);
  }

  const registeredAt = impactRow?.created_at ?? feedbackRow?.at ?? null;
  const showShare = step === "done" && useful === "liked" && outcome === "done";

  return (
    <div className="mt-5">
      <div
        className="rounded-[20px] p-3.5"
        style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
      >
        {/* MAG conduz */}
        <div className="flex items-start gap-2.5">
          <MagFull state={mag} size={44} className="-mt-1 shrink-0" />
          <div className="min-w-0 flex-1 pt-0.5">
            <MagBubble message={bubble} />
          </div>
        </div>

        <div className="mt-3 pl-[52px]">
          <AnimatePresence mode="wait">
            {step === "outcome" && (
              <StepBlock key="outcome">
                <ChipRow>
                  {OUTCOMES.map((o) => (
                    <Chip key={o.key} label={o.label} onClick={() => chooseOutcome(o.key)} />
                  ))}
                </ChipRow>
              </StepBlock>
            )}

            {step === "useful" && (
              <StepBlock key="useful">
                <ChipRow>
                  <Chip label="Sim, foi útil" onClick={() => chooseUseful("liked")} />
                  <Chip label="Não foi útil" onClick={() => chooseUseful("disliked")} />
                </ChipRow>
              </StepBlock>
            )}

            {step === "detail" && current?.followUp && (
              <StepBlock key="detail">
                <ChipRow>
                  {current.chips.map((c) => (
                    <Chip key={c} label={c} onClick={() => chooseDetail(c)} />
                  ))}
                  <Chip label="Pular" subtle onClick={() => finish()} />
                </ChipRow>
              </StepBlock>
            )}

            {step === "done" && (
              <StepBlock key="done">
                <div className="flex flex-wrap items-center gap-2">
                  {current && <Chip label={current.label} active />}
                  {useful && <Chip label={useful === "liked" ? "Foi útil" : "Não foi útil"} active />}
                  {detail && <Chip label={detail} active />}
                </div>
                <p
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px]"
                  style={{ color: MUTED }}
                >
                  <Check className="h-3 w-3" strokeWidth={2} style={{ color: GREEN }} />
                  {`Check-in registrado · ${timeLabel(registeredAt)}`}
                </p>
              </StepBlock>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showShare && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-5 border-t pt-5"
          style={{ borderColor: HAIRLINE }}
        >
          <ImpactActions
            goalId={goalId}
            metaText={goalTitle ?? "Sua MAG Meta de hoje"}
            impactText={detail ? `${current?.label} · ${detail}` : (current?.label ?? "Concluí")}
            alreadyPublished={published}
            onPublished={() => qc.invalidateQueries({ queryKey: impactKey })}
          />
        </motion.div>
      )}
    </div>
  );
}

function StepBlock({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  label,
  onClick,
  active,
  subtle,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-full px-3 py-1.5 text-[12px] transition active:scale-[0.98] disabled:cursor-default"
      style={{
        background: active ? BLUE_SOFT : "#FFFFFF",
        color: active ? BLUE : subtle ? "#9A9AA0" : MUTED,
        border: `1px solid ${active ? BLUE_BORDER : HAIRLINE}`,
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </button>
  );
}
