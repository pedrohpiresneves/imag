import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestRewardCheck } from "@/components/MagnetRewards";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,

  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Loader2,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import {
  addDayEvent,
  addDayPriority,
  carryPrioritiesToToday,
  listPendingFromYesterday,
  deleteDayEvent,
  deleteDayPriority,
  reorderDayPriorities,
  setDayEventStatus,
  updateDayEvent,
  updateDayPriority,
  type DayEvent,
  type DayPanel,
  type DayPriority,
} from "@/lib/day-panel.functions";
import { applyMyDay, planMyDay, type DayPlan } from "@/lib/day-ai.functions";
import { getTodayMeta } from "@/lib/plans.functions";
import { useDayContext } from "@/components/home/use-day-context";
import { MagAvatarMascot } from "@/components/mag/MagMascot";

import { AttachButton, AttachmentStrip, useAttachments } from "@/components/mag/AttachControl";
import { toPayload } from "@/lib/attachments";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";


const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";
const LINE = "#ECEDF0";
const FIELD = "#ECECEF";
const CARD_BORDER = "rgba(17,26,51,0.07)";
const CARD_SHADOW = "0 1px 2px rgba(17,26,51,0.04), 0 8px 24px -16px rgba(17,26,51,0.18)";


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

const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const CARD_STYLE: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8EAF0",
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(17,26,51,0.03)",
};

/** Preferência de recolhimento memorizada durante a sessão. */
function useSessionCollapse(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const set = (next: boolean) => {
    setValue(next);
    try {
      sessionStorage.setItem(key, next ? "1" : "0");
    } catch {}
  };
  return [value, set] as const;
}

function countdownLabel(minutes: number | null): string {

  if (minutes === null) return "";
  if (minutes <= 0) return "Agora";
  if (minutes < 15) return "Começa em breve";
  if (minutes < 60) return `Começa em ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `Daqui a ${h}h` : `Daqui a ${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Seu dia — compromisso e prioridades em dois cards brancos leves.
 * Tudo editável inline, sem modais ou navegação.
 */
export function DayExecution({
  localDate,
  className = "",
}: {
  localDate: string;
  className?: string;
}) {
  const ctx = useDayContext(localDate);
  const qc = useQueryClient();



  const [editEvent, setEditEvent] = useState(false);

  /* Estado real da direção do dia — usado só para a frase final discreta. */
  const fetchMeta = useServerFn(getTodayMeta);
  const { data: meta } = useQuery({
    queryKey: ["today-meta", localDate],
    queryFn: () => fetchMeta({ data: { local_date: localDate } }),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const everythingDone =
    (meta as { status?: string | null } | null)?.status === "completed" &&
    !ctx.nextEvent &&
    ctx.pastPendingEvents.length === 0 &&
    (ctx.totalCount === 0 || ctx.doneCount === ctx.totalCount);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["day-panel"] });
    qc.invalidateQueries({ queryKey: ["day-context"] });
  };

  /* A MAG pode pedir a edição do próximo compromisso pelo balão. */
  useEffect(() => {
    const open = () => setEditEvent(true);
    window.addEventListener("imag:edit-next-event", open);
    return () => window.removeEventListener("imag:edit-next-event", open);
  });



  return (
    <section className={className}>
      <YesterdayPendingCard localDate={localDate} onRefresh={refresh} />

      <NextEventCard
        localDate={localDate}
        events={ctx.events}
        event={ctx.nextEvent}
        minutesTo={ctx.minutesToNextEvent}
        pastPending={ctx.pastPendingEvents}
        doneEvents={ctx.doneEvents}
        editing={editEvent}
        onEditingChange={setEditEvent}
        onRefresh={refresh}
      />

      <PrioritiesCard
        localDate={localDate}
        priorities={ctx.priorities}
        doneCount={ctx.doneCount}
        totalCount={ctx.totalCount}
        onRefresh={refresh}
      />

      {everythingDone && (
        <p
          className="mt-6 text-center text-[13px] font-light leading-[1.5]"
          style={{ color: "#9A9AA2" }}
        >
          Tudo certo por hoje.
          <br />
          Descanse. Amanhã continuamos.
        </p>
      )}

      <div style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }} />

    </section>
  );
}

/** Card independente de compromissos — próximo compromisso em destaque. */
function NextEventCard({
  localDate,
  events,
  event,
  minutesTo,
  pastPending,
  doneEvents,
  editing,
  onEditingChange,
  onRefresh,
}: {
  localDate: string;
  events: DayEvent[];
  event: DayEvent | undefined;
  minutesTo: number | null;
  pastPending: DayEvent[];
  doneEvents: DayEvent[];
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  /* Somente compromissos futuros disputam o destaque. */
  const main = event;
  const pastIds = useMemo(() => new Set(pastPending.map((e) => e.id)), [pastPending]);
  const listed = useMemo(
    () =>
      events.filter(
        (e) => e.status !== "done" && !pastIds.has(e.id) && (!main || e.id !== main.id),
      ),
    [events, main, pastIds],
  );

  useEffect(() => {
    if (!main) setShowAll(false);
  }, [main]);

  /* Recolher/expandir manual, memorizado durante a sessão. */
  const [collapsed, setCollapsed] = useSessionCollapse("imag:events-collapsed", false);
  const allEventsDone =
    doneEvents.length > 0 && !main && pastPending.length === 0 && listed.length === 0;

  /* Ao concluir tudo, recolhe uma única vez (o usuário pode reabrir). */
  const autoCollapsed = useRef(false);
  useEffect(() => {
    if (allEventsDone && !autoCollapsed.current) {
      autoCollapsed.current = true;
      setCollapsed(true);
    }
    if (!allEventsDone) autoCollapsed.current = false;
  }, [allEventsDone]);

  const forceOpen = adding || editing || editingId !== null;
  const isCollapsed = collapsed && !forceOpen;

  const collapsedSummary = main
    ? `Próximo: ${main.start_time.slice(0, 5)} · ${main.title}`
    : doneEvents.length > 0
      ? `${doneEvents.length} ${doneEvents.length === 1 ? "realizado" : "realizados"} hoje`
      : events.length === 0
        ? "Nenhum compromisso"
        : "Nenhum compromisso restante hoje";

  const doneState = isCollapsed && allEventsDone;

  return (
    <div className="p-3.5" style={CARD_STYLE}>
      <div className="flex items-center gap-3">
        <CalendarClock
          className="h-5 w-5 shrink-0"
          strokeWidth={1.7}
          style={{ color: BLUE }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {doneState && (
              <CheckCircle2
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={1.9}
                style={{ color: "#22A06B" }}
              />
            )}
            <p
              className="truncate text-[17px] font-semibold leading-[22px]"
              style={{ color: INK, letterSpacing: "-0.02em" }}
            >
              {doneState ? "Compromissos encerrados" : "Compromissos"}
            </p>
          </div>
          {isCollapsed && (
            <p
              className="mt-0.5 truncate text-[13px] font-normal leading-tight"
              style={{ color: MUTED }}
            >
              {collapsedSummary}
            </p>
          )}
        </div>

        {!doneState && (
          <button
            type="button"
            aria-label="Adicionar compromisso"
            onClick={() => {
              haptic(6);
              setCollapsed(false);
              setAdding(true);
            }}
            className="shrink-0 p-1 transition active:opacity-60"
            style={{ color: BLUE }}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        )}
        <button
          type="button"
          aria-label={isCollapsed ? "Expandir compromissos" : "Recolher compromissos"}
          aria-expanded={!isCollapsed}
          onClick={() => {
            haptic(5);
            setCollapsed(!collapsed);
          }}
          className="-mr-1 shrink-0 p-1 transition active:opacity-60"
          style={{ color: doneState ? BLUE : MUTED }}
        >
          <ChevronRight
            className="h-[18px] w-[18px] transition-transform duration-300"
            strokeWidth={1.9}
            style={{ transform: isCollapsed ? "none" : "rotate(90deg)" }}
          />
        </button>

      </div>


      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div {...reveal} className="overflow-hidden">


      <div className="mt-3">
        {editing && main ? (
          <div>
            <div className="flex items-center justify-between">
              <p
                className="text-[11px] font-medium uppercase tracking-[0.1em]"
                style={{ color: MUTED }}
              >
                Editar compromisso
              </p>
              <button
                type="button"
                onClick={() => onEditingChange(false)}
                className="text-[12.5px] font-medium transition active:opacity-70"
                style={{ color: BLUE }}
              >
                Concluir
              </button>
            </div>
            <EventInlineEditor event={main} localDate={localDate} onSaved={onRefresh} />
          </div>
        ) : (
          <>
            {main ? (
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span
                      className="text-[18px] font-semibold leading-[1.1]"
                      style={{ color: INK, letterSpacing: "-0.03em" }}
                    >
                      {main.start_time.slice(0, 5)}
                    </span>
                    <span
                      className="text-[15px] font-normal leading-[1.25]"
                      style={{ color: "#4A4A52" }}
                    >
                      {main.title}
                    </span>
                  </p>
                  {minutesTo !== null && (
                    <p className="mt-0.5 text-[13px] font-normal" style={{ color: MUTED }}>
                      {countdownLabel(minutesTo)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Editar compromisso"
                  onClick={() => {
                    haptic(6);
                    onEditingChange(true);
                  }}
                  className="shrink-0 p-1 transition active:opacity-60"
                  style={{ color: "#9A9AA0" }}
                >
                  <Pencil className="h-[14px] w-[14px]" strokeWidth={1.9} />
                </button>
              </div>
            ) : null}

            {pastPending.length > 0 && (
              <div className="mt-2.5">
                {pastPending.map((ev) => (
                  <PastEventRow
                    key={ev.id}
                    event={ev}
                    localDate={localDate}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}

            {doneEvents.length > 0 && (
              <ul className="mt-2.5 space-y-0.5">
                {doneEvents.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2">
                    <Check className="h-[12px] w-[12px] shrink-0" strokeWidth={2.4} style={{ color: BLUE }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-light" style={{ color: MUTED }}>
                      {ev.start_time.slice(0, 5)} · {ev.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {listed.length > 0 && (
              <>
                <div className="mt-3 h-px w-full" style={{ background: "#F2F3F6" }} />
                <button
                  type="button"
                  onClick={() => {
                    haptic(5);
                    setShowAll((v) => !v);
                  }}
                  className="mt-2.5 flex w-full items-center justify-between text-[12.5px] font-medium transition active:opacity-70"
                  style={{ color: BLUE }}
                >
                  {showAll
                    ? "Ocultar compromissos"
                    : listed.length === 1
                      ? "Ver outro compromisso"
                      : `Ver outros ${listed.length} compromissos`}
                  <ChevronRight
                    className="h-[14px] w-[14px] transition-transform"
                    strokeWidth={1.9}
                    style={{ transform: showAll ? "rotate(90deg)" : "none" }}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {showAll && (
                    <motion.div {...reveal} className="overflow-hidden">
                      <ul className="mt-2">
                        {listed.map((ev) => (
                          <EventRow
                            key={ev.id}
                            event={ev}
                            localDate={localDate}
                            editing={editingId === ev.id}
                            onEdit={(v) => setEditingId(v ? ev.id : null)}
                            onRefresh={onRefresh}
                          />
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            <AnimatePresence initial={false}>
              {adding && (
                <motion.div {...reveal} className="overflow-hidden">
                  <EventAddForm
                    localDate={localDate}
                    onSaved={() => {
                      setAdding(false);
                      onRefresh();
                    }}
                    onCancel={() => setAdding(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}

/** Compromisso cujo horário já passou — "Aconteceu?" com Sim ou Reagendar. */
function PastEventRow({
  event,
  localDate,
  onRefresh,
}: {
  event: DayEvent;
  localDate: string;
  onRefresh: () => void;
}) {
  const setStatus = useServerFn(setDayEventStatus);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await setStatus({ data: { id: event.id, status: "done" } });
      haptic(10);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Não consegui salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-1.5" style={{ borderTop: `1px solid ${LINE}` }}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className="text-[14px] font-semibold" style={{ color: INK }}>
          {event.start_time.slice(0, 5)}
        </span>
        <span className="text-[14px]" style={{ color: "#4A4A52" }}>
          {event.title}
        </span>
      </p>
      {rescheduling ? (
        <EventInlineEditor
          event={event}
          localDate={localDate}
          onSaved={() => {
            setRescheduling(false);
            onRefresh();
          }}
        />
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12.5px] font-light" style={{ color: MUTED }}>
            Aconteceu?
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="rounded-full px-2.5 py-0.5 text-[12px] font-medium transition active:opacity-70 disabled:opacity-40"
            style={{ background: "#F1F4FF", color: BLUE }}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => {
              haptic(6);
              setRescheduling(true);
            }}
            className="rounded-full px-2.5 py-0.5 text-[12px] font-medium transition active:opacity-70"
            style={{ background: "#F7F8FA", color: MUTED }}
          >
            Reagendar
          </button>
        </div>
      )}
    </div>
  );
}


/** Linha compacta de compromisso — horário em chip azul, título e menu. */
function EventRow({
  event,
  localDate,
  editing,
  onEdit,
  onRefresh,
}: {
  event: DayEvent;
  localDate: string;
  editing: boolean;
  onEdit: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const remove = useServerFn(deleteDayEvent);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function drop() {
    if (busy) return;
    setBusy(true);
    try {
      await remove({ data: { id: event.id } });
      setMenu(false);
      setConfirm(false);
      haptic(10);
      toast.success("Compromisso excluído.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-1" style={{ borderTop: `1px solid ${LINE}` }}>
      {editing ? (
        <div>
          <EventInlineEditor event={event} localDate={localDate} onSaved={() => { onEdit(false); onRefresh(); }} />
          <button
            type="button"
            onClick={() => onEdit(false)}
            className="mt-1 text-[12px] font-medium transition active:opacity-70"
            style={{ color: MUTED }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="shrink-0 rounded-[7px] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{ background: "rgba(51,92,255,0.09)", color: BLUE }}
          >
            {event.start_time.slice(0, 5)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: INK }}>
            {event.title}
          </span>
          <button
            type="button"
            aria-label="Ações do compromisso"
            onClick={() => {
              haptic(6);
              setMenu((v) => !v);
              setConfirm(false);
            }}
            className="-mr-1 shrink-0 p-1 transition active:opacity-60"
            style={{ color: "#9A9AA0" }}
          >
            <MoreHorizontal className="h-[16px] w-[16px]" strokeWidth={1.9} />
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {menu && !editing && (
          <motion.div {...reveal} className="overflow-hidden">
            <div className="mt-1 rounded-[12px] p-1" style={{ background: "#F7F8FA" }}>
              {confirm ? (
                <div className="px-2 py-1.5">
                  <p className="text-[12px]" style={{ color: INK }}>
                    Excluir este compromisso?
                  </p>
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={drop}
                      className="text-[12px] font-medium transition active:opacity-70 disabled:opacity-40"
                      style={{ color: "#D14343" }}
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(false)}
                      className="text-[12px] font-medium transition active:opacity-70"
                      style={{ color: MUTED }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MenuItem
                    label="Editar compromisso"
                    onClick={() => {
                      setMenu(false);
                      onEdit(true);
                    }}
                  />
                  <MenuItem label="Excluir compromisso" tone="#D14343" onClick={() => setConfirm(true)} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Formulário compacto de novo compromisso — abre dentro do próprio card. */
function EventAddForm({
  localDate,
  onSaved,
  onCancel,
}: {
  localDate: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const add = useServerFn(addDayEvent);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const canAdd = /^\d{2}:\d{2}$/.test(time) && title.trim().length > 0 && !busy;

  async function submit() {
    if (!canAdd) return;
    setBusy(true);
    try {
      await add({ data: { local_date: localDate, start_time: time, title: title.trim() } });
      haptic(8);
      toast.success("Compromisso adicionado.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message || "Não consegui adicionar agora.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-[14px] p-2.5" style={{ background: "#F7F8FA" }}>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Horário"
          className="w-[88px] shrink-0 rounded-[10px] bg-white px-2 py-1.5 text-[12.5px] outline-none"
          style={{ color: INK, border: `1px solid ${FIELD}` }}
        />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Nome do compromisso"
          maxLength={140}
          className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
          style={{ color: INK, border: `1px solid ${FIELD}` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] font-medium transition active:opacity-70"
          style={{ color: MUTED }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canAdd}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-white transition active:opacity-80 disabled:opacity-30"
          style={{ background: BLUE }}
        >
          {busy ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone = INK,
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[10px] px-2 py-2 text-left text-[12.5px] transition active:opacity-60 disabled:opacity-40"
      style={{ color: tone }}
    >
      {label}
    </button>
  );
}

/**
 * Pendências de ontem — faixa sutil dentro do painel unificado.
 * O item só vira tarefa de hoje quando o usuário confirma.
 */
function YesterdayPendingCard({
  localDate,
  onRefresh,
}: {
  localDate: string;
  onRefresh: () => void;
}) {
  const fetchPending = useServerFn(listPendingFromYesterday);
  const carry = useServerFn(carryPrioritiesToToday);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["yesterday-pending", localDate],
    queryFn: () => fetchPending({ data: { local_date: localDate } }),
    retry: false,
  });

  const items = data ?? [];
  if (dismissed || items.length === 0) return null;

  async function keep(ids: string[]) {
    if (busy) return;
    setBusy(true);
    try {
      await carry({ data: { local_date: localDate, ids } });
      haptic(8);
      setDismissed(true);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Não consegui trazer agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 px-3.5 py-2" style={{ ...CARD_STYLE, background: "#FAFBFC" }}>
      <p className="text-[12px] font-medium" style={{ color: INK }}>
        Ficou pendente ontem
      </p>
      <ul className="mt-0.5 space-y-0">
        {items.map((p) => (
          <li key={p.id} className="text-[12.5px] font-light" style={{ color: MUTED }}>
            {p.title}
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => keep(items.map((p) => p.id))}
          className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#EEF2FF", color: BLUE }}
        >
          Manter para hoje
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            haptic(4);
            setDismissed(true);
          }}
          className="rounded-full px-2.5 py-1 text-[11.5px] font-light transition active:opacity-70"
          style={{ color: MUTED }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

/**
 * Linha de tarefa com gesto de deslizar para a esquerda revelando exclusão.
 * Sem lixeira visível em repouso — o gesto é o único caminho.
 */
function SwipeTaskRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  return (
    <div className="relative overflow-hidden">
      {/* Zona de exclusão revelada pelo gesto */}
      <div
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-end pr-4"
        style={{ background: "#FDEDED" }}
        aria-hidden
      >
        <Trash2 className="h-4 w-4" style={{ color: "#D14343" }} strokeWidth={1.9} />
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={{ left: 0.35, right: 0 }}
        dragMomentum={false}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -52) {
            haptic(10);
            onDelete();
          }
        }}
        className="relative"
        style={{ background: "#FFFFFF" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Seção de tarefas dentro do painel unificado "Seu dia". */
function PrioritiesCard({
  localDate,
  priorities,
  doneCount,
  totalCount,
  onRefresh,
}: {
  localDate: string;
  priorities: DayPriority[];
  doneCount: number;
  totalCount: number;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const toggle = useServerFn(updateDayPriority);
  const add = useServerFn(addDayPriority);
  const reorder = useServerFn(reorderDayPriorities);

  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [collapsedDone, setCollapsedDone] = useSessionCollapse("imag:tasks-collapsed", false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const key = ["day-panel", localDate];
  const mutate = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPanel>(key);
      qc.setQueryData<DayPanel>(key, (old) =>
        old
          ? {
              ...old,
              priorities: old.priorities.map((p) => (p.id === v.id ? { ...p, done: v.done } : p)),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(key, c.prev),
    onSettled: () => {
      onRefresh();
      requestRewardCheck();
    },
  });

  const remove = useServerFn(deleteDayPriority);
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPanel>(key);
      qc.setQueryData<DayPanel>(key, (old) =>
        old ? { ...old, priorities: old.priorities.filter((p) => p.id !== id) } : old,
      );
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(key, c.prev),
    onSettled: () => onRefresh(),
  });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const progress = useMemo(
    () => (totalCount === 0 ? 0 : doneCount / totalCount),
    [doneCount, totalCount],
  );
  const allDone = totalCount > 0 && doneCount === totalCount;

  /* Ao concluir tudo, recolhe uma vez com microanimação. Reabre a qualquer momento. */
  const autoCollapsed = useRef(false);
  useEffect(() => {
    if (allDone && !autoCollapsed.current) {
      autoCollapsed.current = true;
      setCollapsedDone(true);
    }
    if (!allDone) autoCollapsed.current = false;
  }, [allDone]);


  async function create() {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await add({ data: { local_date: localDate, title } });
      setDraft("");
      setAdding(false);
      haptic(8);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Não consegui adicionar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...priorities];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    qc.setQueryData<DayPanel>(key, (old) => (old ? { ...old, priorities: next } : old));
    haptic(6);
    await reorder({ data: { ids: next.map((p) => p.id) } });
    onRefresh();
  }

  const summary =
    totalCount === 0
      ? "Nenhuma tarefa"
      : `${doneCount} de ${totalCount} ${totalCount === 1 ? "concluída" : "concluídas"}`;

  const forceOpen = adding || editMode;
  const isCollapsed = collapsedDone && !forceOpen;

  const doneState = isCollapsed && allDone;

  return (
    <div className="mt-3 p-3.5" style={CARD_STYLE}>

      <div className="flex items-center gap-3">
        {doneState ? (
          <Check
            className="h-5 w-5 shrink-0"
            strokeWidth={2.4}
            style={{ color: BLUE }}
          />
        ) : (
          <CheckSquare
            className="h-5 w-5 shrink-0"
            strokeWidth={1.7}
            style={{ color: BLUE }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {doneState && (
              <CheckCircle2
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={1.9}
                style={{ color: "#22A06B" }}
              />
            )}
            <p
              className="truncate text-[17px] font-semibold leading-[22px]"
              style={{ color: INK, letterSpacing: "-0.02em" }}
            >
              {doneState ? "Tarefas concluídas" : "Tarefas"}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-normal leading-tight" style={{ color: MUTED }}>
            {summary}
          </p>
        </div>

        {!doneState && (
          <button
            type="button"
            aria-label="Adicionar tarefa"
            onClick={() => {
              haptic(6);
              setCollapsedDone(false);
              setAdding(true);
            }}
            className="shrink-0 p-1 transition active:opacity-60"
            style={{ color: BLUE }}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        )}
        <button
          type="button"
          aria-label={isCollapsed ? "Expandir tarefas" : "Recolher tarefas"}
          aria-expanded={!isCollapsed}
          onClick={() => {
            haptic(5);
            setCollapsedDone(!collapsedDone);
          }}
          className="-mr-1 shrink-0 p-1 transition active:opacity-60"
          style={{ color: doneState ? BLUE : MUTED }}
        >
          <ChevronRight
            className="h-[18px] w-[18px] transition-transform duration-300"
            strokeWidth={1.9}
            style={{ transform: isCollapsed ? "none" : "rotate(90deg)" }}
          />
        </button>

      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (totalCount > 0 || adding || editMode) && (

          <motion.div {...reveal} className="overflow-hidden">
            <div className="mt-2.5">
              {totalCount > 0 && doneCount > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="h-[3px] flex-1 overflow-hidden rounded-full"
                    style={{ background: "#F0F1F4" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      animate={{
                        width: `${Math.max(progress * 100, progress === 0 ? 3 : 0)}%`,
                      }}
                      transition={{ type: "spring", stiffness: 180, damping: 26 }}
                      style={{ background: BLUE }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      haptic(6);
                      setEditMode((v) => !v);
                    }}
                    className="text-[12px] font-medium transition active:opacity-70"
                    style={{ color: BLUE }}
                  >
                    {editMode ? "Salvar" : "Editar"}
                  </button>
                </div>
              )}

              {totalCount > 0 && (
                <ul className="mt-1.5">
                  {priorities.map((p, i) => (
                    <li key={p.id} style={i > 0 ? { borderTop: `1px solid ${LINE}` } : undefined}>
                      {editMode ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <div className="min-w-0 flex-1">
                            <PriorityInlineEditor priority={p} onSaved={onRefresh} />
                          </div>
                          <button
                            type="button"
                            aria-label="Mover para cima"
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            className="p-1 transition active:opacity-60 disabled:opacity-25"
                            style={{ color: MUTED }}
                          >
                            <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            aria-label="Mover para baixo"
                            disabled={i === priorities.length - 1}
                            onClick={() => move(i, 1)}
                            className="p-1 transition active:opacity-60 disabled:opacity-25"
                            style={{ color: MUTED }}
                          >
                            <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                          <PriorityDeleteButton id={p.id} onDeleted={onRefresh} />
                        </div>
                      ) : (
                        <SwipeTaskRow
                          key={p.id}
                          onDelete={() => del.mutate(p.id)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              haptic(8);
                              mutate.mutate({ id: p.id, done: !p.done });
                            }}
                            className="flex min-h-[42px] w-full items-center gap-2.5 py-1.5 text-left"
                          >
                            <motion.span
                              whileTap={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                              style={{
                                border: p.done ? `1px solid ${BLUE}` : `1px solid #D6D8DE`,
                                background: p.done ? BLUE : "transparent",
                              }}
                            >
                              {p.done && (
                                <Check className="h-[10px] w-[10px] text-white" strokeWidth={3} />
                              )}
                            </motion.span>
                            <span
                              className="min-w-0 flex-1 text-[15px] font-normal transition-all duration-300"
                              style={{
                                color: p.done ? MUTED : INK,
                                textDecoration: p.done ? "line-through" : undefined,
                                textDecorationColor: "rgba(17,17,17,0.25)",
                                opacity: p.done ? 0.72 : 1,
                              }}
                            >
                              {p.title}
                            </span>

                          </button>
                        </SwipeTaskRow>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {adding && (
                <div
                  style={{ borderTop: totalCount > 0 ? `1px solid ${LINE}` : undefined }}
                  className="mt-1 flex items-center gap-2 py-2"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create();
                      if (e.key === "Escape") {
                        setAdding(false);
                        setDraft("");
                      }
                    }}
                    placeholder="Nova tarefa"
                    maxLength={140}
                    className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] outline-none"
                    style={{ color: INK, border: `1px solid ${FIELD}` }}
                  />
                  <button
                    type="button"
                    onClick={create}
                    disabled={busy || !draft.trim()}
                    className="shrink-0 text-[12px] font-medium transition active:opacity-70 disabled:opacity-30"
                    style={{ color: BLUE }}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setDraft("");
                    }}
                    className="shrink-0 text-[12px] font-medium transition active:opacity-70"
                    style={{ color: MUTED }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <AnimatePresence initial={false}>
                {allDone && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pt-1 text-[12px] font-medium"
                    style={{ color: BLUE }}
                  >
                    Tarefas concluídas ✨
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Exclusão de prioridade com confirmação leve. */
function PriorityDeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const remove = useServerFn(deleteDayPriority);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirm) {
    return (
      <span className="flex shrink-0 items-center gap-2 pl-1">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await remove({ data: { id } });
              onDeleted();
            } finally {
              setBusy(false);
            }
          }}
          className="text-[12px] font-medium transition active:opacity-70 disabled:opacity-40"
          style={{ color: "#D14343" }}
        >
          Excluir
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-[12px] font-medium transition active:opacity-70"
          style={{ color: MUTED }}
        >
          Não
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label="Excluir prioridade"
      onClick={() => setConfirm(true)}
      className="shrink-0 p-1 transition active:opacity-60"
      style={{ color: "#D14343" }}
    >
      <Trash2 className="h-4 w-4" strokeWidth={1.7} />
    </button>
  );
}




/** Captura por texto, voz e anexos — tudo inline e compacto. */
function OrganizeInline({
  localDate,
  onDone,
  onCancel,
}: {
  localDate: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const plan_ = useServerFn(planMyDay);
  const apply_ = useServerFn(applyMyDay);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [error, setError] = useState<{ msg: string; retry: boolean } | null>(null);
  const att = useAttachments();
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => () => recRef.current?.stop(), []);

  /* Recupera rascunho salvo quando a sessão expirou durante o envio. */
  useEffect(() => {
    try {
      const draft = localStorage.getItem("imag:day-draft");
      if (draft) {
        setText((t) => t || draft);
        localStorage.removeItem("imag:day-draft");
      }
    } catch {
      /* ignora */
    }
  }, []);

  const run = useMutation({
    mutationFn: async () => {
      const plan: DayPlan = await plan_({
        data: { text: text.trim(), local_date: localDate, attachments: toPayload(att.items) },
      });
      if (!plan.priorities.length && !plan.events.length && !plan.note) {
        throw new Error("empty");
      }
      await apply_({ data: { local_date: localDate, ...plan } });
    },
    onSuccess: () => {
      haptic([10, 40, 14]);
      setText("");
      att.clear();
      toast.success("Seu dia foi organizado.");
      onDone();
    },
    onError: (e: Error) => {
      const raw = e.message || "";
      if (/unauthorized|jwt|no authorization/i.test(raw)) {
        try {
          localStorage.setItem("imag:day-draft", text);
        } catch {
          /* ignora */
        }
        setError({ msg: "Seu acesso expirou. Entre novamente para continuar.", retry: false });
        return;
      }
      if (raw === "trial_expired") {
        setError({ msg: "Seu período gratuito terminou. Ative um plano para continuar.", retry: false });
        return;
      }
      if (raw === "empty") {
        setError({ msg: "Não identifiquei prioridades. Tente descrever com mais detalhes.", retry: true });
        return;
      }
      setError({ msg: "Não consegui organizar agora.", retry: true });
    },
  });

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

  const canSend = text.trim().length >= 2 || att.ready.length > 0;

  function submit() {
    if (!canSend || run.isPending) return;
    recRef.current?.stop();
    setError(null);
    run.mutate();
  }

  if (run.isPending) {
    return (
      <div className="flex items-center gap-3 pt-3">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MagAvatarMascot state="organizing" size={30} />
        </motion.div>
        <p className="text-[13.5px] font-medium" style={{ color: INK }}>
          A MAG está organizando…
        </p>
        <Loader2 className="ml-auto h-4 w-4 animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="pt-2.5">
      <p
        className="text-[14.5px] font-semibold leading-[1.25]"
        style={{ color: INK, letterSpacing: "-0.02em" }}
      >
        O que você precisa resolver hoje?
      </p>
      <p className="mt-1 text-[12px] font-light leading-[1.4]" style={{ color: MUTED }}>
        Escreva, fale ou anexe. A MAG organiza para você.
      </p>

      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={2}
        placeholder="Ex.: responder pacientes e consulta às 15h"
        className="mt-2.5 w-full resize-none rounded-[14px] bg-white px-3.5 py-2.5 text-[14px] leading-[1.45] outline-none"
        style={{
          color: INK,
          border: `1px solid ${FIELD}`,
          minHeight: 62,
          maxHeight: 200,
          overflowY: "auto",
          resize: "none",
          whiteSpace: "pre-wrap",
        }}
      />

      <AttachmentStrip items={att.items} onRemove={att.remove} />

      {listening && (
        <p className="mt-1.5 flex items-center gap-2 text-[12px]" style={{ color: BLUE }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: BLUE }} />
          Ouvindo…
        </p>
      )}
      {voiceUnavailable && !listening && (
        <p className="mt-1.5 text-[12px]" style={{ color: MUTED }}>
          Seu navegador não suporta ditado. Pode escrever aqui.
        </p>
      )}
      {error && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] leading-[1.4]" style={{ color: MUTED }}>
            {error.msg}
          </p>
          {error.retry && (
            <button
              type="button"
              onClick={submit}
              className="text-[12.5px] font-medium transition active:opacity-70"
              style={{ color: BLUE }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <AttachButton onFiles={att.add} />
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={listening ? "Parar" : "Falar"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:opacity-80"
          style={
            listening
              ? { background: BLUE, color: "#FFFFFF" }
              : { border: `1px solid ${FIELD}`, color: INK, background: "#FFFFFF" }
          }
        >
          {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" strokeWidth={1.8} />}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSend || run.isPending}
          className="flex-1 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-white transition active:opacity-80 disabled:opacity-30"
          style={{ background: BLUE }}
        >
          Organizar com a MAG
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 px-1.5 py-2.5 text-[12px] font-medium transition active:opacity-70"
          style={{ color: MUTED }}
        >
          Recolher
        </button>
      </div>
    </div>
  );
}

/** Edição inline do compromisso — sem sair da tela. */
function EventInlineEditor({
  event,
  localDate,
  onSaved,
}: {
  event: DayEvent;
  localDate: string;
  onSaved: () => void;
}) {
  const save = useServerFn(updateDayEvent);
  const remove = useServerFn(deleteDayEvent);
  const [title, setTitle] = useState(event.title);
  const [time, setTime] = useState(event.start_time.slice(0, 5));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(event.title);
    setTime(event.start_time.slice(0, 5));
  }, [event.id, event.title, event.start_time]);

  async function commit() {
    if (!title.trim() || !/^\d{2}:\d{2}$/.test(time)) return;
    if (title.trim() === event.title && time === event.start_time.slice(0, 5)) return;
    setBusy(true);
    try {
      await save({
        data: { id: event.id, title: title.trim(), start_time: time, day_date: localDate },
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-1.5 flex items-center gap-2 rounded-[16px] px-2.5 py-2"
      style={{ background: "#FBFBFC" }}
    >
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={commit}
        className="w-[84px] shrink-0 rounded-[10px] bg-white px-2 py-1.5 text-[12.5px] outline-none"
        style={{ color: INK, border: `1px solid ${FIELD}` }}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        maxLength={140}
        className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
        style={{ color: INK, border: `1px solid ${FIELD}` }}
      />
      <button
        type="button"
        disabled={busy}
        aria-label="Excluir compromisso"
        onClick={async () => {
          setBusy(true);
          try {
            await remove({ data: { id: event.id } });
            onSaved();
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 p-1 transition active:opacity-60 disabled:opacity-40"
        style={{ color: "#D14343" }}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
      </button>
    </div>
  );
}

/** Edição inline de uma prioridade. */
function PriorityInlineEditor({
  priority,
  onSaved,
}: {
  priority: { id: string; title: string };
  onSaved: () => void;
}) {
  const update = useServerFn(updateDayPriority);
  const [title, setTitle] = useState(priority.title);

  useEffect(() => setTitle(priority.title), [priority.id, priority.title]);

  async function commit() {
    const v = title.trim();
    if (!v || v === priority.title) return;
    await update({ data: { id: priority.id, title: v } });
    onSaved();
  }

  return (
    <div className="px-2 py-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        maxLength={140}
        className="w-full rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] outline-none"
        style={{ color: INK, border: `1px solid ${FIELD}` }}
      />
    </div>
  );
}
