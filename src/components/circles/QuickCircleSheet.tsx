import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { createCircle } from "@/lib/circles.functions";
import { InvitePanel } from "./InvitePanel";

const HAIR = "#E9EBEF";
const BLUE = "#335CFF";
const DURATIONS = [7, 15, 30];

/** Fluxo curto: nome → duração → criar → convidar por link. */
export function QuickCircleSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const create = useServerFn(createCircle);
  const [name, setName] = useState("");
  const [days, setDays] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        data: {
          name: name.trim(),
          challengeKind: "daily",
          challengeText: "Concluir a direção do dia.",
          targetCount: 1,
          durationDays: days,
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
      setCreated({ id: res.id, code: (res as { invite_code?: string }).invite_code ?? "" });
    } catch {
      setError("Não foi possível criar agora.");
    }
    setBusy(false);
  }

  if (typeof document === "undefined") return null;

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
          className="relative w-full max-w-[480px] rounded-t-[26px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:rounded-[26px] sm:pb-7"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
              Novo círculo
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-1 rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!created ? (
            <div className="mt-4">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
                Manter a direção, juntos
              </h2>

              <label className="mt-4 block text-[12px] font-medium text-neutral-500">
                Nome do círculo
              </label>
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Constância"
                className="mt-1.5 w-full rounded-[14px] border px-4 py-3 text-[15.5px] outline-none placeholder:text-neutral-300"
                style={{ borderColor: HAIR }}
              />

              <p className="mt-5 text-[12px] font-medium text-neutral-500">Duração</p>
              <div className="mt-1.5 flex gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className="flex-1 rounded-[14px] border py-2.5 text-[13.5px] font-medium transition"
                    style={{
                      borderColor: days === d ? BLUE : HAIR,
                      color: days === d ? BLUE : "#111111",
                      background: days === d ? "rgba(51,92,255,0.06)" : "transparent",
                    }}
                  >
                    {d} dias
                  </button>
                ))}
              </div>

              {error && <p className="mt-3 text-[12.5px] text-[#C0453B]">{error}</p>}

              <button
                type="button"
                disabled={name.trim().length < 2 || busy}
                onClick={submit}
                className="mt-6 flex min-h-[50px] w-full items-center justify-center rounded-[16px] text-[14.5px] font-medium text-white transition disabled:opacity-40"
                style={{ background: BLUE }}
              >
                {busy ? "Criando…" : "Criar círculo"}
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Convide por link</h2>
              <p className="mt-1.5 text-[13.5px] text-neutral-500">
                O círculo é privado. Só entra quem receber o link.
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
                onClick={() => (onCreated ? onCreated(created.id) : onClose())}
                className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[16px] text-[14.5px] font-medium text-white"
                style={{ background: BLUE }}
              >
                Concluir
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
