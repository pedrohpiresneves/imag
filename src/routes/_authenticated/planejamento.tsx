import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlanIcon, PlanIconPicker } from "@/components/planning/PlanIcon";
import { BottomNav, BottomNavSpacer } from "@/components/BottomNav";
import {
  listPlanning,
  createPlanningItem,
  updatePlanningItem,
  deletePlanningItem,
  type PlanningItem,
  type PlanKind,
} from "@/lib/planning.functions";

export const Route = createFileRoute("/_authenticated/planejamento")({
  validateSearch: (search: Record<string, unknown>): { d?: string; edit?: string } => {
    const out: { d?: string; edit?: string } = {};
    if (typeof search["d"] === "string") out.d = search["d"];
    if (typeof search["edit"] === "string") out.edit = search["edit"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Planejamento · iMAG" },
      {
        name: "description",
        content: "Organize compromissos, tarefas e metas — a MAG usa tudo para montar o seu Hoje.",
      },
      { property: "og:title", content: "Planejamento · iMAG" },
      {
        property: "og:description",
        content: "Organize compromissos, tarefas e metas — a MAG usa tudo para montar o seu Hoje.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PlanejamentoPage,
});

const BLUE = "#335CFF";
const CARD: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8EAF0",
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(17,26,51,0.03)",
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const KIND_LABEL: Record<PlanKind, string> = {
  event: "Compromisso",
  task: "Tarefa",
  goal_week: "Meta semanal",
  goal_month: "Meta mensal",
  goal_year: "Meta anual",
  deadline: "Prazo ou lembrete",
};

function iso(d: Date) {
  return d.toLocaleDateString("en-CA");
}
function parseIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

type Period = "week" | "month" | "year";

function PlanejamentoPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = iso(new Date());
  const [period, setPeriod] = useState<Period>("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const search = useSearch({ from: "/_authenticated/planejamento" });
  const [selected, setSelected] = useState<string>(
    search.d && /^\d{4}-\d{2}-\d{2}$/.test(search.d) ? search.d : today,
  );
  const [composer, setComposer] = useState(false);
  const [editing, setEditing] = useState<PlanningItem | null>(null);

  const range = useMemo(() => {
    if (period === "year") {
      return { from: `${cursor.y}-01-01`, to: `${cursor.y}-12-31` };
    }
    if (period === "week") {
      const base = parseIso(selected);
      const start = new Date(base);
      start.setDate(base.getDate() - base.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: iso(start), to: iso(end) };
    }
    const start = new Date(cursor.y, cursor.m, 1);
    const end = new Date(cursor.y, cursor.m + 1, 0);
    return { from: iso(start), to: iso(end) };
  }, [period, cursor, selected]);

  const fetchPlanning = useServerFn(listPlanning);
  const { data: items = [] } = useQuery({
    queryKey: ["planning", range.from, range.to],
    queryFn: () => fetchPlanning({ data: range }),
  });

  // Itens futuros (com data) e itens sem data.
  const withDate = items.filter((i) => i.date);
  const noDate = items.filter((i) => !i.date);
  const daysWithItems = new Set(withDate.map((i) => i.date!));

  // Abertura direta vinda do chat da MAG (?d=data&edit=id).
  const openedEdit = useRef<string | null>(null);
  useEffect(() => {
    if (search.d && /^\d{4}-\d{2}-\d{2}$/.test(search.d)) {
      setSelected(search.d);
      const [y, m] = search.d.split("-").map(Number);
      if (y && m) setCursor({ y, m: m - 1 });
    }
  }, [search.d]);
  useEffect(() => {
    if (!search.edit || openedEdit.current === search.edit) return;
    const found = items.find((i) => i.id === search.edit);
    if (found) {
      openedEdit.current = search.edit;
      setEditing(found);
    }
  }, [search.edit, items]);
  // Ordena por horário; itens sem horário ficam no fim.
  const selectedItems = withDate
    .filter((i) => i.date === selected)
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["planning"] });
    qc.invalidateQueries({ queryKey: ["day-panel"] });
  };

  const create = useMutation({
    mutationFn: (v: NewItem) => createPlanningItem({ data: v }),
    onSuccess: () => {
      invalidate();
      setComposer(false);
    },
  });
  const update = useMutation({
    mutationFn: (v: {
      id: string;
      title?: string;
      date?: string | null;
      time?: string | null;
      done?: boolean;
    }) => updatePlanningItem({ data: v }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePlanningItem({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  return (
    <div className="min-h-screen bg-white text-[#111111]" style={{ fontFamily: "var(--font-sans)" }}>
      {/* 1 · Cabeçalho */}
      <PageHeader
        title="Planejamento"
        divider
        right={
          <button
            type="button"
            aria-label="Adicionar item"
            onClick={() => setComposer(true)}
            className="grid h-10 w-10 place-items-center rounded-full transition active:opacity-60"
            style={{ color: BLUE }}
          >
            <Plus className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </button>
        }
      />


      <main className="mx-auto max-w-[520px] px-5 pt-4">
        {/* 2 · Períodos */}
        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ border: "1px solid #E8EAF0" }}
        >
          {(["week", "month", "year"] as Period[]).map((p) => {
            const label = p === "week" ? "Semana" : p === "month" ? "Mês" : "Ano";
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className="flex-1 rounded-full py-2 text-[14px] font-medium transition"
                style={{
                  background: active ? BLUE : "transparent",
                  color: active ? "#FFFFFF" : "#6B7280",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 3 · Calendário */}
        <section className="mt-4 p-4" style={CARD}>
          {period === "year" ? (
            <YearGrid
              year={cursor.y}
              itemsByMonth={countByMonth(withDate)}
              onPrev={() => setCursor((c) => ({ ...c, y: c.y - 1 }))}
              onNext={() => setCursor((c) => ({ ...c, y: c.y + 1 }))}
              onPick={(m) => {
                setCursor((c) => ({ ...c, m }));
                setPeriod("month");
              }}
            />
          ) : (
            <MonthGrid
              period={period}
              cursor={cursor}
              selected={selected}
              today={today}
              marked={daysWithItems}
              onPrev={() =>
                setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))
              }
              onNext={() =>
                setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))
              }
              onSelect={setSelected}
            />
          )}

        </section>

        {/* 4 · Itens do dia selecionado (única listagem da tela) */}
        <section className="mt-5">
          <h2 className="text-[17px] font-semibold" style={{ letterSpacing: "-0.02em" }}>
            {formatLongDate(selected)}
          </h2>
          <div className="mt-2 overflow-hidden" style={CARD}>
            {selectedItems.length === 0 ? (
              <p className="px-4 py-3.5 text-[14px] text-[#8A90A2]">Nenhum item neste dia.</p>
            ) : (
              selectedItems.map((i, idx) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setEditing(i)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                  style={idx > 0 ? { borderTop: "1px solid #F4F6FA" } : undefined}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "#EEF2FF" }}
                  >
                    <PlanIcon icon={i.icon} title={i.title} info={i.info} size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{i.title}</span>
                  <span className="shrink-0 text-[13px] text-[#8A90A2]">
                    {i.time ?? "Tarefa"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>


        {/* 5 · Sem data (só quando existem tarefas sem data) */}
        {noDate.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[18px] font-semibold" style={{ letterSpacing: "-0.02em" }}>
            Sem data
          </h2>
          <div className="mt-2 overflow-hidden" style={CARD}>
            {
              noDate.map((i, idx) => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={idx > 0 ? { borderTop: "1px solid #F1F3F7" } : undefined}
                >
                  <button
                    type="button"
                    aria-label={i.done ? "Marcar como pendente" : "Concluir"}
                    onClick={() => update.mutate({ id: i.id, done: !i.done })}
                    className="h-[22px] w-[22px] shrink-0 rounded-full"
                    style={{
                      border: `1.5px solid ${i.done ? BLUE : "#D6DAE4"}`,
                      background: i.done ? BLUE : "transparent",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(i)}
                    className="min-w-0 flex-1 truncate text-left text-[16px]"
                    style={i.done ? { color: "#8A90A2", textDecoration: "line-through" } : undefined}
                  >
                    {i.title}
                  </button>
                  <button
                    type="button"
                    aria-label="Definir data"
                    onClick={() => update.mutate({ id: i.id, date: selected })}
                  >
                    <Plus size={20} color={BLUE} />
                  </button>
                </div>
              ))
            }
          </div>
          <p className="mt-2 text-[13px] text-[#8A90A2]">
            Toque no “+” para agendar no dia selecionado ({formatShortDate(selected)}).
          </p>
        </section>
        )}

        <BottomNavSpacer />
      </main>

      {composer && (
        <Composer
          defaultDate={selected}
          pending={create.isPending}
          error={create.error instanceof Error ? create.error.message : null}
          onClose={() => setComposer(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}

      {editing && (
        <EditSheet
          item={editing}
          pending={update.isPending || remove.isPending}
          onClose={() => setEditing(null)}
          onSave={(v) => update.mutate({ id: editing.id, ...v })}
          onDelete={() => remove.mutate(editing.id)}
        />
      )}

      <BottomNav />
    </div>
  );
}

function countByMonth(items: PlanningItem[]) {
  const map = new Map<number, number>();
  for (const i of items) {
    if (!i.date) continue;
    const m = Number(i.date.slice(5, 7)) - 1;
    map.set(m, (map.get(m) ?? 0) + 1);
  }
  return map;
}

function formatLongDate(s: string) {
  const d = parseIso(s);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
function formatShortDate(s: string) {
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}

function MonthGrid({
  period,
  cursor,
  selected,
  today,
  marked,
  onPrev,
  onNext,
  onSelect,
}: {
  period: Period;
  cursor: { y: number; m: number };
  selected: string;
  today: string;
  marked: Set<string>;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (d: string) => void;
}) {
  const days = useMemo(() => {
    if (period === "week") {
      const base = parseIso(selected);
      const start = new Date(base);
      start.setDate(base.getDate() - base.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const total = 42;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [period, cursor, selected]);

  const headerLabel =
    period === "week"
      ? `${MONTHS[parseIso(selected).getMonth()]} ${parseIso(selected).getFullYear()}`
      : `${MONTHS[cursor.m]} ${cursor.y}`;

  return (
    <>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Anterior" onClick={onPrev} className="p-1">
          <ChevronLeft size={20} color={BLUE} />
        </button>
        <p className="text-[16px] font-semibold">{headerLabel}</p>
        <button type="button" aria-label="Próximo" onClick={onNext} className="p-1">
          <ChevronRight size={20} color={BLUE} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[12px] font-medium text-[#B7BDCB]">
            {w}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 text-center">
        {days.map((d) => {
          const key = iso(d);
          const outside = period === "month" && d.getMonth() !== cursor.m;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="flex h-10 flex-col items-center justify-center"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
                style={{
                  background: isSelected ? BLUE : "transparent",
                  color: isSelected ? "#FFFFFF" : outside ? "#C7CBD6" : key === today ? BLUE : "#111111",
                  fontWeight: isSelected || key === today ? 600 : 400,
                }}
              >
                {d.getDate()}
              </span>
              <span
                className="mt-0.5 h-1 w-1 rounded-full"
                style={{ background: marked.has(key) && !isSelected ? BLUE : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

function YearGrid({
  year,
  itemsByMonth,
  onPrev,
  onNext,
  onPick,
}: {
  year: number;
  itemsByMonth: Map<number, number>;
  onPrev: () => void;
  onNext: () => void;
  onPick: (m: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Ano anterior" onClick={onPrev} className="p-1">
          <ChevronLeft size={20} color={BLUE} />
        </button>
        <p className="text-[16px] font-semibold">{year}</p>
        <button type="button" aria-label="Próximo ano" onClick={onNext} className="p-1">
          <ChevronRight size={20} color={BLUE} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MONTHS.map((m, i) => {
          const count = itemsByMonth.get(i) ?? 0;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(i)}
              className="rounded-[10px] py-2.5 text-[13px]"
              style={{ border: "1px solid #E8EAF0" }}
            >
              <span className="block">{m.slice(0, 3)}</span>
              <span
                className="mt-1 block h-1 w-1 rounded-full"
                style={{ background: count ? BLUE : "transparent", marginInline: "auto" }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

type NewItem = {
  kind: PlanKind;
  title: string;
  info?: string;
  date?: string | null;
  time?: string | null;
  icon?: string | null;
};

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Acompanha o teclado do iOS para reposicionar o modal acima dele.
  const [kbInset, setKbInset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
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
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-black/30"
      style={{
        alignItems: kbInset > 0 ? "flex-start" : "center",
        paddingTop: kbInset > 0 ? "calc(16px + env(safe-area-inset-top))" : undefined,
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[22px] bg-white p-5"
        style={{
          maxHeight:
            kbInset > 0
              ? `calc(100dvh - ${kbInset}px - env(safe-area-inset-top) - 32px)`
              : "78dvh",
          marginBottom: kbInset > 0 ? undefined : "calc(112px + env(safe-area-inset-bottom))",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => {
          const el = e.target as HTMLElement;
          setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 320);
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Composer({
  defaultDate,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  defaultDate: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (v: NewItem) => void;
}) {
  const [kind, setKind] = useState<PlanKind>("event");
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [noDate, setNoDate] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);
  const isGoal = kind.startsWith("goal");

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold">Planejar</p>
        <button type="button" aria-label="Fechar" onClick={onClose}>
          <X size={20} className="text-[#8A90A2]" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as PlanKind[]).map((k) => {
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className="rounded-full px-3 py-1.5 text-[13px]"
              style={{
                background: active ? BLUE : "#F4F6FB",
                color: active ? "#FFFFFF" : "#4B5163",
              }}
            >
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isGoal ? "Qual é a meta?" : "O que você quer registrar?"}
        className="mt-4 w-full rounded-[12px] px-3 py-3 text-[16px] outline-none"
        style={{ background: "#F6F7FB" }}
      />

      {kind !== "event" && (
        <input
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          placeholder="Informação (opcional): valor, observação…"
          className="mt-2 w-full rounded-[12px] px-3 py-3 text-[15px] outline-none"
          style={{ background: "#F6F7FB" }}
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="date"
          value={date}
          disabled={noDate}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-[12px] px-3 py-3 text-[15px] outline-none disabled:opacity-40"
          style={{ background: "#F6F7FB" }}
        />
        {kind === "event" && (
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[110px] rounded-[12px] px-3 py-3 text-[15px] outline-none"
            style={{ background: "#F6F7FB" }}
          />
        )}
      </div>

      {kind !== "event" && (
        <label className="mt-3 flex items-center gap-2 text-[14px] text-[#4B5163]">
          <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
          Sem data por enquanto
        </label>
      )}

      <PlanIconPicker value={icon} title={title} info={info} onChange={setIcon} />

      {error && <p className="mt-3 text-[13px] text-[#C0392B]">{error}</p>}

      <button
        type="button"
        disabled={pending || title.trim().length < 2}
        onClick={() =>
          onSubmit({
            kind,
            title: title.trim(),
            info: info.trim() || undefined,
            date: kind !== "event" && noDate ? null : date,
            time: kind === "event" ? time : null,
            icon,
          })
        }
        className="mt-5 w-full rounded-full py-3.5 text-[15px] font-medium text-white disabled:opacity-40"
        style={{ background: BLUE }}
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </Sheet>
  );
}

function EditSheet({
  item,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  item: PlanningItem;
  pending: boolean;
  onClose: () => void;
  onSave: (v: {
    title: string;
    date?: string | null;
    time?: string | null;
    icon?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date ?? "");
  const [time, setTime] = useState(item.time ?? "");
  const [icon, setIcon] = useState<string | null>(item.icon ?? null);

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold">{KIND_LABEL[item.kind]}</p>
        <button type="button" aria-label="Fechar" onClick={onClose}>
          <X size={20} className="text-[#8A90A2]" />
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-4 w-full rounded-[12px] px-3 py-3 text-[16px] outline-none"
        style={{ background: "#F6F7FB" }}
      />
      <div className="mt-2 flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-[12px] px-3 py-3 text-[15px] outline-none"
          style={{ background: "#F6F7FB" }}
        />
        {item.kind === "event" && (
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[110px] rounded-[12px] px-3 py-3 text-[15px] outline-none"
            style={{ background: "#F6F7FB" }}
          />
        )}
      </div>

      <PlanIconPicker value={icon} title={title} info={item.info} onChange={setIcon} />

      <button
        type="button"
        disabled={pending || title.trim().length < 2}
        onClick={() =>
          onSave({
            title: title.trim(),
            date: date || null,
            time: item.kind === "event" ? time || null : null,
            icon,
          })
        }
        className="mt-5 w-full rounded-full py-3.5 text-[15px] font-medium text-white disabled:opacity-40"
        style={{ background: BLUE }}
      >
        Salvar alterações
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onDelete}
        className="mt-2 w-full rounded-full py-3 text-[15px] text-[#C0392B]"
      >
        Excluir
      </button>
    </Sheet>
  );
}
