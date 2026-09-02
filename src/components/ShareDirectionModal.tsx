import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Search, Check, Users, Loader2, Send } from "lucide-react";
import {
  listRecentContacts,
  searchImagPeople,
  shareDirection,
  type ImagPerson,
} from "@/lib/shared-directions.functions";

const INK = "#0A0A0A";
const MUTED = "#7B7F89";
const HAIRLINE = "#ECEBE5";
const BLUE_DARK = "#335CFF";
const BLUE = "#335CFF";
const easeOut = [0.22, 1, 0.36, 1] as const;
const DEFAULT_MESSAGE = "Acho que essa direção pode ser útil para você.";

type Props = {
  open: boolean;
  onClose: () => void;
  planId?: string | null;
  title: string;
  description: string;
  reason?: string | null;
  duration?: string | null;
};

export function ShareDirectionModal({
  open,
  onClose,
  planId,
  title,
  description,
  reason,
  duration,
}: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<ImagPerson[]>([]);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebounced("");
    setSelected([]);
    setMessage(DEFAULT_MESSAGE);
    setSent(false);
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: recents = [] } = useQuery({
    queryKey: ["direction-contacts"],
    queryFn: () => listRecentContacts(),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["direction-people", debounced],
    queryFn: () => searchImagPeople({ data: { q: debounced } }),
    enabled: open && debounced.length >= 2,
  });

  const list = debounced.length >= 2 ? results : recents;

  const mutation = useMutation({
    mutationFn: () =>
      shareDirection({
        data: {
          recipient_ids: selected.map((p) => p.id),
          plan_id: planId ?? null,
          title,
          description,
          reason: reason ?? null,
          message: message.trim() || null,
        },
      }),
    onSuccess: () => {
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["direction-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["sent-directions"] });
      setTimeout(onClose, 1400);
    },
  });

  const canSend = selected.length > 0 && !mutation.isPending;
  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  function toggle(person: ImagPerson) {
    setSelected((prev) =>
      prev.some((p) => p.id === person.id)
        ? prev.filter((p) => p.id !== person.id)
        : [...prev, person],
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: easeOut }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartilhar direção"
            className="w-full max-w-[400px] rounded-[24px] bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_-20px_rgba(10,10,10,0.28)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[16.5px] font-medium tracking-[-0.02em]" style={{ color: INK }}>
                Compartilhar direção
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-full transition hover:bg-black/[0.04]"
                style={{ color: MUTED }}
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.7} />
              </button>
            </div>

            {sent ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-8 text-center text-[14px] font-medium"
                style={{ color: BLUE }}
              >
                ✓ Direção compartilhada.
              </motion.p>
            ) : (
              <>
                <div
                  className="mt-3 flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5"
                  style={{ borderColor: HAIRLINE }}
                >
                  <Search className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: MUTED }} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por iMAG ID"
                    className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-[#9A9DA5]"
                    style={{ color: INK }}
                  />
                  {isFetching && (
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: MUTED }} />
                  )}
                </div>

                <div className="mt-1 max-h-[186px] divide-y overflow-y-auto" style={{ borderColor: HAIRLINE }}>
                  {list.slice(0, 12).map((person) => {
                    const active = selectedIds.has(person.id);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => toggle(person)}
                        className="flex w-full items-center gap-3 py-2.5 text-left transition"
                      >
                        <Avatar person={person} size={32} />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[14px] font-medium"
                            style={{ color: INK }}
                          >
                            {person.handle ? `im.${person.handle}` : (person.full_name ?? "Pessoa iMAG")}
                          </span>
                          <span className="block truncate text-[12px]" style={{ color: MUTED }}>
                            {person.profession ?? ""}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full border transition"
                          style={{
                            borderColor: active ? BLUE : "#D8DAE0",
                            background: active ? BLUE : "transparent",
                            color: "#fff",
                          }}
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={2.6} />}
                        </span>
                      </button>
                    );
                  })}
                  {list.length === 0 && (
                    <div className="flex items-center gap-2 py-3.5 text-[13px]" style={{ color: MUTED }}>
                      <Users className="h-4 w-4" strokeWidth={1.6} />
                      {debounced.length >= 2
                        ? "Nenhum iMAG ID encontrado."
                        : "Busque alguém da iMAG pelo iMAG ID."}
                    </div>
                  )}
                </div>

                <div
                  className="mt-3 rounded-[14px] border px-3.5 py-2.5"
                  style={{ borderColor: HAIRLINE }}
                >
                  <textarea
                    value={message}
                    maxLength={120}
                    rows={2}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Mensagem para quem vai receber…"
                    className="w-full resize-none bg-transparent text-[14px] leading-[1.45] outline-none placeholder:text-[#9A9DA5]"
                    style={{ color: INK }}
                  />
                  <p className="text-right text-[11.5px]" style={{ color: MUTED }}>
                    {message.length}/120
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => mutation.mutate()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-6 py-3.5 text-[15px] font-medium transition disabled:cursor-not-allowed"
                  style={
                    canSend
                      ? { background: BLUE, color: "#fff" }
                      : { background: "#EEF2FF", color: "#A9B4D8" }
                  }
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" strokeWidth={1.9} />
                      Enviar direção
                    </>
                  )}
                </button>
                {mutation.isError && (
                  <p className="mt-2 text-center text-[12.5px]" style={{ color: "#B4432B" }}>
                    Não consegui compartilhar agora. Tente novamente.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Avatar({ person, size = 38 }: { person: ImagPerson; size?: number }) {
  const initial = person.handle
    ? "im"
    : (person.full_name ?? "?").trim().charAt(0).toUpperCase();
  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt={person.full_name ?? "Pessoa iMAG"}
        className="shrink-0 rounded-full object-cover"
        style={{ height: size, width: size }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full text-[13px] font-medium"
      style={{ height: size, width: size, background: "#EEF2FF", color: BLUE_DARK }}
    >
      {initial}
    </span>
  );
}