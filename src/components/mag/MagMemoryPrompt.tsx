import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { MagHead } from "@/components/mag/MagHead";
import {
  answerMagQuestion,
  dismissMagQuestion,
  getMagMemory,
} from "@/lib/mag-memory.functions";

const BLUE = "#335CFF";

/**
 * Pergunta curta e ocasional do mascote.
 * A MAG pergunta pouco, observa muito e aprende sempre: só aparece quando
 * existe lacuna real de contexto e respeita o intervalo entre perguntas.
 */
export function MagMemoryPrompt() {
  const qc = useQueryClient();
  const load = useServerFn(getMagMemory);
  const answer = useServerFn(answerMagQuestion);
  const dismiss = useServerFn(dismissMagQuestion);

  const { data } = useQuery({
    queryKey: ["mag-memory"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
  });

  const reply = useMutation({
    mutationFn: (value: string) =>
      answer({ data: { id: data!.question!.id, answer: value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mag-memory"] }),
  });

  const skip = useMutation({
    mutationFn: () => dismiss({ data: { id: data!.question!.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mag-memory"] }),
  });

  const q = data?.question ?? null;

  return (
    <AnimatePresence>
      {q && !reply.isSuccess && !skip.isSuccess ? (
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mt-3 rounded-[20px] border p-3"
          style={{ background: "var(--blue-card, #EDF1FF)", borderColor: "rgba(51,92,255,.14)" }}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              <MagHead size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[14px] font-semibold leading-snug"
                style={{ color: "var(--blue-ink, #1A2A66)" }}
              >
                {q.question}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={reply.isPending}
                    onClick={() => reply.mutate(o)}
                    className="rounded-full border bg-white px-3 py-1.5 text-[12.5px] font-medium transition active:scale-95"
                    style={{ borderColor: "rgba(51,92,255,.22)", color: BLUE }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              aria-label="Agora não"
              onClick={() => skip.mutate()}
              className="shrink-0 rounded-full p-1 opacity-50 transition hover:opacity-90"
            >
              <X size={15} style={{ color: "var(--blue-ink, #1A2A66)" }} />
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
