import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, X } from "lucide-react";
import { createCircle, setCircleFocus } from "@/lib/circles.functions";
import { InvitePanel } from "./InvitePanel";

const HAIR = "#E9EBEF";
const BLUE = "#335CFF";

type Kind = "daily" | "streak" | "count" | "custom";

const NAME_EXAMPLES = [
  "Vendas de Agosto",
  "30 dias de foco",
  "Projeto Verão",
  "Time Comercial",
  "Consistência",
];

const CHALLENGES: { kind: Kind; label: string; text: string; target: number | null }[] = [
  {
    kind: "daily",
    label: "Concluir direções diariamente",
    text: "Concluir 1 direção por dia.",
    target: 1,
  },
  {
    kind: "streak",
    label: "Manter sequência de dias",
    text: "Manter a sequência de dias com direção concluída.",
    target: null,
  },
  {
    kind: "count",
    label: "Concluir uma quantidade de direções",
    text: "Concluir 20 direções no período.",
    target: 20,
  },
  { kind: "custom", label: "Meta personalizada", text: "", target: null },
];

const DURATIONS = [7, 15, 30];

const FOCUS_OPTIONS = [
  "Economizar",
  "Organizar a rotina",
  "Melhorar a alimentação",
  "Cuidar da saúde",
  "Focar no trabalho",
  "Estudar mais",
  "Colocar tarefas em dia",
  "Ter mais constância",
];

/** Fluxo em etapas: nome → desafio → duração → convidar. */
export function CreateCircleFlow({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useServerFn(createCircle);
  const saveFocus = useServerFn(setCircleFocus);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [kind] = useState<Kind>("daily");
  const [focus, setFocus] = useState("");
  const [customFocus, setCustomFocus] = useState("");
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const preset = CHALLENGES.find((c) => c.kind === kind)!;
  const focusLabel = (focus === "__custom" ? customFocus : focus).trim();
  const challengeText = focusLabel
    ? `Avançar juntos em ${focusLabel.toLowerCase()}, concluindo a direção da MAG todos os dias.`
    : preset.text;
  const duration = days === 0 ? Number(customDays) || 0 : days;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        data: {
          name: name.trim(),
          challengeKind: kind,
          challengeText,
          targetCount: preset.target,
          durationDays: duration,
        },
      });
      if (!res?.ok || !res.id) {
        setError(
          res?.reason === "limit_reached"
            ? "Você já tem muitos círculos ativos."
            : "Não foi possível criar agora.",
        );
        setBusy(false);
        return;
      }
      try {
        await saveFocus({ data: { id: res.id, focus: focusLabel } });
      } catch {
        /* foco é complementar: não bloqueia a criação */
      }
      const code = (res as { invite_code?: string }).invite_code ?? "";
      setCreated({ id: res.id, code });
      setStep(4);
    } catch {
      setError("Não foi possível criar agora.");
    }
    setBusy(false);
  }

  if (typeof document === "undefined") return null;

  const canNext =
    (step === 1 && name.trim().length >= 2) ||
    (step === 2 && focusLabel.length >= 2) ||
    (step === 3 && duration >= 1 && duration <= 365);

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
        <motion.button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 h-full w-full"
          style={{ background: "rgba(10,10,10,0.32)" }}
        />
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[520px] rounded-t-[26px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:rounded-[26px] sm:pb-7"
        >
          <div className="flex items-center justify-between">
            {step > 1 && step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="-ml-2 inline-flex items-center gap-1 text-[14px] font-medium text-neutral-500"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </button>
            ) : (
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                Novo círculo
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-1 rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === 1 && (
            <div className="mt-4">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
                Como quer chamar esse círculo?
              </h2>
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vendas de Agosto"
                className="mt-4 w-full rounded-[14px] border px-4 py-3 text-[15.5px] outline-none placeholder:text-neutral-300"
                style={{ borderColor: HAIR }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {NAME_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setName(ex)}
                    className="rounded-full border px-3 py-1.5 text-[12.5px] text-neutral-600"
                    style={{ borderColor: HAIR }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
                Qual é o foco em comum do círculo?
              </h2>
              <p className="mt-1.5 text-[13.5px] text-neutral-500">
                A MAG envia uma direção igual para todos os membros a partir desse foco.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOCUS_OPTIONS.map((f) => {
                  const on = focus === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocus(f)}
                      className="rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition"
                      style={{
                        borderColor: on ? BLUE : HAIR,
                        color: on ? BLUE : "#111111",
                        background: on ? "#EEF2FF" : "transparent",
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setFocus("__custom")}
                  className="rounded-full border px-3.5 py-2 text-[13.5px] font-medium"
                  style={{
                    borderColor: focus === "__custom" ? BLUE : HAIR,
                    color: focus === "__custom" ? BLUE : "#111111",
                    background: focus === "__custom" ? "#EEF2FF" : "transparent",
                  }}
                >
                  Escrever outro foco
                </button>
              </div>
              {focus === "__custom" && (
                <input
                  autoFocus
                  value={customFocus}
                  maxLength={60}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  placeholder="Ex.: Guardar dinheiro todo dia"
                  className="mt-3 w-full rounded-[14px] border px-4 py-3 text-[14.5px] outline-none placeholder:text-neutral-300"
                  style={{ borderColor: HAIR }}
                />
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mt-4">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
                Por quanto tempo?
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className="rounded-full border px-4 py-2.5 text-[13.5px] font-medium"
                    style={{
                      borderColor: days === d ? BLUE : HAIR,
                      color: days === d ? BLUE : "#111111",
                      background: days === d ? "rgba(51,92,255,0.06)" : "transparent",
                    }}
                  >
                    {d} dias
                    {d === 30 ? " · sugerido" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDays(0)}
                  className="rounded-full border px-4 py-2.5 text-[13.5px] font-medium"
                  style={{
                    borderColor: days === 0 ? BLUE : HAIR,
                    color: days === 0 ? BLUE : "#111111",
                  }}
                >
                  Personalizada
                </button>
              </div>
              {days === 0 && (
                <input
                  autoFocus
                  inputMode="numeric"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Número de dias"
                  className="mt-3 w-full rounded-[14px] border px-4 py-3 text-[15px] outline-none placeholder:text-neutral-300"
                  style={{ borderColor: HAIR }}
                />
              )}
            </div>
          )}

          {step === 4 && created && (
            <div className="mt-4">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Convidar pessoas</h2>
              <p className="mt-1.5 text-[13.5px] text-neutral-500">
                O círculo é privado. Só entra quem você convidar.
              </p>
              <div className="mt-4">
                <InvitePanel
                  circleId={created.id}
                  inviteCode={created.code}
                  circleName={name.trim()}
                />
              </div>
              <button
                type="button"
                onClick={() => onCreated(created.id)}
                className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[16px] text-[14.5px] font-medium text-white"
                style={{ background: BLUE }}
              >
                Abrir círculo
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-[12.5px] text-[#C0453B]">{error}</p>}

          {step < 4 && (
            <button
              type="button"
              disabled={!canNext || busy}
              onClick={() => (step === 3 ? submit() : setStep((s) => s + 1))}
              className="mt-6 flex min-h-[50px] w-full items-center justify-center rounded-[16px] text-[14.5px] font-medium text-white transition disabled:opacity-40"
              style={{ background: BLUE }}
            >
              {step === 3 ? (busy ? "Criando…" : "Criar círculo") : "Continuar"}
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
