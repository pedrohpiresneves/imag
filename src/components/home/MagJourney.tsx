import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { listGoalHistory } from "@/lib/goal-history.functions";
import { getShareStats } from "@/lib/share-cards/share-stats.functions";

import {
  MagBubble,
  MAG_PHRASES,
  magPhrase,
  toMagCharacterState,
  type MagState,
} from "@/components/mag/MagMascot";
import { MAGCharacter } from "@/components/mag/MAGCharacter";
import { haptic } from "@/lib/haptics";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";

const DAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DAYS = 7;

/** Datas (YYYY-MM-DD) de segunda a domingo da semana de `localDate`. */
function weekDates(localDate: string): string[] {
  const base = new Date(`${localDate}T12:00:00`);
  const dow = (base.getDay() + 6) % 7; // 0 = segunda
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);
  return Array.from({ length: DAYS }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });
}

/**
 * Jornada MAG — trilha semanal (SEG a DOM) alimentada pelas direções concluídas.
 * A MAG caminha pelos dias da semana junto com o usuário.
 */
export function MagJourney({
  localDate,
  advanceReason,
}: {
  localDate: string;
  /** Quando presente, anima a MAG do dia anterior até o atual e mostra a microinformação. */
  advanceReason?: string | null;
}) {
  const fetchHistory = useServerFn(listGoalHistory);
  const fetchStats = useServerFn(getShareStats);
  

  const { data: month } = useQuery({
    queryKey: ["goal-history", "completed", 30],
    queryFn: () => fetchHistory({ data: { filter: "completed", days: 30 } }),
    staleTime: 60_000,
    retry: false,
  });
  const { data: stats } = useQuery({
    queryKey: ["share-stats"],
    queryFn: () => fetchStats(),
    staleTime: 120_000,
    retry: false,
  });

  const days = useMemo(() => weekDates(localDate), [localDate]);
  const todayIndex = Math.max(0, days.indexOf(localDate));

  const doneSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of month ?? []) s.add(item.date);
    return s;
  }, [month]);

  const doneDays = days.map((d) => doneSet.has(d));
  const weekDone = doneDays.filter(Boolean).length;
  const directionsDone = month?.length ?? 0;
  const remaining = Math.max(0, DAYS - weekDone);

  const sources = [
    directionsDone > 0
      ? `${directionsDone} ${directionsDone === 1 ? "direção concluída no total" : "direções concluídas no total"}`
      : null,
    
    (stats?.streak ?? 0) >= 3 ? `${stats?.streak} dias de sequência` : null,
  ].filter(Boolean) as string[];

  const [bubble, setBubble] = useState<string | null>(null);
  const [state, setState] = useState<MagState>("neutral");
  const [walking, setWalking] = useState(false);
  const [hint, setHint] = useState<{ i: number; text: string } | null>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 3200);
    return () => clearTimeout(t);
  }, [hint]);

  // Animação de chegada: parte do dia anterior e caminha até hoje.
  const [displayIndex, setDisplayIndex] = useState<number | null>(null);
  const [microInfo, setMicroInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!advanceReason || month === undefined) return;
    setDisplayIndex(Math.max(0, todayIndex - 1));
    setWalking(true);
    setState("happy");
    const t0 = setTimeout(() => setDisplayIndex(todayIndex), 320);
    const t1 = setTimeout(() => {
      setWalking(false);
      setMicroInfo(advanceReason);
      setState("neutral");
    }, 1250);
    const t2 = setTimeout(() => setDisplayIndex(null), 1600);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [advanceReason, month, todayIndex]);

  const pos = displayIndex ?? todayIndex;

  useEffect(() => {
    if (month === undefined) return;
    const before = prev.current;
    prev.current = weekDone;
    if (before === null || weekDone <= before) return;
    setWalking(true);
    setState(weekDone === DAYS ? "celebrating" : "happy");
    setBubble(weekDone === DAYS ? magPhrase(MAG_PHRASES.journey) : magPhrase(MAG_PHRASES.done));
    const t0 = setTimeout(() => setWalking(false), 900);
    const t1 = setTimeout(() => setBubble(null), 3800);
    const t2 = setTimeout(() => setState("neutral"), 1800);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [weekDone, month]);

  const headline =
    weekDone === 0
      ? "Sua semana começa no próximo passo"
      : weekDone === 1
        ? "Você avançou hoje"
        : `${weekDone} dias ativos nesta semana`;

  const sub =
    weekDone === DAYS
      ? "Semana completa. A MAG caminhou com você todos os dias."
      : weekDone === 0
        ? "Conclua a direção de hoje e a MAG avança com você."
        : remaining === 1
          ? "Mais 1 dia para você alcançar o próximo marco."
          : `Mais ${remaining} dias para você alcançar o próximo marco.`;

  return (
    <section
      className="mt-2.5 w-full overflow-hidden rounded-[24px] px-5 pb-5 pt-5"
      style={{ background: "#FBFBFC" }}
    >
      <MagBubble message={bubble} className="mb-3" />

      {/* Trilha semanal */}
      <div className="relative mt-5 h-[54px]">
        <div
          className="absolute left-[7px] right-[7px] top-[18px] h-[3px] rounded-full"
          style={{ background: "#E9ECF3" }}
        />
        <motion.div
          className="absolute left-[7px] top-[18px] h-[3px] rounded-full"
          style={{
            background: `linear-gradient(90deg, ${BLUE}99, ${BLUE})`,
            boxShadow: `0 0 12px ${BLUE}55`,
          }}
          initial={false}
          animate={{ width: `calc((100% - 14px) * ${pos / (DAYS - 1)})` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="relative flex items-start justify-between">
          {days.map((date, i) => {
            const done = doneDays[i];
            const current = i === todayIndex;
            return (
              <button
                key={date}
                type="button"
                aria-label={`${DAY_LABELS[i]}${done ? " — concluído" : ""}`}
                onClick={() => {
                  haptic(6);
                  setHint({
                    i,
                    text: done
                      ? "Direção concluída neste dia."
                      : current
                        ? "Você está aqui."
                        : i < todayIndex
                          ? "Sem direção concluída neste dia."
                          : "Ainda por vir.",
                  });
                }}
                className="relative grid w-[26px] place-items-center gap-[7px] pt-[11px]"
              >
                <motion.span
                  initial={false}
                  animate={{ scale: done || current ? 1 : 0.85 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="grid h-[14px] w-[14px] place-items-center rounded-full"
                  style={{
                    background: done ? BLUE : "#FFFFFF",
                    border: done
                      ? `1px solid ${BLUE}`
                      : current
                        ? `1.5px solid rgba(51,92,255,0.45)`
                        : "1.5px solid #E4E8F0",
                    boxShadow: current ? `0 0 0 5px rgba(51,92,255,0.08)` : "none",
                  }}
                >
                  {done && <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />}
                </motion.span>
                <span
                  className="text-[9.5px] font-medium tracking-[0.08em]"
                  style={{ color: current ? BLUE : done ? INK : "#B4B7C0" }}
                >
                  {DAY_LABELS[i]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mascote sobre o dia atual */}
        <motion.div
          className="pointer-events-none absolute top-[-16px]"
          initial={false}
          animate={{ left: `calc((100% - 26px) * ${pos / (DAYS - 1)} + 13px - 19px)` }}
          transition={{ type: "spring", stiffness: 170, damping: 24 }}
        >
          <div
            className="grid place-items-center rounded-full"
            style={{ filter: `drop-shadow(0 6px 14px ${BLUE}33)` }}
          >
            <MAGCharacter
              state={walking ? "walking" : toMagCharacterState(state)}
              framing="full"
              size={38}
            />
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {hint && (
          <motion.p
            key={hint.text}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-2 text-[11.5px] font-light"
            style={{ color: MUTED }}
          >
            {hint.text}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {microInfo && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]"
            style={{ background: "#F3F6FF", color: BLUE }}
          >
            +1 dia · {microInfo}
          </motion.p>
        )}
      </AnimatePresence>

      <p
        className="mt-4 text-[14.5px] font-semibold leading-[1.3]"
        style={{ color: INK, letterSpacing: "-0.02em" }}
      >
        {headline}
      </p>
      <p className="mt-1 text-[12.5px] font-light leading-[1.45]" style={{ color: MUTED }}>
        {sub}
      </p>

      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 text-[11px] font-light"
              style={{ background: "#F3F6FF", color: BLUE }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
