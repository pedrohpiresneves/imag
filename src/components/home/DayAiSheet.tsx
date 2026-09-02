import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Mic, Square, X } from "lucide-react";
import { applyMyDay, planMyDay, type DayPlan } from "@/lib/day-ai.functions";
import {
  MagAvatarMascot,
  MagBubble,
  MAG_PHRASES,
  magPhrase,
} from "@/components/mag/MagMascot";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";
const HAIR = "#ECECEF";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: Recognition = new Ctor();
  r.lang = "pt-BR";
  r.continuous = true;
  r.interimResults = true;
  return r;
}

/** Entrada inteligente do Meu dia: texto/voz → prioridades, compromissos e nota. */
export function DayAiSheet({
  open,
  localDate,
  onClose,
  onApplied,
}: {
  open: boolean;
  localDate: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [thinkingLine, setThinkingLine] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const plan_ = useServerFn(planMyDay);
  const apply_ = useServerFn(applyMyDay);

  useEffect(() => {
    if (open) requestAnimationFrame(() => areaRef.current?.focus());
    if (!open) {
      recRef.current?.stop();
      setText("");
      setPlan(null);
      setError(null);
    }
  }, [open]);

  const mPlan = useMutation({
    mutationFn: (value: string) => plan_({ data: { text: value, local_date: localDate } }),
    onSuccess: (res) => {
      setPlan(res);
      setError(null);
    },
    onError: () => setError("Não consegui organizar agora."),
  });

  const mApply = useMutation({
    mutationFn: (p: DayPlan) => apply_({ data: { local_date: localDate, ...p } }),
    onSuccess: () => {
      onApplied();
      onClose();
    },
    onError: () => setError("Não consegui adicionar agora."),
  });

  useEffect(() => {
    if (!mPlan.isPending) {
      setThinkingLine(null);
      return;
    }
    setThinkingLine(magPhrase(MAG_PHRASES.organizeStart));
    const t = setInterval(() => setThinkingLine(magPhrase(MAG_PHRASES.organizing)), 2200);
    return () => clearInterval(t);
  }, [mPlan.isPending]);

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      setVoiceUnavailable(true);
      return;
    }
    baseRef.current = text ? `${text} ` : "";
    rec.onresult = (e: any) => {
      let out = "";
      for (let i = 0; i < e.results.length; i += 1) out += e.results[i][0].transcript;
      setText(baseRef.current + out);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function submit() {
    const v = text.trim();
    if (v.length < 2 || mPlan.isPending) return;
    recRef.current?.stop();
    mPlan.mutate(v);
  }

  const empty = plan && !plan.priorities.length && !plan.events.length && !plan.note;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[6px]" onClick={onClose} />
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="relative mb-[calc(112px+env(safe-area-inset-bottom))] w-full max-w-[520px] rounded-[26px] px-5 pb-6 pt-5 sm:mb-0 sm:rounded-[26px]"
            style={{
              background: "#FFFFFF",
              width: "calc(100% - 24px)",
              boxShadow: "0 24px 60px -20px rgba(15,23,42,0.28)",
              maxHeight: "calc(100dvh - 200px)",
              overflowY: "auto",
            }}
          >
            <button
              aria-label="Fechar"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5"
              style={{ color: "#A8ACB6" }}
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>

            {!plan ? (
              <>
                <div className="flex items-start gap-3">
                  <MagAvatarMascot
                    state={mPlan.isPending ? "organizing" : listening ? "waiting" : "attention"}
                    size={34}
                  />
                  <div className="min-w-0 pr-6">
                    <h3
                      className="text-[20px] font-semibold leading-tight"
                      style={{ color: INK, letterSpacing: "-0.02em" }}
                    >
                      {mPlan.isPending ? "Deixa comigo." : "O que você precisa resolver hoje?"}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: MUTED }}>
                      {mPlan.isPending
                        ? "Estou organizando seu dia."
                        : "Pode escrever do seu jeito. A MAG organiza para você."}
                    </p>
                    {mPlan.isPending && thinkingLine && (
                      <MagBubble message={thinkingLine} className="mt-2.5" />
                    )}
                  </div>
                </div>


                <textarea
                  ref={areaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                  }}
                  rows={4}
                  placeholder="Ex.: responder pacientes, pagar fornecedores e consulta às 15h"
                  className="mt-4 w-full resize-none rounded-[16px] px-3.5 py-3 text-[15px] leading-[1.5] outline-none"
                  style={{ color: INK, border: `1px solid ${HAIR}` }}
                />
                {listening && (
                  <p className="mt-1.5 flex items-center gap-2 text-[12px]" style={{ color: BLUE }}>
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ background: BLUE }}
                    />
                    Ouvindo…
                  </p>
                )}
                {voiceUnavailable && !listening && (
                  <p className="mt-1.5 text-[12px]" style={{ color: MUTED }}>
                    Seu navegador não suporta ditado. Pode escrever aqui.
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    aria-label={listening ? "Parar" : "Falar"}
                    className="grid h-10 w-10 place-items-center rounded-full transition"
                    style={
                      listening
                        ? { background: BLUE, color: "#FFFFFF" }
                        : { border: `1px solid ${HAIR}`, color: INK }
                    }
                  >
                    {listening ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={text.trim().length < 2 || mPlan.isPending}
                    aria-label="Organizar"
                    className="grid h-10 w-10 place-items-center rounded-full text-white transition disabled:opacity-30"
                    style={{ background: BLUE }}
                  >
                    {mPlan.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p
                  className="flex items-center gap-2.5 pr-8 text-[15px] font-medium"
                  style={{ color: INK }}
                >
                  <MagAvatarMascot state="proud" size={30} />
                  Organizei por prioridade.
                </p>


                {empty ? (
                  <p className="mt-4 text-[13.5px]" style={{ color: MUTED }}>
                    Não identifiquei tarefas nem compromissos. Tente descrever com mais
                    detalhes.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {plan.priorities.length > 0 && (
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{ color: BLUE }}
                        >
                          Tarefas
                        </p>
                        <ul className="mt-1.5 grid gap-1">
                          {plan.priorities.map((p) => (
                            <li key={p} className="text-[14.5px] leading-[1.45]" style={{ color: INK }}>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {plan.events.length > 0 && (
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{ color: BLUE }}
                        >
                          Próximo compromisso
                        </p>
                        <ul className="mt-1.5 grid gap-1">
                          {plan.events.map((e) => (
                            <li
                              key={`${e.start_time}-${e.title}`}
                              className="flex items-baseline justify-between gap-3 text-[14.5px] leading-[1.45]"
                              style={{ color: INK }}
                            >
                              <span className="min-w-0 truncate">{e.title}</span>
                              <span className="shrink-0 tabular-nums text-[13px]" style={{ color: MUTED }}>
                                Hoje · {e.start_time}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {plan.note && (
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{ color: MUTED }}
                        >
                          Nota
                        </p>
                        <p className="mt-1.5 text-[14px] leading-[1.45]" style={{ color: INK }}>
                          {plan.note}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => plan && mApply.mutate(plan)}
                    disabled={!!empty || mApply.isPending}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-medium text-white transition disabled:opacity-40"
                    style={{ background: BLUE }}
                  >
                    {mApply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Adicionar ao meu dia
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan(null)}
                    className="rounded-full px-4 py-3 text-[14px] font-medium"
                    style={{ border: `1px solid ${HAIR}`, color: INK }}
                  >
                    Editar
                  </button>
                </div>
              </>
            )}

            {error && (
              <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-[1.45]" style={{ color: MUTED }}>
                <MagAvatarMascot state="empathetic" size={22} />
                <span>{error} Tente de novo em instantes.</span>
              </p>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
