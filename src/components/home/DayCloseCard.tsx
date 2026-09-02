import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MoonStar } from "lucide-react";
import { closeDay, getDayCloseState } from "@/lib/day-close.functions";
import { haptic } from "@/lib/haptics";

const BLUE = "#335CFF";
const BLUE_SOFT = "#EEF2FF";
const INK = "#111111";
const MUTED = "#6B6B70";
const HAIR = "#ECEDF0";

const RATINGS = [
  { key: "dificil", label: "Difícil" },
  { key: "regular", label: "Regular" },
  { key: "bom", label: "Bom" },
  { key: "otimo", label: "Ótimo" },
] as const;

type Action = { action: "keep" | "move" | "remove"; date?: string };

function tomorrowOf(localDate: string) {
  return new Date(new Date(`${localDate}T12:00:00`).getTime() + 86_400_000).toLocaleDateString(
    "en-CA",
  );
}

/**
 * Encerramento do dia — card contextual na aba Hoje, em três etapas rápidas.
 * Aparece a partir do horário definido e some quando o dia é encerrado.
 */
export function DayCloseCard({
  localDate,
  firstName,
  className = "",
}: {
  localDate: string;
  firstName?: string | null;
  className?: string;
}) {
  const fetchState = useServerFn(getDayCloseState);
  const submit = useServerFn(closeDay);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: state } = useQuery({
    queryKey: ["day-close", localDate],
    queryFn: () => fetchState({ data: { local_date: localDate } }),
    staleTime: 60_000,
    retry: false,
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rating, setRating] = useState<(typeof RATINGS)[number]["key"] | null>(null);
  const [actions, setActions] = useState<Record<string, Action>>({});
  const [justClosed, setJustClosed] = useState(false);

  const visible = useMemo(() => {
    if (!state) return false;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= state.showFromHour * 60 + state.showFromMinute;
  }, [state, now]);

  const save = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          local_date: localDate,
          rating: rating ?? "regular",
          actions: Object.entries(actions).map(([id, a]) => ({
            id,
            action: a.action,
            ...(a.date ? { date: a.date } : {}),
          })),
        },
      }),
    onSuccess: () => {
      setJustClosed(true);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["day-close", localDate] });
      void qc.invalidateQueries({ queryKey: ["day-panel"] });
      void qc.invalidateQueries({ queryKey: ["day-context"] });
    },
  });

  if (!state || !visible) return null;

  const done = state.closed || justClosed;

  /* Sem aviso de "dia encerrado": o próprio recolhimento dos cards já comunica. */
  if (done) return null;

  const pending = state.pending;
  const hello = firstName ? `Como foi seu dia, ${firstName}?` : "Como foi seu dia?";

  return (
    <section
      className={`overflow-hidden rounded-[22px] border ${className}`}
      style={{ borderColor: HAIR, background: "#FFFFFF" }}
    >
      <div className="flex items-start gap-3 px-4 pb-4 pt-4">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: BLUE_SOFT }}
        >
          <MoonStar className="h-[17px] w-[17px]" strokeWidth={1.7} style={{ color: BLUE }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="text-[15px] font-semibold leading-tight"
            style={{ color: INK, letterSpacing: "-0.02em" }}
          >
            {hello}
          </h3>
          <p className="mt-0.5 text-[12.5px] font-light leading-[1.4]" style={{ color: MUTED }}>
            Revise o que conseguiu concluir e deixe amanhã mais leve.
          </p>

          {!open && (
            <button
              type="button"
              onClick={() => {
                haptic(8);
                setOpen(true);
                setStep(1);
              }}
              className="mt-3 rounded-full px-4 py-2 text-[13px] font-medium text-white transition active:opacity-70"
              style={{ background: BLUE }}
            >
              Encerrar meu dia
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="border-t px-4"
            style={{ borderColor: HAIR }}
          >
            {step === 1 && (
              <div className="py-4">
                <p className="text-[13px] font-medium" style={{ color: INK }}>
                  Como você avalia seu dia?
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {RATINGS.map((r) => {
                    const on = rating === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          haptic(6);
                          setRating(r.key);
                          setStep(pending.length > 0 ? 2 : 3);
                        }}
                        className="rounded-full border px-3.5 py-2 text-[13px] transition active:opacity-70"
                        style={{
                          borderColor: on ? BLUE : HAIR,
                          background: on ? BLUE_SOFT : "#FFFFFF",
                          color: on ? BLUE : INK,
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="py-4">
                <p className="text-[13px] font-medium" style={{ color: INK }}>
                  O que ficou em aberto?
                </p>
                <ul className="mt-2 divide-y" style={{ borderColor: HAIR }}>
                  {pending.map((p) => {
                    const current = actions[p.id]?.action ?? "keep";
                    const date = actions[p.id]?.date;
                    return (
                      <li key={p.id} className="py-2.5">
                        <p className="truncate text-[13.5px]" style={{ color: INK }}>
                          {p.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {[
                            { key: "move", label: "Amanhã" },
                            { key: "remove", label: "Remover" },
                          ].map((opt) => {
                            const on = current === opt.key && !date;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => {
                                  haptic(5);
                                  setActions((prev) => ({
                                    ...prev,
                                    [p.id]: on
                                      ? { action: "keep" }
                                      : { action: opt.key as Action["action"] },
                                  }));
                                }}
                                className="rounded-full border px-3 py-1.5 text-[12px] transition active:opacity-70"
                                style={{
                                  borderColor: on ? BLUE : HAIR,
                                  background: on ? BLUE_SOFT : "#FFFFFF",
                                  color: on ? BLUE : MUTED,
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                          <label
                            className="rounded-full border px-3 py-1.5 text-[12px]"
                            style={{
                              borderColor: date ? BLUE : HAIR,
                              background: date ? BLUE_SOFT : "#FFFFFF",
                              color: date ? BLUE : MUTED,
                            }}
                          >
                            {date ? date.split("-").reverse().slice(0, 2).join("/") : "Outra data"}
                            <input
                              type="date"
                              className="sr-only"
                              min={tomorrowOf(localDate)}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v) return;
                                haptic(5);
                                setActions((prev) => ({
                                  ...prev,
                                  [p.id]: { action: "move", date: v },
                                }));
                              }}
                            />
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    haptic(6);
                    setStep(3);
                  }}
                  className="mt-3 rounded-full px-4 py-2 text-[13px] font-medium text-white transition active:opacity-70"
                  style={{ background: BLUE }}
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="py-4">
                <p className="text-[13px] font-medium" style={{ color: INK }}>
                  Quer organizar amanhã agora?
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={async () => {
                      haptic(8);
                      await save.mutateAsync();
                      navigate({ to: "/mentor" });
                    }}
                    className="rounded-full px-4 py-2 text-[13px] font-medium text-white transition active:opacity-70 disabled:opacity-60"
                    style={{ background: BLUE }}
                  >
                    Organizar com a MAG
                  </button>
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={() => {
                      haptic(6);
                      save.mutate();
                    }}
                    className="rounded-full border px-4 py-2 text-[13px] transition active:opacity-70 disabled:opacity-60"
                    style={{ borderColor: HAIR, color: MUTED }}
                  >
                    Agora não
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
