import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { generateDirectionMessage } from "@/lib/direction-message.functions";

const BLUE = "#335CFF";
const INK = "#111111";

/**
 * Material sugerido pela MAG (mensagem pronta) — card branco separado,
 * fora do card azul da direção, seguido da conclusão "Já enviei".
 */
export function DirectionMessage({
  planId,
  title,
  description,
  done,
  pending,
  onSent,
}: {
  planId: string;
  title: string;
  description?: string | null;
  done: boolean;
  pending?: boolean;
  onSent: () => void;
}) {
  const generate = useServerFn(generateDirectionMessage);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const lastRef = useRef("");

  const gen = useMutation({
    mutationFn: async () => {
      const res = await generate({
        data: {
          direction_title: title,
          direction_description: description ?? "",
          previous: lastRef.current,
        },
      });
      return res.message;
    },
    onSuccess: (text) => {
      lastRef.current = text;
      setMessage(text);
      setCopied(false);
    },
  });

  useEffect(() => {
    const cached = (() => {
      try {
        return sessionStorage.getItem(`imag:dir-msg:${planId}`);
      } catch {
        return null;
      }
    })();
    if (cached) {
      lastRef.current = cached;
      setMessage(cached);
      return;
    }
    gen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  useEffect(() => {
    if (!message) return;
    try {
      sessionStorage.setItem(`imag:dir-msg:${planId}`, message);
    } catch {
      /* storage indisponível */
    }
  }, [message, planId]);

  async function copy() {
    if (!message) return;
    haptic(8);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const el = document.createElement("textarea");
      el.value = message;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3">
      <div
        className="rounded-[22px] px-4 py-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7EAF1",
          boxShadow: "0 6px 18px rgba(10,25,80,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14.5px] font-medium" style={{ color: INK, letterSpacing: "-0.01em" }}>
            Mensagem sugerida
          </p>
          <button
            type="button"
            aria-label="Copiar mensagem"
            onClick={copy}
            className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full transition active:opacity-60"
          >
            <Copy className="h-[17px] w-[17px]" strokeWidth={1.9} style={{ color: BLUE }} />
          </button>
        </div>

        <div
          className="mt-3 rounded-[16px] px-3.5 py-3"
          style={{ background: "#FFFFFF", border: "1px solid #EDEFF4" }}
        >
          {gen.isPending && !message ? (
            <div className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded-full bg-[#EDEFF3]" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#EDEFF3]" />
              <div className="h-3 w-3/5 animate-pulse rounded-full bg-[#EDEFF3]" />
            </div>
          ) : gen.isError && !message ? (
            <p className="text-[13.5px] font-light leading-[1.5]" style={{ color: "#7A7A80" }}>
              Não consegui gerar a mensagem agora. Toque em “Gerar outra”.
            </p>
          ) : (
            <p
              className="whitespace-pre-line text-[14px] font-normal leading-[1.5]"
              style={{ color: INK }}
            >
              {message}
            </p>
          )}
        </div>

        <motion.button
          type="button"
          disabled={!message}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          onClick={copy}
          className="mt-3.5 w-full rounded-full px-4 py-3 text-[14px] font-semibold text-white transition disabled:opacity-60"
          style={{ background: BLUE }}
        >
          {copied ? "Mensagem copiada ✓" : "Copiar mensagem"}
        </motion.button>

        <button
          type="button"
          disabled={gen.isPending}
          onClick={() => {
            haptic(4);
            gen.mutate();
          }}
          className="mt-2 block w-full py-1.5 text-center text-[13px] font-medium transition active:opacity-60 disabled:opacity-50"
          style={{ color: BLUE }}
        >
          {gen.isPending && message ? "Gerando…" : "Gerar outra"}
        </button>
      </div>

      {!done && (
        <AnimatePresence initial={false} mode="wait">
          {confirming ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-[22px] px-4 py-4"
              style={{ background: "#FFFFFF", border: `1px solid ${BLUE}33` }}
            >
              <p className="text-[14px] font-medium" style={{ color: INK }}>
                Conseguiu enviar a mensagem?
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    haptic(8);
                    onSent();
                  }}
                  className="rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white transition active:opacity-80 disabled:opacity-60"
                  style={{ background: BLUE }}
                >
                  {pending ? "Concluindo…" : "Sim, enviei"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic(4);
                    setConfirming(false);
                  }}
                  className="px-2 py-2 text-[13px] font-light transition active:opacity-60"
                  style={{ color: "#8A93A6" }}
                >
                  Ainda não
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="sent"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic(6);
                setConfirming(true);
              }}
              className="mt-3 w-full rounded-full px-4 py-3 text-[14px] font-semibold transition"
              style={{ background: "#FFFFFF", border: `1.5px solid ${BLUE}`, color: BLUE }}
            >
              Já enviei
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
