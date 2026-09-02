import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Flag,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { ShareDayModal } from "@/components/ShareDayModal";
import { DayAiSheet } from "@/components/home/DayAiSheet";
import {
  MagAvatarMascot,
  MagBubble,
  MAG_PHRASES,
  magPhrase,
  useMagSpeech,
} from "@/components/mag/MagMascot";
import { useDayContext, formatIn, useNowMinutes } from "@/components/home/use-day-context";
import {
  addDayEvent,
  addDayPriority,
  deleteDayEvent,
  deleteDayPriority,
  getDayPanel,
  reorderDayPriorities,
  saveDayNote,
  updateDayPriority,
  updateDayEvent,
  type DayPriority,
  type DayEvent,
} from "@/lib/day-panel.functions";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";
const HAIR = "#ECECEF";
const BLUE_TINT = "rgba(51, 92, 255, 0.08)";
const NOTE_BG = "#F4F6FA";

function SectionTitle({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>
        {label}
      </h3>
      {hint ? (
        <span className="text-[11.5px] font-normal" style={{ color: MUTED }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function AddInline({
  label,
  onSubmit,
  withTime,
}: {
  label: string;
  onSubmit: (v: { title: string; time?: string }) => void;
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: BLUE }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        {label}
      </button>
    );
  }

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    if (withTime && !/^\d{2}:\d{2}$/.test(time)) return;
    onSubmit({ title: t, time: withTime ? time : undefined });
    setTitle("");
    setTime("");
    setOpen(false);
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      {withTime && (
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-[86px] rounded-[10px] bg-white px-2 py-1.5 text-[12.5px] outline-none"
          style={{ border: `1px solid ${HAIR}`, color: INK }}
        />
      )}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={withTime ? "Compromisso" : "Tarefa"}
        className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] outline-none"
        style={{ border: `1px solid ${HAIR}`, color: INK }}
      />
      <button
        onClick={submit}
        className="rounded-[10px] px-3 py-1.5 text-[12px] font-medium text-white"
        style={{ background: BLUE }}
      >
        Salvar
      </button>
    </div>
  );
}

function PriorityRow({
  p,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
  editingId,
  editValue,
  setEditValue,
  setEditingId,
}: {
  p: DayPriority;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  setEditingId: (id: string | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
      style={{
        border: "1px solid #F1F2F6",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
      }}
    >
        <button
          aria-label={p.done ? "Desmarcar" : "Concluir"}
          onClick={() => onToggle(p.id, !p.done)}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors"
          style={{
            border: `1.5px solid ${p.done ? BLUE : HAIR}`,
            background: p.done ? BLUE : "transparent",
          }}
        >
          {p.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </button>

        {editingId === p.id ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              const v = editValue.trim();
              if (v && v !== p.title) onEdit(p.id, v);
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingId(null);
            }}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-[14px] outline-none"
            style={{ color: INK, boxShadow: `0 0 0 1px ${BLUE}` }}
          />
        ) : (
          <button
            onClick={() => {
              setEditingId(p.id);
              setEditValue(p.title);
            }}
            className="min-w-0 flex-1 truncate text-left text-[14px]"
            style={{
              color: p.done ? MUTED : INK,
              textDecoration: p.done ? "line-through" : "none",
              textDecorationColor: "rgba(107,107,112,0.35)",
            }}
          >
            {p.title}
          </button>
        )}

      <button
        aria-label="Mais ações"
        onClick={() => setMenuOpen((v) => !v)}
        className="shrink-0 rounded-full p-1"
        style={{ color: "#A8ACB6" }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {menuOpen && (
        <>
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-[80] cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute right-2 top-11 z-[81] w-[172px] overflow-hidden rounded-2xl bg-white py-1"
            style={{
              border: "1px solid #EEF0F5",
              boxShadow: "0 18px 40px -16px rgba(15,23,42,0.22)",
            }}
          >
            <MenuItem
              icon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
              label="Editar"
              onClick={() => {
                setEditingId(p.id);
                setEditValue(p.title);
                setMenuOpen(false);
              }}
            />
            {canMoveUp && (
              <MenuItem
                icon={<ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />}
                label="Mover para cima"
                onClick={() => {
                  onMove(p.id, -1);
                  setMenuOpen(false);
                }}
              />
            )}
            {canMoveDown && (
              <MenuItem
                icon={<ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />}
                label="Mover para baixo"
                onClick={() => {
                  onMove(p.id, 1);
                  setMenuOpen(false);
                }}
              />
            )}
            <MenuItem
              icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
              label="Excluir"
              danger
              onClick={() => {
                onDelete(p.id);
                setMenuOpen(false);
              }}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-[#F7F8FB]"
      style={{ color: danger ? "#D64545" : INK }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Painel do dia: prioridades, agenda e nota rápida. */

function EventRow({
  e,
  onSave,
  onDelete,
}: {
  e: DayEvent;
  onSave: (v: { start_time: string; title: string }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(e.start_time.slice(0, 5));
  const [title, setTitle] = useState(e.title);

  if (editing) {
    return (
      <div
        className="grid gap-2.5 rounded-2xl bg-white px-4 py-3.5"
        style={{ border: `1px solid ${BLUE}`, boxShadow: "0 0 0 3px rgba(51,92,255,0.08)" }}
      >
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(ev) => setTime(ev.target.value)}
            className="w-[92px] rounded-[10px] bg-white px-2 py-1.5 text-[12.5px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: BLUE }}
          />
          <input
            autoFocus
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-1.5 text-[13.5px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-[12.5px]"
            style={{ color: "#D64545" }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Excluir
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditing(false)}
              className="text-[12.5px]"
              style={{ color: MUTED }}
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const t = title.trim();
                if (!t || !/^\d{2}:\d{2}$/.test(time)) return;
                onSave({ start_time: time, title: t });
                setEditing(false);
              }}
              className="rounded-[10px] px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ background: BLUE }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left"
      style={{ border: "1px solid #F1F2F6", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}
    >
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: BLUE_TINT, color: BLUE }}
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <span
        className="w-[50px] shrink-0 text-[13px] font-semibold tabular-nums"
        style={{ color: BLUE }}
      >
        {e.start_time.slice(0, 5)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: INK }}>
        {e.title}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#B7BCC6" }} strokeWidth={1.6} />
    </motion.button>
  );
}

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;

function EmptyAppointment({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-start justify-center py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: BLUE }}>
        Próximo compromisso
      </p>
      <p className="mt-1.5 text-[13px] leading-[1.4]" style={{ color: MUTED }}>
        Nenhum compromisso hoje.
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium"
        style={{ color: BLUE }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Adicionar compromisso
      </button>
    </div>
  );
}

function EmptyPriorities({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-start justify-center py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: BLUE }}>
        Tarefas
      </p>
      <p className="mt-1.5 text-[13px] leading-[1.4]" style={{ color: MUTED }}>
        Nenhuma tarefa definida.
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium"
        style={{ color: BLUE }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Definir tarefas
      </button>
    </div>
  );
}


/** Estado inicial do "Meu dia": a ação principal da MAG, com presença visual. */
function DayIntro({ onAi }: { onAi: () => void }) {
  const { message, say } = useMagSpeech();
  useEffect(() => {
    const t = setTimeout(() => say(magPhrase(MAG_PHRASES.dayEmpty)), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hints = [
    { icon: Clock, label: "Compromissos" },
    { icon: Flag, label: "Tarefas" },
    { icon: Pencil, label: "Notas" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1 w-full overflow-hidden rounded-[26px] bg-white px-5 pb-5 pt-6"
      style={{
        boxShadow: "0 26px 60px -28px rgba(51,92,255,0.42), 0 2px 6px rgba(15,23,42,0.05)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0"
        >
          <MagAvatarMascot state="attention" size={44} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-[17.5px] font-semibold leading-[1.25]"
            style={{ color: INK, letterSpacing: "-0.02em" }}
          >
            Organize seu dia com a MAG.
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-[1.45]" style={{ color: MUTED }}>
            Me conte o que tem hoje e eu organizo para você em poucos segundos.
          </p>
          <MagBubble message={message} align="left" className="mt-2" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {hints.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium"
            style={{ background: "#F5F7FC", color: MUTED }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} style={{ color: BLUE }} />
            {label}
          </span>
        ))}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        onClick={() => {
          haptic(10);
          say(magPhrase(MAG_PHRASES.organizeStart), 2600);
          onAi();
        }}
        className="mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold text-white"
        style={{ background: BLUE, boxShadow: "0 12px 26px -14px rgba(51,92,255,0.75)" }}
      >
        <MagAvatarMascot state="happy" size={18} />
        MAG organiza
      </motion.button>
    </motion.section>
  );
}

function DaySummaryCard({
  nextEvent,
  minutesToNextEvent,
  isToday,
  priorities,
  totalPriorities,
  hasEvents,
  onOpen,
  onToggle,
  onAi,
}: {
  nextEvent: DayEvent | undefined;
  minutesToNextEvent: number | null;
  isToday: boolean;
  priorities: DayPriority[];
  totalPriorities: number;
  hasEvents: boolean;
  onOpen: () => void;
  onToggle: (id: string, done: boolean) => void;
  onAi: () => void;
}) {
  const nowMinutes = useNowMinutes();
  const progress = isToday
    ? Math.min(1, Math.max(0, (nowMinutes - DAY_START) / (DAY_END - DAY_START)))
    : 0;

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 420px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const size = compact ? 124 : 156;
  const stroke = 3.2;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  const dotX = size / 2 + r * Math.cos(angle);
  const dotY = size / 2 + r * Math.sin(angle);

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="mt-3 w-full max-w-full cursor-pointer overflow-hidden rounded-[24px] bg-white transition-shadow"
      style={{
        border: "1px solid #EEF1F7",
        boxShadow: "0 10px 34px -18px rgba(51,92,255,0.18), 0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div className="grid w-full min-w-0 grid-cols-2 gap-3 px-4 pb-5 pt-5 sm:gap-5 sm:px-5">
        {/* Próximo compromisso */}
        <div className="flex min-w-0 flex-col justify-center">
          {hasEvents ? (
            <div className="relative self-center shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="block">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="#EDEFF4"
                  strokeWidth={stroke}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={BLUE}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${c * progress} ${c}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                <circle cx={dotX} cy={dotY} r={4.5} fill={BLUE} />
                <circle cx={dotX} cy={dotY} r={8} fill={BLUE} opacity={0.12} />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p
                  className="text-[10px] font-semibold uppercase leading-none tracking-[0.1em]"
                  style={{ color: BLUE }}
                >
                  Próximo
                </p>
                {nextEvent ? (
                  <>
                    <p
                      className="mt-2 text-[23px] font-semibold tabular-nums leading-none sm:text-[25px]"
                      style={{ color: INK, letterSpacing: "-0.03em" }}
                    >
                      {nextEvent.start_time.slice(0, 5)}
                    </p>
                    <p
                      className="mt-1.5 max-w-[80%] truncate text-[12px] leading-tight"
                      style={{ color: INK }}
                    >
                      {nextEvent.title}
                    </p>
                    {minutesToNextEvent !== null && (
                      <p className="mt-1 text-[11px] leading-none" style={{ color: MUTED }}>
                        {formatIn(minutesToNextEvent)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-[12px] leading-snug" style={{ color: MUTED }}>
                    Nenhum
                    <br />
                    compromisso
                  </p>
                )}
              </div>
            </div>
          ) : (
            <EmptyAppointment onAdd={onOpen} />
          )}
        </div>

        {/* Prioridades */}
        <div className="flex min-w-0 flex-col justify-center">
          {priorities.length === 0 ? (
            <EmptyPriorities onAdd={onOpen} />
          ) : (
            <>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: BLUE }}
              >
                Tarefas
              </p>
              <div className="mt-2.5 grid min-w-0 gap-2 sm:gap-2.5">
                {priorities.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex min-w-0 max-w-full items-center gap-2.5">
                    <button
                      aria-label={p.done ? "Desmarcar" : "Concluir"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(p.id, !p.done);
                      }}
                      className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full transition-colors"
                      style={{
                        border: `1.5px solid ${p.done ? BLUE : "#DDE2EC"}`,
                        background: p.done ? BLUE : "transparent",
                      }}
                    >
                      {p.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </button>
                    <span
                      className="block min-w-0 flex-1 truncate text-[13px] leading-tight"
                      style={{
                        color: p.done ? MUTED : INK,
                        textDecoration: p.done ? "line-through" : "none",
                        textDecorationColor: "rgba(107,107,112,0.35)",
                      }}
                    >
                      {p.title}
                    </span>
                  </div>
                ))}
                {totalPriorities > 3 && (
                  <span className="text-[11.5px] font-medium" style={{ color: BLUE }}>
                    Ver todas ({totalPriorities})
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #F2F4F8" }} />
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <span
          className="inline-flex items-center gap-1 text-[12.5px] font-medium"
          style={{ color: BLUE }}
        >
          Ver mais
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAi();
          }}
          className="inline-flex h-[32px] shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 text-[12.5px] font-medium transition hover:bg-[#F7F9FF] active:opacity-80"
          style={{ borderColor: "rgba(51,92,255,0.22)", color: BLUE }}
        >
          <MagAvatarMascot state="neutral" size={15} />
          MAG organiza
        </button>

      </div>
    </section>
  );
}

export function DayPanel({ localDate }: { localDate: string }) {
  const qc = useQueryClient();
  const fetchPanel = useServerFn(getDayPanel);
  const key = ["day-panel", localDate];
  const { data } = useQuery<{
    priorities: DayPriority[];
    events: DayEvent[];
    note: string;
  }>({
    queryKey: key,
    queryFn: () => fetchPanel({ data: { local_date: localDate } }),
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const mAddP = useMutation({
    mutationFn: (title: string) => addDayPriority({ data: { local_date: localDate, title } }),
    onSuccess: invalidate,
  });
  const mUpdP = useMutation({
    mutationFn: (v: { id: string; done?: boolean; title?: string }) => updateDayPriority({ data: v }),
    onSuccess: invalidate,
  });
  const mDelP = useMutation({
    mutationFn: (id: string) => deleteDayPriority({ data: { id } }),
    onSuccess: invalidate,
  });
  const mReorder = useMutation({
    mutationFn: (ids: string[]) => reorderDayPriorities({ data: { ids } }),
    onSuccess: invalidate,
  });
  const mAddE = useMutation({
    mutationFn: (v: { start_time: string; title: string }) =>
      addDayEvent({ data: { local_date: localDate, ...v } }),
    onSuccess: invalidate,
  });
  const mDelE = useMutation({
    mutationFn: (id: string) => deleteDayEvent({ data: { id } }),
    onSuccess: invalidate,
  });
  const mUpdE = useMutation({
    mutationFn: (v: { id: string; start_time: string; title: string }) =>
      updateDayEvent({ data: v }),
    onSuccess: invalidate,
  });
  const mNote = useMutation({
    mutationFn: (body: string) => saveDayNote({ data: { local_date: localDate, body } }),
    onSuccess: () => {
      setNoteSaved(true);
      invalidate();
    },
  });

  const priorities = data?.priorities ?? [];
  const events = data?.events ?? [];
  const done = priorities.filter((p) => p.done).length;

  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    setOrder(priorities.map((p) => p.id));
  }, [priorities.map((p) => p.id).join(",")]);

  const orderedPriorities = useMemo(() => {
    const map = new Map(priorities.map((p) => [p.id, p]));
    return order.map((id) => map.get(id)).filter((p): p is DayPriority => Boolean(p));
  }, [priorities, order]);

  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  useEffect(() => {
    if (data) setNote(data.note);
  }, [data?.note]);

  // Salvamento automático da nota (debounce).
  useEffect(() => {
    if (!data) return;
    if (note === (data.note ?? "")) return;
    const t = setTimeout(() => mNote.mutate(note), 900);
    return () => clearTimeout(t);
  }, [note, data?.note]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleReorder = (next: string[]) => {
    setOrder(next);
    mReorder.mutate(next);
  };

  const movePriority = (id: string, dir: -1 | 1) => {
    const idx = order.indexOf(id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    handleReorder(next);
  };

  const [fullOpen, setFullOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Próximo compromisso: apenas hoje e apenas horários futuros.
  const ctx = useDayContext(localDate);
  const nextEvent = ctx.nextEvent;
  const hasContent = priorities.length > 0 || events.length > 0;
  const summary = !hasContent && !revealed ? (
    <DayIntro onAi={() => setAiOpen(true)} />
  ) : (
    <DaySummaryCard
      nextEvent={nextEvent}
      minutesToNextEvent={ctx.minutesToNextEvent}
      isToday={ctx.isToday}
      priorities={orderedPriorities}
      totalPriorities={priorities.length}
      hasEvents={events.length > 0}
      onOpen={() => setFullOpen(true)}
      onToggle={(id, done) => mUpdP.mutate({ id, done })}
      onAi={() => setAiOpen(true)}
    />
  );

  const shareModal = (
    <>
    <ShareDayModal
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      data={{ done, total: priorities.length }}
    />
      <DayAiSheet
        open={aiOpen}
        localDate={localDate}
        onClose={() => setAiOpen(false)}
        onApplied={() => {
          setRevealed(true);
          invalidate();
        }}
      />
    </>
  );

  if (!fullOpen)
    return (
      <>
        {summary}
        {shareModal}
      </>
    );

  const full = (
    <div className="grid gap-8 pb-2">
      {/* Prioridades */}
      <section>
        <SectionTitle
          label="Tarefas"
          hint={priorities.length ? `${done} de ${priorities.length} concluídas` : undefined}
        />
        <div className="mt-3 grid gap-2">
          <div className="grid gap-2">
            {orderedPriorities.map((p, i) => (
              <PriorityRow
                key={p.id}
                p={p}
                onToggle={(id, done) => mUpdP.mutate({ id, done })}
                onEdit={(id, title) => mUpdP.mutate({ id, title })}
                onDelete={(id) => mDelP.mutate(id)}
                onMove={movePriority}
                canMoveUp={i > 0}
                canMoveDown={i < orderedPriorities.length - 1}
                editingId={editingId}
                editValue={editValue}
                setEditValue={setEditValue}
                setEditingId={setEditingId}
              />
            ))}
          </div>
        </div>

        {priorities.length === 0 && (
          <p className="mt-2 text-[12.5px] font-light" style={{ color: MUTED }}>
            Até 3 tarefas para hoje.
          </p>
        )}
        {priorities.length < 3 && (
          <AddInline label="Adicionar tarefa" onSubmit={(v) => mAddP.mutate(v.title)} />
        )}
      </section>

      {/* Agenda */}
      <section>
        <SectionTitle label="Agenda de hoje" />
        <div className="mt-3 grid gap-2">
          {events.map((e) => (
            <EventRow
              key={e.id}
              e={e}
              onSave={(v) => mUpdE.mutate({ id: e.id, ...v })}
              onDelete={() => mDelE.mutate(e.id)}
            />
          ))}
        </div>
        {events.length === 0 && (
          <p className="mt-2 text-[12.5px] font-light" style={{ color: MUTED }}>
            Nenhum compromisso registrado.
          </p>
        )}
        <AddInline
          label="Adicionar compromisso"
          withTime
          onSubmit={(v) => mAddE.mutate({ start_time: v.time!, title: v.title })}
        />
      </section>

      {/* Nota rápida */}
      <section>
        <SectionTitle label="Nota rápida" hint={noteSaved ? "Salvo" : undefined} />
        <div
          className="relative mt-3 rounded-[18px] px-4 py-3.5 transition-colors"
          style={{
            background: NOTE_BG,
            border: `1px solid ${noteFocused ? "rgba(51,92,255,0.28)" : "transparent"}`,
          }}
          onClick={(ev) => {
            const ta = (ev.currentTarget as HTMLElement).querySelector("textarea");
            ta?.focus();
          }}
        >
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteSaved(false);
            }}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => {
              setNoteFocused(false);
              if (note !== (data?.note ?? "")) {
                mNote.mutate(note);
              }
            }}
            rows={3}
            placeholder="O que você não pode esquecer hoje?"
            className="w-full resize-none bg-transparent pr-6 text-[14px] leading-relaxed outline-none placeholder:text-[color:var(--text-muted)]"
            style={{ color: INK }}
          />
          <Pencil
            className="pointer-events-none absolute right-3.5 top-3.5 h-3 w-3"
            style={{ color: "rgba(51,92,255,0.55)" }}
            strokeWidth={2}
          />
        </div>
      </section>
    </div>
  );

  return (
    <>
      {summary}
      {shareModal}
      <div className="fixed inset-0 z-[70] flex flex-col bg-white">
        <div className="flex items-center justify-between px-5 pb-2 pt-6">
          <h2
            className="text-[26px] font-semibold"
            style={{ color: INK, letterSpacing: "-0.03em" }}
          >
            Meu dia
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Compartilhar meu dia"
              className="rounded-full p-2"
              style={{ color: "#A8ACB6" }}
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <button
              aria-label="Fechar"
              onClick={() => setFullOpen(false)}
              className="rounded-full p-2"
              style={{ color: "#A8ACB6" }}
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
          <div className="mx-auto w-full max-w-[640px]">{full}</div>
        </div>
      </div>
    </>
  );
}
