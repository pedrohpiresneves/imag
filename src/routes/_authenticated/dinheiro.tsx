import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpCircle,
  Car,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  HeartPulse,
  Home,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import {
  createMoneyRecord,
  deleteMoneyRecord,
  getMoneyOverview,
  setIncomePending,
  setRecurrenceStatus,
  updateMoneyRecord,
  type MoneyRecord,
} from "@/lib/money.functions";
import {
  categoriesFor,
  categoryLabel,
  formatBRL,
  autoCategory,
  looksFixed,
  looksFixedIncome,
  normalizeCategory,
  type MoneyKind,
} from "@/lib/money-categories";



export const Route = createFileRoute("/_authenticated/dinheiro")({
  component: MoneyPage,
  head: () => ({
    meta: [
      { title: "Meu dinheiro · iMAG" },
      {
        name: "description",
        content:
          "Registre recebimentos e gastos, acompanhe o saldo da semana e converse com a MAG sobre o seu dinheiro.",
      },
      { property: "og:title", content: "Meu dinheiro · iMAG" },
      {
        property: "og:description",
        content: "Recebimentos, gastos e saldo em um lugar simples. Menos ruído. Mais direção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";
const HAIR = "#ECECEF";
const GREEN = "#0F9D58";
const AMBER = "#B4791A";
const CARD_HAIR = "#E7E9EF";
const VISIBLE_LIMIT = 5;
const LIST_PREF_KEY = "imag.money.listOpen";


function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function rangeFor(period: "week" | "month"): { from: string; to: string } {
  const now = new Date(`${todayIso()}T12:00:00`);
  const to = todayIso();
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { from: start.toISOString().slice(0, 10), to };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  return { from: start.toISOString().slice(0, 10), to };
}

type RecordFilters = {
  categories: string[];
  frequency: "all" | "fixed" | "variable";
  status: "all" | "confirmed" | "pending";
  period: "all" | "today" | "week" | "month" | "custom";
  from: string;
  to: string;
  min: string;
  max: string;
};

const EMPTY_FILTERS: RecordFilters = {
  categories: [],
  frequency: "all",
  status: "all",
  period: "all",
  from: "",
  to: "",
  min: "",
  max: "",
};

function countActiveFilters(f: RecordFilters): number {
  let n = 0;
  if (f.categories.length > 0) n += 1;
  if (f.frequency !== "all") n += 1;
  if (f.status !== "all") n += 1;
  if (f.period !== "all") n += 1;
  if (f.min.trim() !== "" || f.max.trim() !== "") n += 1;
  return n;
}

function parseReais(raw: string): number | null {
  const v = Number(raw.replace(/\./g, "").replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(v) ? Math.round(v * 100) : null;
}

function periodRange(f: RecordFilters): { from: string; to: string } | null {
  const today = todayIso();
  if (f.period === "today") return { from: today, to: today };
  if (f.period === "week") return rangeFor("week");
  if (f.period === "month") return rangeFor("month");
  if (f.period === "custom") {
    if (!f.from && !f.to) return null;
    return { from: f.from || "0001-01-01", to: f.to || "9999-12-31" };
  }
  return null;
}

function applyFilters(all: MoneyRecord[], tab: MoneyKind, f: RecordFilters): MoneyRecord[] {
  const range = periodRange(f);
  const min = parseReais(f.min);
  const max = parseReais(f.max);
  return all.filter((r) => {
    if (r.kind !== tab) return false;
    if (f.categories.length > 0 && !f.categories.includes(r.category)) return false;
    if (f.frequency === "fixed" && !r.is_recurring) return false;
    if (f.frequency === "variable" && r.is_recurring) return false;
    if (f.status === "confirmed" && r.is_pending) return false;
    if (f.status === "pending" && !r.is_pending) return false;
    if (range && (r.entry_date < range.from || r.entry_date > range.to)) return false;
    if (min !== null && r.amount_cents < min) return false;
    if (max !== null && r.amount_cents > max) return false;
    return true;
  });
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y!.slice(2)}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "25–31 de agosto" ou "28 de agosto – 3 de setembro". */
function formatRange(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [, tm, td] = to.split("-").map(Number) as [number, number, number];
  if (fm === tm) return `${fd}–${td} de ${MONTHS[fm - 1]}`;
  return `${fd} de ${MONTHS[fm - 1]} – ${td} de ${MONTHS[tm - 1]}`;
}

/** Maior gasto do período por categoria, com base nos registros reais. */
function topExpenseOf(records: MoneyRecord[]): { category: string; cents: number } | null {
  const totals = new Map<string, number>();
  for (const r of records) {
    if (r.kind !== "expense") continue;
    const key = normalizeCategory("expense", r.category);
    totals.set(key, (totals.get(key) ?? 0) + r.amount_cents);
  }
  let best: { category: string; cents: number } | null = null;
  for (const [category, cents] of totals) {
    if (!best || cents > best.cents) best = { category, cents };
  }
  return best;
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  alimentacao: Utensils,
  transporte: Car,
  saude: HeartPulse,
  moradia: Home,
  contas: Receipt,
  assinaturas: Repeat,
  compras: ShoppingBag,
  lazer: Sparkles,
  educacao: GraduationCap,
  outros: Wallet,
};

function WeekSummaryCard({
  period,
  rangeLabel,
  income,
  expense,
  balance,
  fixedIncome,
  fixedExpense,
  top,
  onSelectKind,
  onSelectCategory,
}: {
  period: "week" | "month";
  rangeLabel: string;
  income: number;
  expense: number;
  balance: number;
  fixedIncome: number;
  fixedExpense: number;
  top: { category: string; cents: number } | null;
  onSelectKind: (k: MoneyKind) => void;
  onSelectCategory: (c: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = income + expense;
  const incomePct = total > 0 ? Math.round((income / total) * 100) : 50;
  const positive = balance >= 0;
  const TopIcon = top ? (CATEGORY_ICON[top.category] ?? Wallet) : Wallet;
  const free = fixedIncome - fixedExpense;

  return (
    <section
      className="mt-3 overflow-hidden rounded-[16px] bg-white p-4"
      style={{ border: `1px solid ${CARD_HAIR}` }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold" style={{ color: INK, letterSpacing: "-0.01em" }}>
            {period === "week" ? "Resumo da semana" : "Resumo do mês"}
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>
            {rangeLabel}
          </p>
          <p className="mt-2.5 text-[12.5px]" style={{ color: MUTED }}>
            Saldo disponível
          </p>
          <p className="text-[26px] font-bold leading-[1.1]" style={{ color: INK, letterSpacing: "-0.03em" }}>
            {formatBRL(balance)}
          </p>
        </div>
        <ChevronDown
          className="mt-0.5 h-5 w-5 shrink-0 transition-transform duration-300"
          strokeWidth={1.8}
          style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="summary"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p
              className="mt-1 flex items-center gap-1 text-[12.5px]"
              style={{ color: positive ? GREEN : AMBER }}
            >
              {positive ? (
                <ArrowUpCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
              )}
              {positive ? "Entrou mais do que saiu" : "Saiu mais do que entrou"}
            </p>

            <div className="mt-3 flex h-[6px] gap-1 overflow-hidden rounded-full">
              <span style={{ width: `${incomePct}%`, background: GREEN }} />
              <span style={{ width: `${100 - incomePct}%`, background: BLUE }} />
            </div>
            <div className="mt-1.5 flex items-start justify-between gap-3">
              <button type="button" onClick={() => onSelectKind("income")} className="text-left">
                <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: MUTED }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                  Recebi
                </span>
                <span className="block text-[14px] font-medium" style={{ color: INK }}>
                  {formatBRL(income)}
                </span>
              </button>
              <button type="button" onClick={() => onSelectKind("expense")} className="text-right">
                <span
                  className="flex items-center justify-end gap-1.5 text-[12.5px]"
                  style={{ color: MUTED }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />
                  Gastei
                </span>
                <span className="block text-[14px] font-medium" style={{ color: INK }}>
                  {formatBRL(expense)}
                </span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
              {[
                { label: "Receitas fixas", value: fixedIncome },
                { label: "Despesas fixas", value: fixedExpense },
                { label: "Livre após fixas", value: free },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className="px-1 text-center"
                  style={i < 2 ? { borderRight: `1px solid ${HAIR}` } : undefined}
                >
                  <p className="text-[11.5px]" style={{ color: MUTED }}>
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-[13.5px] font-semibold" style={{ color: INK }}>
                    {formatBRL(c.value)}
                  </p>
                </div>
              ))}
            </div>

            {top && (
              <button
                type="button"
                onClick={() => onSelectCategory(top.category)}
                className="mt-3 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left"
                style={{ background: "#F2F5FF" }}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white"
                  style={{ color: BLUE }}
                >
                  <TopIcon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px]" style={{ color: MUTED }}>
                    Maior gasto {period === "week" ? "da semana" : "do mês"}
                  </span>
                  <span className="block truncate text-[13.5px] font-medium" style={{ color: INK }}>
                    {categoryLabel("expense", top.category)} · {formatBRL(top.cents)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} style={{ color: BLUE }} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


function MoneyPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [tab, setTab] = useState<MoneyKind>("expense");
  const [editing, setEditing] = useState<MoneyRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<RecordFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [limitFor, setLimitFor] = useState<string | null>(null);

  const range = useMemo(() => rangeFor(period), [period]);
  const fetchOverview = useServerFn(getMoneyOverview);
  const queryKey = ["money-overview", period, range.from, range.to];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOverview({ data: { ...range, period } }),
  });

  // Preferência do usuário: lista recolhida ou expandida.
  const [listOpen, setListOpenState] = useState(true);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIST_PREF_KEY);
      if (raw !== null) setListOpenState(raw === "1");
    } catch {
      /* preferência é opcional */
    }
  }, []);
  const setListOpen = (v: boolean) => {
    setListOpenState(v);
    try {
      window.localStorage.setItem(LIST_PREF_KEY, v ? "1" : "0");
    } catch {
      /* preferência é opcional */
    }
  };


  // Atualização em tempo real dos próprios registros.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!alive || !u.user) return;
      channel = supabase
        .channel("money-records")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "money_records",
            filter: `user_id=eq.${u.user.id}`,
          },
          () => (qc.invalidateQueries({ queryKey: ["money-overview"] }),
            qc.invalidateQueries({ queryKey: ["money-guidance"] })),
        )
        .subscribe();
    })();
    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const remove = useServerFn(deleteMoneyRecord);
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ["money-overview"] }),
            qc.invalidateQueries({ queryKey: ["money-guidance"] })),
  });

  const confirmIncome = useServerFn(setIncomePending);
  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmIncome({ data: { id, pending: false } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ["money-overview"] }),
            qc.invalidateQueries({ queryKey: ["money-guidance"] })),
  });


  const records = applyFilters(data?.records ?? [], tab, filters);
  const activeFilters = countActiveFilters(filters);
  const visibleRecords = showAll ? records : records.slice(0, VISIBLE_LIMIT);
  useEffect(() => setShowAll(false), [tab, period, filters]);

  const rangeLabel = useMemo(() => formatRange(range.from, range.to), [range.from, range.to]);
  const topExpense = useMemo(() => topExpenseOf(data?.records ?? []), [data?.records]);


  return (
    <div className="min-h-dvh bg-white">
      <AppHeader />
      <main className="mx-auto w-full max-w-[520px] px-5 pb-40 pt-5">
        <div className="flex items-center gap-2">
          <Link to="/atividade" aria-label="Voltar" className="-ml-1 p-1" style={{ color: INK }}>
            <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
          </Link>
          <h1 className="text-[26px] font-semibold" style={{ color: INK, letterSpacing: "-0.02em" }}>
            Meu dinheiro
          </h1>
        </div>

        {/* Filtros */}
        <div
          className="mx-auto mt-4 grid w-[240px] grid-cols-2 rounded-full p-1"
          style={{ background: "#F4F4F6" }}
        >
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="rounded-full py-1.5 text-[13px] font-medium transition"
              style={
                period === p
                  ? { background: "#FFFFFF", color: BLUE, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }
                  : { color: MUTED }
              }
            >
              {p === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        {/* Resumo da semana / do mês */}
        <WeekSummaryCard
          period={period}
          rangeLabel={rangeLabel}
          income={data?.income_cents ?? 0}
          expense={data?.expense_cents ?? 0}
          balance={data?.balance_cents ?? 0}
          fixedIncome={data?.recurring_income_monthly_cents ?? 0}
          fixedExpense={data?.recurring_monthly_cents ?? 0}
          top={topExpense}
          onSelectKind={(k) => {
            setTab(k);
            setListOpen(true);
          }}
          onSelectCategory={(c) => {
            setTab("expense");
            setFilters({ ...EMPTY_FILTERS, categories: [c] });
            setListOpen(true);
            document
              .getElementById("money-records")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

        {(data?.pending_income_cents ?? 0) > 0 && (
          <p className="mt-2 text-center text-[12.5px]" style={{ color: MUTED }}>
            Previsto a receber: {formatBRL(data!.pending_income_cents)} — não somado ao saldo.
          </p>
        )}

        {/* Registrar — ação principal */}
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold text-white transition active:opacity-90"
          style={{ background: BLUE, boxShadow: "0 6px 18px -8px rgba(51,92,255,0.7)" }}
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
          Registrar
        </button>

        {/* Abas */}
        <div className="mt-5 grid grid-cols-2 rounded-[14px]" style={{ border: `1px solid ${HAIR}` }}>
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="py-3 text-[14px] font-medium transition"
              style={
                tab === k
                  ? { color: BLUE, borderBottom: `2px solid ${BLUE}` }
                  : { color: MUTED, borderBottom: "2px solid transparent" }
              }
            >
              {k === "expense" ? "Gastos" : "Recebimentos"}
            </button>
          ))}
        </div>

        {/* Últimos registros — card branco recolhível */}
        <section
          id="money-records"
          className="mt-4 overflow-hidden rounded-[16px] bg-white"
          style={{ border: `1px solid ${CARD_HAIR}` }}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setListOpen(!listOpen)}
              aria-expanded={listOpen}
              className="min-w-0 flex-1 text-left"
            >
              <h2 className="text-[16px] font-semibold" style={{ color: INK, letterSpacing: "-0.01em" }}>
                Últimos registros
              </h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>
                {records.length} {records.length === 1 ? "movimentação" : "movimentações"}{" "}
                {period === "week" ? "nesta semana" : "neste mês"}
              </p>
            </button>
            <button
              type="button"
              aria-label="Filtrar registros"
              onClick={() => setFilterOpen(true)}
              className="relative p-1.5"
              style={{ color: activeFilters > 0 ? BLUE : MUTED }}
            >
              <SlidersHorizontal className="h-5 w-5" strokeWidth={1.8} />
              {activeFilters > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                  style={{ background: BLUE }}
                >
                  {activeFilters}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={listOpen ? "Recolher registros" : "Expandir registros"}
              aria-expanded={listOpen}
              onClick={() => setListOpen(!listOpen)}
              className="p-1.5"
              style={{ color: MUTED }}
            >
              <ChevronDown
                className="h-5 w-5 transition-transform duration-300"
                strokeWidth={1.8}
                style={{ transform: listOpen ? "rotate(180deg)" : "none" }}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {listOpen && (
              <motion.div
                key="records"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {activeFilters > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filters.categories.map((c) => (
                      <FilterChip
                        key={c}
                        label={categoryLabel(tab, c)}
                        onRemove={() =>
                          setFilters({
                            ...filters,
                            categories: filters.categories.filter((x) => x !== c),
                          })
                        }
                      />
                    ))}
                    {filters.frequency !== "all" && (
                      <FilterChip
                        label={filters.frequency === "fixed" ? "Fixos" : "Variáveis"}
                        onRemove={() => setFilters({ ...filters, frequency: "all" })}
                      />
                    )}
                    {filters.status !== "all" && (
                      <FilterChip
                        label={filters.status === "confirmed" ? "Confirmados" : "Previstos"}
                        onRemove={() => setFilters({ ...filters, status: "all" })}
                      />
                    )}
                    {filters.period !== "all" && (
                      <FilterChip
                        label={
                          filters.period === "today"
                            ? "Hoje"
                            : filters.period === "week"
                              ? "Esta semana"
                              : filters.period === "month"
                                ? "Este mês"
                                : "Período personalizado"
                        }
                        onRemove={() => setFilters({ ...filters, period: "all", from: "", to: "" })}
                      />
                    )}
                    {(filters.min.trim() !== "" || filters.max.trim() !== "") && (
                      <FilterChip
                        label="Faixa de valor"
                        onRemove={() => setFilters({ ...filters, min: "", max: "" })}
                      />
                    )}
                  </div>
                )}

                <ul>
                  {isLoading && (
                    <li className="px-4 py-6 text-center text-[13px]" style={{ color: MUTED }}>
                      Carregando…
                    </li>
                  )}
                  {!isLoading && records.length === 0 && (
                    <li className="px-4 py-6 text-center text-[13px]" style={{ color: MUTED }}>
                      Nenhum registro {tab === "expense" ? "de gasto" : "de recebimento"} neste
                      período.
                    </li>
                  )}
                  {visibleRecords.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: `1px solid ${HAIR}` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="flex items-center gap-1.5 truncate text-[15px]"
                          style={{ color: INK }}
                        >
                          {categoryLabel(r.kind, r.category)}
                          {r.is_recurring && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-[1px] text-[10.5px] font-medium"
                              style={{ background: "#F2F5FF", color: BLUE }}
                            >
                              Fixa
                            </span>
                          )}
                          {r.is_pending && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-[1px] text-[10.5px] font-medium"
                              style={{ background: "#F4F4F6", color: MUTED }}
                            >
                              Previsto
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px]" style={{ color: MUTED }}>
                          {formatDay(r.entry_date)}
                          {r.description ? ` · ${r.description}` : ""}
                        </p>
                        {r.is_pending && (
                          <button
                            type="button"
                            onClick={() => confirmMut.mutate(r.id)}
                            className="mt-0.5 text-[12.5px] font-medium"
                            style={{ color: BLUE }}
                          >
                            Confirmar recebimento
                          </button>
                        )}
                      </div>
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: r.is_pending ? MUTED : r.kind === "income" ? GREEN : INK }}
                      >
                        {r.kind === "income" ? "" : "−"}
                        {formatBRL(r.amount_cents)}
                      </span>

                      <button
                        type="button"
                        aria-label="Editar"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                        style={{ color: MUTED }}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        aria-label="Excluir"
                        onClick={() => removeMut.mutate(r.id)}
                        style={{ color: MUTED }}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </li>
                  ))}
                </ul>

                {records.length > VISIBLE_LIMIT && !showAll && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 text-[13.5px] font-medium"
                    style={{ borderTop: `1px solid ${HAIR}`, color: BLUE }}
                  >
                    Ver todos os registros
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </main>

      {limitFor && (
        <LimitSheet category={limitFor} onClose={() => setLimitFor(null)} />
      )}

      {filterOpen && (
        <FilterSheet
          tab={tab}
          initial={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
        />
      )}

      {open && (
        <RecordSheet
          record={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            (qc.invalidateQueries({ queryKey: ["money-overview"] }),
            qc.invalidateQueries({ queryKey: ["money-guidance"] }));
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}

function RecordSheet({
  record,
  onClose,
  onSaved,
}: {
  record: MoneyRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<MoneyKind>(record?.kind ?? "expense");
  const [amount, setAmount] = useState(
    record ? (record.amount_cents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [category, setCategory] = useState(record?.category ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [date, setDate] = useState(record?.entry_date ?? todayIso());
  const [recurring, setRecurring] = useState(record?.is_recurring ?? false);
  const [dueDay, setDueDay] = useState(
    String(record?.due_day ?? Number((record?.entry_date ?? todayIso()).slice(8, 10))),
  );
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestFixed =
    !recurring &&
    !suggestDismissed &&
    (kind === "expense"
      ? looksFixed(category, description)
      : looksFixedIncome(category, description));


  const changeStatus = useServerFn(setRecurrenceStatus);
  const statusMut = useMutation({
    mutationFn: (status: "active" | "paused" | "cancelled") =>
      changeStatus({ data: { id: record!.id, status } }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  const create = useServerFn(createMoneyRecord);
  const update = useServerFn(updateMoneyRecord);

  const save = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Informe um valor válido.");
      if (!category) throw new Error("Escolha uma categoria.");
      const payload = {
        kind,
        amount_cents: cents,
        category,
        description: description.trim() || null,
        entry_date: date,
        is_recurring: recurring,
        due_day: recurring ? Math.min(Math.max(Number(dueDay) || 1, 1), 31) : null,

      };
      return record
        ? update({ data: { ...payload, id: record.id } })
        : create({ data: payload });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-5">
      <div className="w-full max-w-[480px] rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold" style={{ color: INK }}>
            {record ? "Editar registro" : "Você recebeu ou gastou?"}
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ color: MUTED }}>
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setCategory("");
              }}
              className="rounded-[14px] py-3 text-[14px] font-medium transition"
              style={
                kind === k
                  ? { background: BLUE, color: "#FFFFFF" }
                  : { border: `1px solid ${HAIR}`, color: INK }
              }
            >
              {k === "income" ? "Recebi" : "Gastei"}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-[13px]" style={{ color: MUTED }}>
          Quanto foi?
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-[14px] px-3 py-3 text-[18px] font-semibold outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
        </label>

        <p className="mt-4 text-[13px]" style={{ color: MUTED }}>
          Qual a categoria?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {categoriesFor(kind).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className="rounded-full px-3 py-1.5 text-[13px] transition"
              style={
                category === c.key
                  ? { background: BLUE, color: "#FFFFFF" }
                  : { border: `1px solid ${HAIR}`, color: INK }
              }
            >
              {c.key === "saude" && (
                <HeartPulse className="mr-1 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.8} />
              )}
              {c.label}
            </button>
          ))}
        </div>

        {(() => {
          const fixedLabel = kind === "expense" ? "Despesa fixa" : "Receita fixa";
          const dayLabel = kind === "expense" ? "Dia do vencimento" : "Dia previsto para receber";
          return (
            <div className="mt-3 rounded-[14px] px-3 py-2.5" style={{ border: `1px solid ${HAIR}` }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px]" style={{ color: INK }}>
                    {fixedLabel}
                  </p>
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    Repete todo mês
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recurring}
                  aria-label={fixedLabel}
                  onClick={() => {
                    setRecurring((v) => !v);
                    setSuggestDismissed(true);
                  }}
                  className="relative h-[26px] w-[46px] shrink-0 rounded-full transition"
                  style={{ background: recurring ? BLUE : "#E4E4E9" }}
                >
                  <span
                    className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all"
                    style={{ left: recurring ? 23 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
                  />
                </button>
              </div>

              {suggestFixed && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[12.5px]" style={{ color: MUTED }}>
                    Parece {kind === "expense" ? "uma despesa fixa" : "uma receita fixa"}. Ativar?
                  </p>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => setRecurring(true)}
                      className="text-[12.5px] font-medium"
                      style={{ color: BLUE }}
                    >
                      Ativar
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestDismissed(true)}
                      className="text-[12.5px]"
                      style={{ color: MUTED }}
                    >
                      Agora não
                    </button>
                  </div>
                </div>
              )}

              {recurring && (
                <label
                  className="mt-2 flex items-center justify-between gap-3 text-[13px]"
                  style={{ color: MUTED }}
                >
                  {dayLabel}
                  <input
                    inputMode="numeric"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="w-[64px] rounded-[12px] px-2 py-1.5 text-center text-[15px] outline-none"
                    style={{ border: `1px solid ${HAIR}`, color: INK }}
                  />
                </label>
              )}

              {record?.is_recurring && (
                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      statusMut.mutate(record.recurrence_status === "paused" ? "active" : "paused")
                    }
                    className="text-[12.5px] font-medium"
                    style={{ color: BLUE }}
                  >
                    {record.recurrence_status === "paused" ? "Retomar" : "Pausar"} recorrência
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMut.mutate("cancelled")}
                    className="text-[12.5px]"
                    style={{ color: MUTED }}
                  >
                    Cancelar recorrência
                  </button>
                </div>
              )}
            </div>
          );
        })()}


        <label className="mt-4 block text-[13px]" style={{ color: MUTED }}>
          Descrição (opcional)
          <input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (kind === "expense" && (!category || category === "outros")) {
                const auto = autoCategory("expense", category || "outros", e.target.value);
                if (auto !== category) setCategory(auto);
              }
            }}
            placeholder="Ex.: consulta da tarde"
            className="mt-1 w-full rounded-[14px] px-3 py-2.5 text-[15px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
        </label>

        <label className="mt-3 block text-[13px]" style={{ color: MUTED }}>
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-[14px] px-3 py-2.5 text-[15px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
        </label>

        {error && (
          <p className="mt-3 text-[13px]" style={{ color: "#C0392B" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          className="mt-5 w-full rounded-[16px] py-4 text-[16px] font-medium text-white transition active:opacity-90 disabled:opacity-60"
          style={{ background: BLUE }}
        >
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    </div>
  );
}

const LIMITS_KEY = "imag.money.limits";

function readLimits(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LIMITS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Chip removível de filtro ativo. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
      style={{ background: "#F2F5FF", color: BLUE }}
    >
      {label}
      <X className="h-3 w-3" strokeWidth={2} />
    </button>
  );
}

/** Painel inferior "Filtrar registros". */
function FilterSheet({
  tab,
  initial,
  onClose,
  onApply,
}: {
  tab: MoneyKind;
  initial: RecordFilters;
  onClose: () => void;
  onApply: (f: RecordFilters) => void;
}) {
  const [f, setF] = useState<RecordFilters>(initial);
  const cats = categoriesFor(tab);

  const toggleCategory = (key: string) =>
    setF({
      ...f,
      categories: f.categories.includes(key)
        ? f.categories.filter((c) => c !== key)
        : [...f.categories, key],
    });

  const pill = (active: boolean) =>
    active
      ? { background: "#F2F5FF", color: BLUE, border: `1px solid ${BLUE}` }
      : { background: "#FFFFFF", color: MUTED, border: `1px solid ${HAIR}` };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
      <div className="max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold" style={{ color: INK }}>
            Filtrar registros
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ color: MUTED }}>
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <p className="mt-4 text-[13px] font-medium" style={{ color: INK }}>
          Categoria
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              className="rounded-full px-3 py-1.5 text-[13px]"
              style={pill(f.categories.includes(c.key))}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-medium" style={{ color: INK }}>
          Frequência
        </p>
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["fixed", "Fixos"],
              ["variable", "Variáveis"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setF({ ...f, frequency: k })}
              className="rounded-full px-3 py-1.5 text-[13px]"
              style={pill(f.frequency === k)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-medium" style={{ color: INK }}>
          Status
        </p>
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["confirmed", "Confirmados"],
              ["pending", "Previstos"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setF({ ...f, status: k })}
              className="rounded-full px-3 py-1.5 text-[13px]"
              style={pill(f.status === k)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-medium" style={{ color: INK }}>
          Período
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              ["today", "Hoje"],
              ["week", "Esta semana"],
              ["month", "Este mês"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setF({ ...f, period: f.period === k ? "all" : k })}
              className="rounded-full px-3 py-1.5 text-[13px]"
              style={pill(f.period === k)}
            >
              {label}
            </button>
          ))}
        </div>
        {f.period === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={f.from}
              onChange={(e) => setF({ ...f, from: e.target.value })}
              className="rounded-[12px] px-3 py-2 text-[14px] outline-none"
              style={{ border: `1px solid ${HAIR}`, color: INK }}
            />
            <input
              type="date"
              value={f.to}
              onChange={(e) => setF({ ...f, to: e.target.value })}
              className="rounded-[12px] px-3 py-2 text-[14px] outline-none"
              style={{ border: `1px solid ${HAIR}`, color: INK }}
            />
          </div>
        )}

        <p className="mt-4 text-[13px] font-medium" style={{ color: INK }}>
          Valor
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            inputMode="decimal"
            value={f.min}
            onChange={(e) => setF({ ...f, min: e.target.value })}
            placeholder="Mínimo"
            className="rounded-[12px] px-3 py-2 text-[14px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
          <input
            inputMode="decimal"
            value={f.max}
            onChange={(e) => setF({ ...f, max: e.target.value })}
            placeholder="Máximo"
            className="rounded-[12px] px-3 py-2 text-[14px] outline-none"
            style={{ border: `1px solid ${HAIR}`, color: INK }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setF(EMPTY_FILTERS)}
            className="text-[14px] font-medium"
            style={{ color: MUTED }}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => onApply(f)}
            className="flex-1 rounded-[16px] py-3.5 text-[15px] font-medium text-white transition active:opacity-90"
            style={{ background: BLUE }}
          >
            Aplicar filtros
          </button>
        </div>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    </div>
  );
}

/** Criação de limite semanal para uma categoria específica. */
function LimitSheet({ category, onClose }: { category: string; onClose: () => void }) {
  const current = readLimits()[category];
  const [value, setValue] = useState(
    current ? (current / 100).toFixed(2).replace(".", ",") : "",
  );
  const [saved, setSaved] = useState(false);

  const save = () => {
    const cents = Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    try {
      window.localStorage.setItem(
        LIMITS_KEY,
        JSON.stringify({ ...readLimits(), [category]: cents }),
      );
    } catch {
      /* silencioso */
    }
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:px-5">
      <div className="w-full max-w-[480px] rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold" style={{ color: INK }}>
            Limite semanal · {categoryLabel("expense", category)}
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ color: MUTED }}>
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
        <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
          Quanto você quer gastar, no máximo, por semana nesta categoria?
        </p>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0,00"
          className="mt-3 w-full rounded-[14px] px-3 py-3 text-[18px] font-semibold outline-none"
          style={{ border: `1px solid ${HAIR}`, color: INK }}
        />
        <button
          type="button"
          onClick={save}
          className="mt-4 w-full rounded-[16px] py-4 text-[16px] font-medium text-white transition active:opacity-90"
          style={{ background: BLUE }}
        >
          {saved ? "Limite salvo ✓" : "Salvar limite"}
        </button>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    </div>
  );
}
