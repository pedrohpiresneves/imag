import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/ShareDirectionModal";
import { useAccess } from "@/lib/use-access";
import { listGoalHistory, type GoalHistoryItem } from "@/lib/goal-history.functions";
import { getHistoryOverview } from "@/lib/history-overview.functions";
import {
  addSharedToMyDay,
  listReceivedDirections,
  respondToDirection,
  type ReceivedDirection,
} from "@/lib/shared-directions.functions";
import { listSavedDirections, removeSavedDirection } from "@/lib/saved-directions.functions";

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const BLUE_SOFT = "#4B6BC4";
const BLUE_TINT = "#EFF3FC";
const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · iMAG" },
      {
        name: "description",
        content:
          "Sua memória estratégica: direções concluídas, não concluídas, recebidas e salvas em um só lugar.",
      },
      { property: "og:title", content: "Histórico · iMAG" },
      { property: "og:description", content: "Linha do tempo das suas direções na iMAG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    f: typeof search["f"] === "string" ? (search["f"] as string) : undefined,
  }),
  component: HistoricoPage,
});

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "completed", label: "Concluídas" },
  { id: "active", label: "Em andamento" },
  { id: "missed", label: "Não concluídas" },
  { id: "received", label: "Recebidas" },
  { id: "saved", label: "Salvas" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function isFilterId(v: string | undefined): v is FilterId {
  return !!v && FILTERS.some((f) => f.id === v);
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const PERIODS = [7, 15, 30] as const;
type PeriodDays = (typeof PERIODS)[number];

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shortRange(startISO: string, endISO: string) {
  const [, sm, sd] = startISO.split("-").map(Number);
  const [, em, ed] = endISO.split("-").map(Number);
  if (!sm || !sd || !em || !ed) return "";
  const left = sm === em ? `${String(sd).padStart(2, "0")}` : `${String(sd).padStart(2, "0")} de ${SHORT_MONTHS[sm - 1]}`;
  return `${left} a ${String(ed).padStart(2, "0")} de ${SHORT_MONTHS[em - 1]}`;
}

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const label = `${d} de ${MONTHS[m - 1]}`;
  return iso === todayISO() ? `Hoje, ${label}` : label;
}

const STATUS_META: Record<
  GoalHistoryItem["status"],
  { label: string; color: string; dot: string }
> = {
  completed: { label: "Concluída", color: BLUE, dot: BLUE },
  missed: { label: "Não realizada", color: BLUE_SOFT, dot: "#A9BCE6" },
  expired: { label: "Expirada", color: "#8FA3CC", dot: "#CBD7EE" },
  active: { label: "Em andamento", color: BLUE_SOFT, dot: BLUE_SOFT },
};

/** Só mostramos origem quando ela realmente muda a leitura da direção. */
function originLabel(item: GoalHistoryItem): string | null {
  if (item.origin_kind === "shared") return "Recebida";
  if (item.origin_kind === "impact") return "Salva";
  return null;
}

function HistoricoPage() {
  const { userId } = useAccess();
  const { f } = Route.useSearch();
  const [filter, setFilter] = useState<FilterId>(isFilterId(f) ? f : "all");
  const [days, setDays] = useState<PeriodDays>(7);
  const listFn = useServerFn(listGoalHistory);
  const overviewFn = useServerFn(getHistoryOverview);
  const isPlansFilter =
    filter === "all" || filter === "completed" || filter === "missed" || filter === "active";

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ["goal-history", userId, filter, days],
    queryFn: () =>
      listFn({
        data: {
          filter:
            filter === "missed" ? "missed" : filter === "active" ? "all" : (filter as "all" | "completed"),
          days,
        },
      }),
    enabled: !!userId && isPlansFilter,
  });

  const items =
    filter === "active" ? rawItems.filter((i) => i.status === "active") : rawItems;

  const { data: overview } = useQuery({
    queryKey: ["history-overview", userId, days],
    queryFn: () => overviewFn({ data: { days } }),
    enabled: !!userId,
  });

  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
    >
      <div className="surface-light">
        <AppHeader />
      </div>

      <main className="mx-auto w-full max-w-xl px-5 pb-40 pt-9 sm:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="text-[30px] font-semibold sm:text-[36px]"
          style={DISPLAY}
        >
          Histórico
        </motion.h1>
        <p className="mt-1.5 text-[14px]" style={{ color: MUTED }}>
          Acompanhe seu progresso e resultados.
        </p>

        {/* Período */}
        <div
          className="mt-6 grid grid-cols-3 gap-1 rounded-full p-1"
          style={{ background: "#F5F6F8" }}
        >
          {PERIODS.map((d) => {
            const active = days === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className="rounded-full py-2 text-[13.5px] font-medium transition"
                style={{
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? BLUE : MUTED,
                  boxShadow: active ? "0 1px 3px rgba(10,10,10,0.08)" : "none",
                }}
              >
                {d} dias
              </button>
            );
          })}
        </div>

        {overview && (
          <>
            <p
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: MUTED }}
            >
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.7} />
              Período: {shortRange(overview.start, overview.end)}
            </p>

            <h2 className="mt-6 text-[16px] font-semibold" style={{ color: INK }}>
              Visão geral
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <MetricCard icon={Inbox} value={overview.received} label="Minhas direções" />
              <MetricCard icon={CheckCircle2} value={overview.executed} label="Executadas" />
              <MetricCard
                icon={Target}
                value={`${overview.executionPct}%`}
                label="Taxa de execução"
              />
              <MetricCard icon={Sparkles} value={overview.impacts} label="Impactos gerados" />
              <MetricCard
                icon={CalendarDays}
                value={overview.activeDays}
                label="Dias em movimento"
              />
              <MetricCard
                icon={TrendingUp}
                value={
                  overview.fieldDelta == null
                    ? "—"
                    : `${overview.fieldDelta >= 0 ? "+" : ""}${overview.fieldDelta}%`
                }
                label="Evolução do Campo"
              />
            </div>
            <p className="mt-3 text-[12px]" style={{ color: MUTED }}>
              Dados referentes aos últimos {days} dias.
            </p>
          </>
        )}

        <h2 className="mt-9 text-[16px] font-semibold" style={{ color: INK }}>
          Suas direções
        </h2>
        <p className="mt-1 text-[12.5px]" style={{ color: MUTED }}>
          Sua linha do tempo de direções na iMAG.
        </p>

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition"
                style={{
                  borderColor: active ? BLUE : HAIRLINE,
                  background: active ? BLUE : "#FFFFFF",
                  color: active ? "#FFFFFF" : MUTED,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {filter === "received" ? (
          <ReceivedSection />
        ) : filter === "saved" ? (
          <SavedSection />
        ) : isLoading ? (
          <p className="mt-10 text-[13.5px]" style={{ color: MUTED }}>
            Carregando…
          </p>
        ) : items.length === 0 ? (
          <p
            className="mt-8 rounded-[20px] border px-4 py-8 text-center text-[13.5px]"
            style={{ borderColor: HAIRLINE, color: MUTED }}
          >
            Nenhuma direção neste filtro ainda.
          </p>
        ) : (
          <div className="relative mt-7 pl-5">
            <div
              className="absolute left-[3px] top-2 bottom-2 w-px"
              style={{ background: "#EDEFF5" }}
            />
            <div className="flex flex-col">
              {items.map((item, i) => {
                const meta = STATUS_META[item.status];
                const origin = originLabel(item);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.24), ease: easeOut }}
                    className="relative"
                  >
                    <span
                      className="absolute -left-5 top-[22px] h-[7px] w-[7px] rounded-full"
                      style={{ background: meta.dot }}
                    />
                    <Link
                      to="/meta/$id"
                      params={{ id: item.id }}
                      className="block rounded-[14px] px-2 py-4 transition"
                      style={{
                        borderBottom: i === items.length - 1 ? "none" : `1px solid ${HAIRLINE}`,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_TINT)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <p className="text-[11.5px]" style={{ color: MUTED }}>
                        {formatDate(item.date)}
                      </p>
                      <p
                        className="mt-1.5 text-[14.5px] leading-[1.45]"
                        style={{
                          color: INK,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.description ?? item.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11.5px]">
                        <span className="font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        {origin && (
                          <>
                            <span style={{ color: "#D6DBE6" }}>·</span>
                            <span style={{ color: MUTED }}>{origin}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {isPlansFilter && (
          <p className="mt-6 text-[12.5px] leading-[1.5]" style={{ color: MUTED }}>
            Direções anteriores a 30 dias não são exibidas individualmente. Os dados continuam
            contabilizados nas suas métricas.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

/* ---------------------------------- Recebidas --------------------------------- */

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: HAIRLINE }}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} style={{ color: BLUE }} />
      <p className="mt-3 text-[22px] font-semibold leading-none" style={{ ...DISPLAY, color: INK }}>
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-[1.35]" style={{ color: MUTED }}>
        {label}
      </p>
    </div>
  );
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function senderName(d: ReceivedDirection) {
  const n = d.person?.full_name ?? d.person?.handle ?? "Alguém";
  return n.split(" ")[0];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function remaining(d: ReceivedDirection) {
  if (d.hours_left <= 0) return "Expirada";
  if (d.hours_left <= 24) return "Expira hoje";
  const days = Math.ceil(d.hours_left / 24);
  return `Disponível por mais ${days} ${days === 1 ? "dia" : "dias"}`;
}

function ReceivedSection() {
  const { userId } = useAccess();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "expired">("active");
  const listFn = useServerFn(listReceivedDirections);
  const addFn = useServerFn(addSharedToMyDay);
  const respondFn = useServerFn(respondToDirection);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["received-directions", userId, tab],
    queryFn: () => listFn({ data: { tab } }),
    enabled: !!userId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["received-directions"] });
    qc.invalidateQueries({ queryKey: ["received-count"] });
    qc.invalidateQueries({ queryKey: ["today-meta"] });
    qc.invalidateQueries({ queryKey: ["pending-directions"] });
  };

  const add = useMutation({
    mutationFn: (id: string) => addFn({ data: { id, local_date: localDate() } }),
    onSuccess: invalidate,
  });
  const respond = useMutation({
    mutationFn: (vars: { id: string; action: "later" | "reconsider" }) => respondFn({ data: vars }),
    onSuccess: invalidate,
  });

  return (
    <>
      <div className="mt-5 flex gap-2">
        {(["active", "expired"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="rounded-full px-3 py-1 text-[12.5px] font-medium transition"
              style={{
                background: active ? "#F2F5FC" : "transparent",
                color: active ? BLUE : MUTED,
              }}
            >
              {t === "active" ? "Ativas" : "Expiradas"}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
          Carregando…
        </p>
      ) : items.length === 0 ? (
        <p
          className="mt-8 rounded-[20px] border px-4 py-8 text-center text-[13.5px]"
          style={{ borderColor: HAIRLINE, color: MUTED }}
        >
          {tab === "active"
            ? "Nenhuma direção recebida no momento."
            : "Nenhuma direção expirada por aqui."}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {items.map((d) => (
            <motion.article
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOut }}
              className="rounded-[20px] border p-5"
              style={{ borderColor: HAIRLINE }}
            >
              <div className="flex items-center gap-2.5">
                {d.person && <Avatar person={d.person} size={28} />}
                <p className="text-[12.5px]" style={{ color: MUTED }}>
                  Enviada por <span style={{ color: INK, fontWeight: 500 }}>{senderName(d)}</span> ·{" "}
                  {timeAgo(d.created_at)}
                </p>
              </div>

              <p className="mt-3 text-[15.5px] leading-[1.5]" style={{ color: INK }}>
                {d.description}
              </p>

              {d.message && (
                <p className="mt-2 text-[13px] italic" style={{ color: MUTED }}>
                  “{d.message}”
                </p>
              )}

              <p
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px]"
                style={{ color: tab === "expired" ? MUTED : BLUE }}
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.7} />
                {tab === "expired" ? "Expirada" : remaining(d)}
              </p>

              {d.later && !d.added && (
                <p className="mt-1 text-[12.5px] font-medium" style={{ color: MUTED }}>
                  Para depois
                </p>
              )}

              {tab === "active" && (
                <div className="mt-4 flex flex-col gap-2">
                  {d.added ? (
                    <p
                      className="inline-flex items-center gap-1.5 text-[13.5px] font-medium"
                      style={{ color: BLUE }}
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Adicionada
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={add.isPending}
                        onClick={() => add.mutate(d.id)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                        style={{ background: BLUE }}
                      >
                        Adicionar ao meu dia
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          respond.mutate({ id: d.id, action: d.later ? "reconsider" : "later" })
                        }
                        className="w-full rounded-full px-5 py-3 text-[13.5px] font-medium transition hover:bg-black/[0.03]"
                        style={{ color: MUTED }}
                      >
                        {d.later ? "Reconsiderar" : "Agora não"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}

      <p
        className="mt-8 rounded-[16px] px-4 py-3.5 text-[12.5px] leading-[1.5]"
        style={{ background: "#FAFAF8", color: MUTED }}
      >
        As metas recebidas ficam disponíveis por 3 dias. Depois desse prazo, elas são movidas para
        Expiradas.
      </p>
    </>
  );
}

/* ----------------------------------- Salvas ----------------------------------- */

function SavedSection() {
  const fetchSaved = useServerFn(listSavedDirections);
  const removeFn = useServerFn(removeSavedDirection);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["saved-directions"],
    queryFn: () => fetchSaved(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-directions"] }),
  });

  return (
    <>
      <p className="mt-5 text-[13.5px] leading-[1.55]" style={{ color: MUTED }}>
        Elas não viram MAG Meta. São um sinal de interesse: a MAG considera essas direções e entrega
        uma delas quando fizer sentido com o seu momento.
      </p>

      {isLoading ? (
        <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
          Carregando…
        </p>
      ) : data.length === 0 ? (
        <p
          className="mt-8 rounded-[20px] border px-4 py-8 text-center text-[13.5px]"
          style={{ borderColor: HAIRLINE, color: MUTED }}
        >
          Nenhuma direção salva ainda. Toque em “Salvar direção” no Impacto.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.map((d) => (
            <li key={d.id} className="rounded-[20px] border p-5" style={{ borderColor: HAIRLINE }}>
              <div className="flex items-start justify-between gap-4">
                <Bookmark
                  className="mt-[3px] h-[15px] w-[15px] shrink-0"
                  strokeWidth={1.8}
                  style={{ color: MUTED }}
                />
                <p className="flex-1 text-[15.5px] leading-[1.5]" style={{ color: INK }}>
                  {d.direction_text}
                </p>
                <button
                  type="button"
                  aria-label="Remover direção salva"
                  onClick={() => remove.mutate(d.id)}
                  className="shrink-0 rounded-full p-1.5 transition hover:bg-black/[0.04]"
                >
                  <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.7} style={{ color: MUTED }} />
                </button>
              </div>
              {d.why_text ? (
                <p className="mt-3 text-[13.5px] leading-[1.55]" style={{ color: MUTED }}>
                  {d.why_text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
