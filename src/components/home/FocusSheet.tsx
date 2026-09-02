import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { setFocus } from "@/lib/focus.functions";
import { haptic } from "@/lib/haptics";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";

type Duration = "next" | "until_change";

/** Opções de foco — uma única seleção por vez. */
const OPTIONS: { key: string; label: string; phrase: string }[] = [
  { key: "profissional", label: "Vida profissional", phrase: "sua vida profissional" },
  { key: "pessoal", label: "Vida pessoal", phrase: "sua vida pessoal" },
  { key: "estudos", label: "Estudos", phrase: "seus estudos" },
  { key: "saude", label: "Saúde e bem-estar", phrase: "sua saúde e bem-estar" },
  { key: "rotina", label: "Organização da rotina", phrase: "a organização da sua rotina" },
  { key: "outro", label: "Outro assunto", phrase: "esse novo assunto" },
];

/**
 * Bottom sheet "Mudar foco" — influencia apenas as próximas direções.
 * Renderizado via Portal no <body> para ficar acima de header, mascote e BottomNav.
 * Nunca altera a direção atual.
 */
export function FocusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(setFocus);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState<Duration>("next");
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setNote("");
    setDuration("next");
    setKbInset(0);
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [open]);

  // Acompanha o teclado do iOS via visualViewport (não redimensiona a BottomNav).
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset > 80 ? inset : 0);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const opt = OPTIONS.find((o) => o.key === selected);
      if (!opt) return null;
      await save({
        data: {
          focus_key: opt.key,
          focus_label: opt.label,
          note: note.trim() || null,
          duration,
        },
      });
      return opt;
    },
    onSuccess: (opt) => {
      if (!opt) return;
      haptic([8, 30, 10]);
      qc.invalidateQueries({ queryKey: ["active-focus"] });
      toast.success("Foco atualizado", {
        description:
          duration === "next"
            ? `Entendi. Vou considerar ${opt.phrase} na próxima direção.`
            : `Entendi. Vou priorizar ${opt.phrase} nas próximas direções. Você pode mudar esse foco quando quiser.`,
      });
      onClose();
    },
    onError: () => toast.error("Não consegui salvar o foco agora."),
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 9999 }}
          role="dialog"
          aria-modal="true"
          aria-label="Mudar foco"
        >
          {/* Overlay cobre toda a tela, incluindo a barra de navegação */}
          <motion.button
            type="button"
            aria-label="Fechar"
            onClick={() => !mutation.isPending && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 h-full w-full"
            style={{ background: "rgba(17,17,17,0.42)", backdropFilter: "blur(2px)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose();
            }}
            className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[520px] flex-col rounded-t-[26px]"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 -14px 44px rgba(17,17,17,0.16)",
              maxHeight: kbInset > 0 ? "100dvh" : "88dvh",
            }}
          >
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-6 pt-3"
              style={{
                WebkitOverflowScrolling: "touch",
                paddingBottom: `calc(24px + env(safe-area-inset-bottom) + ${kbInset}px)`,
              }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "#E4E5EA" }} />

              <h2
                className="text-[20px] font-semibold leading-tight"
                style={{ color: INK, letterSpacing: "-0.03em" }}
              >
                Mudar foco
              </h2>
              <p className="mt-1.5 text-[14.5px] font-light leading-[1.45]" style={{ color: INK }}>
                O que precisa de mais atenção agora?
              </p>
              <p className="mt-1 text-[12.5px] font-light leading-[1.45]" style={{ color: MUTED }}>
                A MAG vai considerar essa mudança nas próximas direções.
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {OPTIONS.map((opt) => {
                  const active = selected === opt.key;
                  return (
                    <motion.button
                      key={opt.key}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        haptic(6);
                        setSelected(opt.key);
                      }}
                      className="whitespace-normal break-words rounded-full px-3.5 py-2.5 text-[13.5px] font-medium leading-tight transition-colors"
                      style={{
                        background: active ? "#EEF3FF" : "#FFFFFF",
                        border: `1px solid ${active ? BLUE : "#E4E5EA"}`,
                        color: active ? BLUE : INK,
                      }}
                    >
                      {opt.label}
                    </motion.button>
                  );
                })}
              </div>

              <p
                className="mt-5 text-[10.5px] font-semibold uppercase"
                style={{ color: MUTED, letterSpacing: "0.12em" }}
              >
                Duração
              </p>
              <div className="mt-2 flex gap-2">
                {([
                  { key: "next", label: "Próxima direção" },
                  { key: "until_change", label: "Até eu mudar" },
                ] as { key: Duration; label: string }[]).map((d) => {
                  const active = duration === d.key;
                  return (
                    <motion.button
                      key={d.key}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        haptic(4);
                        setDuration(d.key);
                      }}
                      className="flex-1 whitespace-normal break-words rounded-[16px] px-3 py-2.5 text-[13.5px] font-medium leading-tight transition-colors"
                      style={{
                        background: active ? "#EEF3FF" : "#FFFFFF",
                        border: `1px solid ${active ? BLUE : "#E4E5EA"}`,
                        color: active ? BLUE : INK,
                      }}
                    >
                      {d.label}
                    </motion.button>
                  );
                })}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onFocus={(e) =>
                  setTimeout(
                    () => e.target.scrollIntoView({ block: "center", behavior: "smooth" }),
                    320,
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="O que mudou? Conte à MAG…"
                className="mt-5 w-full resize-none rounded-[18px] px-4 py-3 text-[16px] font-light outline-none"
                style={{ background: "#F7F8FA", border: "1px solid #ECEDF0", color: INK }}
              />

              <button
                type="button"
                disabled={!selected || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="mt-5 w-full rounded-full py-3.5 text-[15px] font-medium text-white transition active:opacity-85 disabled:opacity-40"
                style={{ background: BLUE }}
              >
                {mutation.isPending ? "Atualizando…" : "Atualizar foco"}
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={onClose}
                className="mt-2 w-full py-3 text-[14px] font-light transition active:opacity-60"
                style={{ color: MUTED }}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
