import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Briefcase,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Heart,
  HelpCircle,
  Pencil,
  Target,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import {
  getWeeklyFocus,
  setWeeklyFocus,
  updateWeeklyFocus,
  type WeeklyFocusView,
  answerFocusClarification,
  chooseMainFocus,
} from "@/lib/weekly-focus.functions";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";
const BORDER = "#ECEDF0";
/** Opção "Ainda não sei" tratada como card selecionável. */
const UNSURE = "__unsure__";

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Áreas de apoio — usadas apenas para conduzir a conversa, nunca como foco pronto. */
const AREAS: { key: string; label: string; phrase: string }[] = [
  { key: "pessoal", label: "Vida pessoal", phrase: "minha vida pessoal" },
  { key: "trabalho", label: "Trabalho", phrase: "meu trabalho" },
  { key: "estudos", label: "Estudos", phrase: "meus estudos" },
  { key: "saude", label: "Saúde e bem-estar", phrase: "minha saúde e bem-estar" },
  { key: "financas", label: "Finanças", phrase: "minhas finanças" },
  { key: "rotina", label: "Rotina", phrase: "minha rotina" },
];

const INTENTS: { key: string; label: string; verb: string }[] = [
  { key: "avancar", label: "Avançar", verb: "Avançar em" },
  { key: "organizar", label: "Organizar", verb: "Organizar" },
  { key: "resolver", label: "Resolver", verb: "Resolver algo em" },
  { key: "cuidar", label: "Cuidar", verb: "Cuidar de" },
];

const FOCUS_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "economizar", label: "Economizar", icon: Target },
  { key: "organizar-rotina", label: "Organizar minha rotina", icon: CalendarDays },
  { key: "alimentacao", label: "Melhorar minha alimentação", icon: Apple },
  { key: "saude", label: "Cuidar da minha saúde", icon: Heart },
  { key: "trabalho", label: "Focar no trabalho", icon: Briefcase },
  { key: "estudos", label: "Estudar mais", icon: BookOpen },
  { key: "tarefas", label: "Colocar tarefas em dia", icon: CheckSquare },
  { key: "constancia", label: "Ter mais constância", icon: TrendingUp },
];

import { interpretFocus as interpret, nextMonday, sundayEnd } from "@/lib/mag/focus-week";
import { clarificationFor } from "@/lib/mag/focus-clarify";

/** O Foco da Semana sempre termina no domingo do fuso do usuário. */
function defaultEnd(localDate: string): string {
  return sundayEnd(localDate);
}

function weekdayLabel(date: string): string {
  return WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "";
}

type Step = "idle" | "pick" | "write" | "helper" | "context" | "confirm";
type Period = "week" | "today" | "next_week";

export function WeeklyFocusCard({
  localDate,
  className = "",
}: {
  localDate: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const fetchFocus = useServerFn(getWeeklyFocus);
  const save = useServerFn(setWeeklyFocus);
  const update = useServerFn(updateWeeklyFocus);
  const sendAnswer = useServerFn(answerFocusClarification);
  const pickMain = useServerFn(chooseMainFocus);

  const [step, setStep] = useState<Step>("idle");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [contextAnswer, setContextAnswer] = useState<string | null>(null);
  const [contextOther, setContextOther] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [otherAnswer, setOtherAnswer] = useState("");
  /** Escolha do foco principal quando o usuário trouxe mais de um objetivo. */
  const [picked, setPicked] = useState<string | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { data } = useQuery<WeeklyFocusView>({
    queryKey: ["weekly-focus", localDate],
    queryFn: () => fetchFocus({ data: { local_date: localDate } }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const focus = data?.focus ?? null;

  // Foco automático + rolagem mínima para manter campo e botão visíveis.
  useEffect(() => {
    if (step !== "write" && step !== "pick") return;
    const t = setTimeout(() => {
      if (step === "write") taRef.current?.focus();
      cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 260);
    return () => clearTimeout(t);
  }, [step]);

  /* A Direção do Dia pede o foco: o próprio card abre pronto para escolher. */
  useEffect(() => {
    const open = () => {
      const currentLabel = focus?.interpreted ?? "";
      const matched =
        FOCUS_OPTIONS.find((o) => o.label.toLowerCase() === currentLabel.toLowerCase())?.label ?? null;
      if (focus) {
        setMode("edit");
        setText(focus.interpreted ?? "");
        setSelectedOption(matched);
        setPeriod("week");
      } else {
        setMode("create");
        setText("");
        setSelectedOption(null);
        setPeriod("week");
      }
      setStep("pick");
      setShowMore(false);
    };
    window.addEventListener("imag:define-focus", open);
    return () => window.removeEventListener("imag:define-focus", open);
  }, [focus, localDate]);

  const create = useMutation({
    mutationFn: async () =>
      save({
        data: {
          raw_text: text.trim(),
          start_date: localDate,
          period,
          clarify_answer: contextAnswer,
        },
      }),
    onSuccess: () => {
      haptic([8, 24]);
      finishSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar agora."),
  });

  const edit = useMutation({
    mutationFn: async (patch: {
      id: string;
      interpreted?: string;
      end_date?: string;
      status?: "active" | "paused" | "completed" | "partial" | "ended";
    }) => update({ data: patch }),
    onSuccess: () => {
      haptic(8);
      finishSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar agora."),
  });

  function finishSaved() {
    setStep("idle");
    setExpanded(false);
    setText("");
    setArea(null);
    setPeriod("week");
    setContextAnswer(null);
    setContextOther("");
    setSelectedOption(null);
    setShowMore(false);
    qc.invalidateQueries({ queryKey: ["weekly-focus"] });
    qc.invalidateQueries({ queryKey: ["today-meta"] });
  }

  const answer = useMutation({
    mutationFn: async (value: string) =>
      sendAnswer({ data: { id: focus!.id, answer: value } }),
    onSuccess: () => {
      haptic([6, 18]);
      setOtherAnswer("");
      qc.invalidateQueries({ queryKey: ["weekly-focus"] });
      qc.invalidateQueries({ queryKey: ["today-meta"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar sua resposta agora."),
  });

  /** Confirma qual objetivo vira o foco principal da semana. */
  const choose = useMutation({
    mutationFn: async (input: { choice: string; keep_other: boolean }) =>
      pickMain({ data: { id: focus!.id, ...input } }),
    onSuccess: () => {
      haptic([8, 24]);
      setPicked(null);
      setShowAdvice(false);
      qc.invalidateQueries({ queryKey: ["weekly-focus"] });
      qc.invalidateQueries({ queryKey: ["today-meta"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar sua escolha agora."),
  });

  /* Período do foco resolvido a partir de uma única escolha explícita. */
  const end =
    period === "today"
      ? localDate
      : period === "next_week"
        ? sundayEnd(nextMonday(localDate))
        : defaultEnd(localDate);
  const startsOn = period === "next_week" ? nextMonday(localDate) : localDate;
  /* Pergunta essencial de contexto — feita ANTES da confirmação. */
  const clarify = clarificationFor(interpret(text));

  const busy = create.isPending || edit.isPending;
  const canContinue = text.trim().length >= 3;

  const choosing = Boolean(focus && data?.awaiting_choice);
  const awaiting = Boolean(data?.awaiting_clarification && focus) && !choosing;


  const editor = (
    <div className="px-4 pb-4">
      <AnimatePresence mode="wait" initial={false}>
        {step === "pick" ? (
          <motion.div
            key="pick"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-[15px] font-semibold leading-[1.3]" style={{ color: INK }}>
              Qual seu foco essa semana?
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {FOCUS_OPTIONS.map((opt) => {
                const selected = selectedOption === opt.label;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      haptic(4);
                      setSelectedOption(selected ? null : opt.label);
                    }}
                    className="relative flex items-center gap-2.5 rounded-[16px] border px-3 py-3 text-left transition active:scale-[0.98]"
                    style={{
                      background: selected ? "#EEF2FF" : "#FFFFFF",
                      borderColor: selected ? BLUE : BORDER,
                      color: selected ? BLUE : INK,
                    }}
                  >
                    <Icon
                      className="h-[18px] w-[18px] shrink-0"
                      style={{ color: selected ? BLUE : BLUE }}
                    />
                    <span className="flex-1 text-[13px] font-medium leading-[1.25]">
                      {opt.label}
                    </span>
                    {selected ? (
                      <div
                        className="grid h-5 w-5 place-items-center rounded-full"
                        style={{ background: BLUE }}
                      >
                        <Check className="h-3.5 w-3.5" style={{ color: "#FFFFFF" }} />
                      </div>
                    ) : null}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  haptic(4);
                  setSelectedOption(selectedOption === UNSURE ? null : UNSURE);
                }}
                className="relative flex items-center gap-2.5 rounded-[16px] border px-3 py-3 text-left transition active:scale-[0.98]"
                style={{
                  background: selectedOption === UNSURE ? "#EEF2FF" : "#FFFFFF",
                  borderColor: selectedOption === UNSURE ? BLUE : BORDER,
                  color: selectedOption === UNSURE ? BLUE : MUTED,
                }}
              >
                <HelpCircle className="h-[18px] w-[18px] shrink-0" style={{ color: BLUE }} />
                <span className="flex-1 text-[13px] font-medium leading-[1.25]">
                  Ainda não sei
                </span>
                {selectedOption === UNSURE ? (
                  <div
                    className="grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: BLUE }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: "#FFFFFF" }} />
                  </div>
                ) : null}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showMore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p
                    className="mt-3 text-[12.5px] font-light leading-[1.45]"
                    style={{ color: MUTED }}
                  >
                    {area
                      ? "O que você quer fazer nessa área agora?"
                      : "Qual área está pedindo mais atenção agora?"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!area
                      ? AREAS.map((a) => (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => {
                              haptic(4);
                              setArea(a.key);
                            }}
                            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                            style={{ background: "#F4F6FB", color: BLUE }}
                          >
                            {a.label}
                          </button>
                        ))
                      : INTENTS.map((i) => (
                          <button
                            key={i.key}
                            type="button"
                            onClick={() => {
                              haptic(4);
                              const a = AREAS.find((x) => x.key === area);
                              setText(`${i.verb} ${a?.phrase ?? "essa área"}`);
                              setArea(null);
                              setSelectedOption(null);
                              setStep("confirm");
                            }}
                            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                            style={{ background: "#F4F6FB", color: BLUE }}
                          >
                            {i.label}
                          </button>
                        ))}
                    <button
                      type="button"
                      onClick={() => {
                        haptic(4);
                        setArea(null);
                        setSelectedOption(null);
                        setStep("write");
                      }}
                      className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                      style={{ background: "#F7F8FA", color: MUTED }}
                    >
                      Explicar para a MAG
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              disabled={!selectedOption || busy}
              onClick={() => {
                haptic(6);
                if (!selectedOption) return;
                if (selectedOption === UNSURE) {
                  setSelectedOption(null);
                  setStep("idle");
                  setExpanded(false);
                  return;
                }
                if (mode === "edit" && focus) {
                  const next = selectedOption.trim();
                  if (next.toLowerCase() === (focus.interpreted ?? "").toLowerCase()) {
                    finishSaved();
                    return;
                  }
                  edit.mutate({
                    id: focus.id,
                    interpreted: next,
                    end_date: focus.end_date ?? defaultEnd(localDate),
                  });
                  return;
                }
                setText(selectedOption);
                setStep("confirm");
              }}
              className="mt-3.5 w-full rounded-[16px] px-4 py-3 text-[14px] font-semibold text-white transition-opacity duration-200 disabled:opacity-40"
              style={{ background: BLUE }}
            >
              Continuar
            </button>

            <div className="mt-3 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  haptic(4);
                  setShowMore((v) => !v);
                }}
                className="flex items-center gap-1 text-[12.5px] font-light transition active:opacity-60"
                style={{ color: MUTED }}
              >
                Ver mais
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform"
                  style={{
                    color: MUTED,
                    transform: showMore ? "rotate(180deg)" : "none",
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic(4);
                  setText(mode === "edit" ? (focus?.interpreted ?? "") : "");
                  setSelectedOption(null);
                  setArea(null);
                  setStep("write");
                }}
                className="flex items-center gap-1 text-[12.5px] font-medium transition active:opacity-60"
                style={{ color: BLUE }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Escrever meu foco
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic(4);
                setStep("idle");
                setExpanded(false);
              }}
              className="mt-1 w-full py-2 text-[12.5px] font-light transition active:opacity-60"
              style={{ color: MUTED }}
            >
              Cancelar
            </button>
          </motion.div>
        ) : step === "write" || step === "helper" ? (
          <motion.div
            key="write"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-[15px] font-semibold leading-[1.3]" style={{ color: INK }}>
              {mode === "edit" ? "Ajustar seu foco" : "Escrever meu próprio foco"}
            </p>

            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              aria-label="Foco da semana"
              placeholder="Ex.: organizar uma pendência, avançar em um projeto ou cuidar melhor da minha rotina…"
              className="mt-2.5 w-full resize-none rounded-[16px] px-3.5 py-3 text-[16px] font-light leading-[1.5] outline-none"
              style={{ background: "#F6F7FA", color: INK, border: `1px solid ${BORDER}` }}
            />

            <AnimatePresence initial={false}>
              {step === "helper" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p
                    className="mt-3 text-[12.5px] font-light leading-[1.45]"
                    style={{ color: MUTED }}
                  >
                    {area
                      ? "O que você quer fazer nessa área agora?"
                      : "Qual área está pedindo mais atenção agora?"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!area
                      ? AREAS.map((a) => (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => {
                              haptic(4);
                              setArea(a.key);
                            }}
                            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                            style={{ background: "#F4F6FB", color: BLUE }}
                          >
                            {a.label}
                          </button>
                        ))
                      : INTENTS.map((i) => (
                          <button
                            key={i.key}
                            type="button"
                            onClick={() => {
                              haptic(4);
                              const a = AREAS.find((x) => x.key === area);
                              setText(`${i.verb} ${a?.phrase ?? "essa área"}`);
                              setArea(null);
                              setStep("write");
                            }}
                            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                            style={{ background: "#F4F6FB", color: BLUE }}
                          >
                            {i.label}
                          </button>
                        ))}
                    <button
                      type="button"
                      onClick={() => {
                        haptic(4);
                        setArea(null);
                        setStep("write");
                      }}
                      className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                      style={{ background: "#F7F8FA", color: MUTED }}
                    >
                      Explicar para a MAG
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                disabled={!canContinue || busy}
                onClick={() => {
                  haptic(6);
                  /* Foco amplo: a MAG entende o contexto antes de confirmar. */
                  setStep(clarify && mode === "create" ? "context" : "confirm");
                }}
                className="flex-1 rounded-[16px] px-4 py-3 text-[14px] font-semibold text-white transition-opacity duration-200 disabled:opacity-40"
                style={{ background: BLUE }}
              >
                Continuar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  haptic(4);
                  setArea(null);
                  setStep("pick");
                }}
                className="px-2 py-3 text-[13px] font-light transition active:opacity-60"
                style={{ color: MUTED }}
              >
                Ainda não sei
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic(4);
                setStep("idle");
                setExpanded(false);
              }}
              className="mt-1 w-full py-2 text-[12.5px] font-light transition active:opacity-60"
              style={{ color: MUTED }}
            >
              Cancelar
            </button>
          </motion.div>
        ) : step === "context" ? (
          <motion.div
            key="context"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-[14px] font-semibold leading-[1.3]" style={{ color: INK }}>
              {clarify?.question ?? "O que mais pesa nesse objetivo hoje?"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(clarify?.options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    haptic(4);
                    setContextAnswer(opt);
                    setStep("confirm");
                  }}
                  className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                  style={{ background: "#F4F6FB", color: BLUE }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              value={contextOther}
              onChange={(e) => setContextOther(e.target.value)}
              placeholder="Ou escreva em poucas palavras…"
              aria-label="Contexto do foco"
              className="mt-3 w-full rounded-[14px] px-3.5 py-3 text-[16px] font-light outline-none"
              style={{ background: "#F6F7FA", color: INK, border: `1px solid ${BORDER}` }}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  haptic(6);
                  setContextAnswer(contextOther.trim() || null);
                  setStep("confirm");
                }}
                className="flex-1 rounded-[16px] px-4 py-3 text-[14px] font-semibold text-white transition"
                style={{ background: BLUE }}
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic(4);
                  setStep("pick");
                }}
                className="px-2 py-3 text-[13px] font-light transition active:opacity-60"
                style={{ color: MUTED }}
              >
                Voltar
              </button>
            </div>
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-[15px] font-semibold leading-[1.35]" style={{ color: INK }}>
              {interpret(text)}
            </p>
            <p className="mt-2 text-[12.5px] font-light" style={{ color: MUTED }}>
              {period === "today"
                ? "Vale só para hoje"
                : period === "next_week"
                  ? `Começa segunda-feira (${startsOn.slice(8, 10)}/${startsOn.slice(5, 7)}) e termina domingo (${end.slice(8, 10)}/${end.slice(5, 7)})`
                  : `Termina domingo (${end.slice(8, 10)}/${end.slice(5, 7)})`}
            </p>
            {contextAnswer ? (
              <p className="mt-1 text-[12.5px] font-light" style={{ color: MUTED }}>
                Contexto: {contextAnswer}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: "week" as const, label: "Até domingo" },
                { key: "today" as const, label: "Usar só hoje" },
                { key: "next_week" as const, label: "Começar segunda-feira" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    haptic(4);
                    setPeriod(opt.key);
                  }}
                  className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                  style={{
                    background: period === opt.key ? BLUE : "#F4F6FB",
                    color: period === opt.key ? "#FFFFFF" : BLUE,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  haptic(4);
                  setStep("pick");
                }}
                className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition active:scale-[0.98]"
                style={{ background: "#F7F8FA", color: MUTED }}
              >
                Ajustar
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (busy) return;
                if (mode === "edit" && focus) {
                  edit.mutate({
                    id: focus.id,
                    interpreted: interpret(text),
                    end_date: end,
                  });
                } else {
                  create.mutate();
                }
              }}
              className="mt-3.5 w-full rounded-[16px] px-4 py-3 text-[14px] font-semibold text-white transition disabled:opacity-60"
              style={{ background: BLUE }}
            >
              {busy ? "Salvando…" : "Confirmar foco"}
            </button>

            {mode === "edit" && focus ? (
              <div className="mt-2 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => edit.mutate({ id: focus.id, status: "completed" })}
                  className="py-2 text-[12.5px] font-light transition active:opacity-60"
                  style={{ color: MUTED }}
                >
                  Concluir foco
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => edit.mutate({ id: focus.id, status: "paused" })}
                  className="py-2 text-[12.5px] font-light transition active:opacity-60"
                  style={{ color: MUTED }}
                >
                  Pausar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => edit.mutate({ id: focus.id, status: "ended" })}
                  className="py-2 text-[12.5px] font-light transition active:opacity-60"
                  style={{ color: "#C2453C" }}
                >
                  Encerrar
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const editing = step !== "idle";
  /* Semana encerrada: a direção anterior não vale como atual. */
  const expired = Boolean(focus) && (data?.days_left ?? 0) < 0;

  return (
    <section className={className} data-tour="weekly-focus">
      <div
        ref={cardRef}
        className="overflow-hidden"
        style={{ background: "#FFFFFF", borderBottom: "1px solid #F2F3F6" }}
      >
        {!focus ? (
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => {
                haptic(6);
                setMode("create");
                setPeriod("week");
                setSelectedOption(null);
                setShowMore(false);
                setStep("pick");
              }}
              className="flex w-full items-center gap-2.5 text-left transition active:opacity-70"
            >
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
                style={{ background: "#F4F6FD" }}
              >
                <Target className="h-[15px] w-[15px]" style={{ color: BLUE }} />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="block text-[10px] font-medium uppercase"
                  style={{ color: "#8A90A3", letterSpacing: "0.12em" }}
                >
                  Foco da Semana
                </span>
                <span
                  className="block truncate text-[15px] font-medium leading-tight"
                  style={{ color: INK }}
                >
                  Definir foco da semana
                </span>
              </div>
              <ChevronRight
                className="h-[14px] w-[14px] shrink-0"
                strokeWidth={1.6}
                style={{ color: "#C9CDD6" }}
              />
            </button>
          </div>
        ) : (
          <>
            <div className="flex w-full items-center gap-2.5 px-4 py-2 text-left">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
                style={{ background: "#F4F6FD" }}
              >
                <Target className="h-[15px] w-[15px]" style={{ color: BLUE }} />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="block text-[10px] font-medium uppercase"
                  style={{ color: "#8A90A3", letterSpacing: "0.12em" }}
                >
                  Foco da Semana
                </span>
                <span
                  className="block truncate text-[15px] font-medium leading-tight"
                  style={{ color: INK }}
                >
                  {focus.interpreted}
                </span>
              </div>
              <button
                type="button"
                aria-label="Editar foco da semana"
                onClick={() => {
                  haptic(4);
                  setMode("edit");
                  setText(focus.interpreted ?? "");
                  const matched =
                    FOCUS_OPTIONS.find(
                      (o) => o.label.toLowerCase() === (focus.interpreted ?? "").toLowerCase(),
                    )?.label ?? null;
                  setSelectedOption(matched);
                  setPeriod("week");
                  setShowMore(false);
                  setStep("pick");
                }}
                className="shrink-0 p-1.5 transition active:opacity-60"
                style={{ color: BLUE }}
              >
                <Pencil className="h-[16px] w-[16px]" strokeWidth={1.8} />
              </button>
            </div>

            {choosing ? (
              <div className="px-4 pb-4">
                <div className="h-px w-full" style={{ background: "#F2F3F6" }} />
                <p className="mt-3 text-[13.5px] font-medium leading-[1.4]" style={{ color: INK }}>
                  Você trouxe mais de um objetivo importante. Qual deles merece ser seu foco
                  principal agora?
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {(focus.pending_options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={choose.isPending}
                      onClick={() => {
                        haptic(6);
                        setPicked(opt);
                      }}
                      className="w-full rounded-[14px] px-3.5 py-2.5 text-left text-[13.5px] font-medium transition active:scale-[0.99] disabled:opacity-50"
                      style={{
                        background: picked === opt ? BLUE : "#F1F4FF",
                        color: picked === opt ? "#FFFFFF" : BLUE,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                  {!picked ? (
                    <button
                      type="button"
                      onClick={() => {
                        haptic(4);
                        setShowAdvice(true);
                      }}
                      className="w-full rounded-[14px] px-3.5 py-2.5 text-left text-[12.5px] font-light transition active:opacity-60"
                      style={{ background: "#F7F8FA", color: MUTED }}
                    >
                      Me ajude a escolher
                    </button>
                  ) : null}
                </div>

                {showAdvice && focus.recommendation && !picked ? (
                  <div
                    className="mt-3 rounded-[14px] px-3.5 py-3"
                    style={{ background: "#F7F8FA" }}
                  >
                    <p className="text-[12.5px] font-light leading-[1.5]" style={{ color: INK }}>
                      Pelo que você compartilhou, eu começaria por{" "}
                      <span className="font-semibold">
                        {focus.recommendation.split(" — ")[0]}
                      </span>
                      , porque {focus.recommendation.split(" — ")[1] ?? "dá para avançar já nesta semana"}.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          haptic(6);
                          setPicked(focus.recommendation!.split(" — ")[0] ?? null);
                        }}
                        className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                        style={{ background: BLUE, color: "#FFFFFF" }}
                      >
                        Seguir com esse foco
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptic(4);
                          setShowAdvice(false);
                        }}
                        className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                        style={{ background: "#EEF2FF", color: BLUE }}
                      >
                        Escolher o outro
                      </button>
                    </div>
                  </div>
                ) : null}

                {picked ? (
                  <div className="mt-3">
                    <p className="text-[12.5px] font-light leading-[1.45]" style={{ color: MUTED }}>
                      Quer guardar o outro objetivo para uma próxima semana?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate({ choice: picked, keep_other: true })}
                        className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-50"
                        style={{ background: BLUE, color: "#FFFFFF" }}
                      >
                        {choose.isPending ? "Salvando…" : "Guardar para depois"}
                      </button>
                      <button
                        type="button"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate({ choice: picked, keep_other: false })}
                        className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-50"
                        style={{ background: "#F4F6FB", color: INK }}
                      >
                        Não precisa
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {awaiting && focus.clarify_question ? (
              <div className="px-4 pb-4">
                <div className="h-px w-full" style={{ background: "#F2F3F6" }} />
                <p className="mt-3 text-[13.5px] font-medium leading-[1.4]" style={{ color: INK }}>
                  {focus.clarify_question}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(focus.clarify_options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={answer.isPending}
                      onClick={() => {
                        if (opt === "Explicar para a MAG") {
                          setOtherAnswer(otherAnswer || " ");
                          return;
                        }
                        answer.mutate(opt);
                      }}
                      className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-50"
                      style={{ background: "#F1F4FF", color: BLUE }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {otherAnswer ? (
                  <div className="mt-3">
                    <textarea
                      value={otherAnswer.trim() ? otherAnswer : ""}
                      onChange={(e) => setOtherAnswer(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="Conte para a MAG o que está pegando de verdade."
                      className="w-full resize-none rounded-2xl px-3.5 py-3 text-[14px] outline-none"
                      style={{ background: "#F7F8FA", color: INK, border: "1px solid #ECEDF0" }}
                    />
                    <button
                      type="button"
                      disabled={answer.isPending || otherAnswer.trim().length < 3}
                      onClick={() => answer.mutate(otherAnswer.trim())}
                      className="mt-2 rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98] disabled:opacity-50"
                      style={{ background: BLUE, color: "#FFFFFF" }}
                    >
                      {answer.isPending ? "Enviando…" : "Enviar para a MAG"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {expired && !editing ? (
              <div className="px-4 pb-4">
                <div className="h-px w-full" style={{ background: "#F2F3F6" }} />
                <p className="mt-3 text-[13.5px] font-semibold leading-[1.3]" style={{ color: INK }}>
                  Qual será seu foco agora?
                </p>
                <p className="mt-1 text-[12.5px] font-light leading-[1.45]" style={{ color: MUTED }}>
                  Você pode continuar o anterior, ajustar ou começar outro.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      haptic(6);
                      edit.mutate({ id: focus.id, end_date: defaultEnd(localDate) });
                    }}
                    className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                    style={{ background: BLUE, color: "#FFFFFF" }}
                  >
                    Continuar foco
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      haptic(6);
                      setMode("edit");
                      setText(focus.interpreted ?? "");
                      const matched =
                        FOCUS_OPTIONS.find(
                          (o) => o.label.toLowerCase() === (focus.interpreted ?? "").toLowerCase(),
                        )?.label ?? null;
                      setSelectedOption(matched);
                      setPeriod("week");
                      setShowMore(false);
                      setStep("pick");
                    }}
                    className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                    style={{ background: "#EEF2FF", color: BLUE }}
                  >
                    Ajustar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      haptic(6);
                      setMode("create");
                      setText("");
                      setSelectedOption(null);
                      setPeriod("week");
                      setShowMore(false);
                      setStep("pick");
                    }}
                    className="rounded-full px-3.5 py-2 text-[12.5px] font-medium transition active:scale-[0.98]"
                    style={{ background: "#F4F6FB", color: INK }}
                  >
                    Novo foco
                  </button>
                </div>
              </div>
            ) : null}

          </>
        )}

        <AnimatePresence initial={false}>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {editor}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
