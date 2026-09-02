import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Check,
  SlidersHorizontal,
  ChevronDown,
  TrendingUp,
  User,
  Eye,
  Bookmark,
  Target,
  MoreHorizontal,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import {
  getImpactOverview,
  unpublishDirectionImpact,
  getPendingImpact,
  publishImpactById,
  toggleImpactReaction,
  type ImpactOverview,
  type ImpactStory,
} from "@/lib/impact.functions";
import { saveDirection, listSavedDirections } from "@/lib/saved-directions.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/impacto")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    novo: typeof search['novo'] === "string" ? (search['novo'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Impacto · iMAG" },
      {
        name: "description",
        content: "Painel vivo de inteligência: quais direções realmente estão funcionando agora.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ImpactoPage,
});

const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

const BG = "#FFFFFF";
const INK = "#111111";
const MUTED = "#7B7F89";
const HAIRLINE = "#EFEFF2";
const BLUE = "#335CFF";
const BLUE_SOFT = "#F2F5FF";

const nf = new Intl.NumberFormat("pt-BR");

function timeAgo(hours: number) {
  if (hours < 1) return `há ${Math.max(2, Math.round(hours * 60))} min`;
  if (hours < 24) return `há ${Math.round(hours)} h`;
  return `há ${Math.round(hours / 24)} d`;
}

const hoursOf = (s: ImpactStory) => s.hoursAgo ?? 9999;

/** Padroniza direções em sentence case (evita textos em CAIXA ALTA). */
function sentenceCase(raw: string) {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const letters = text.replace(/[^\p{L}]/gu, "");
  const uppers = text.replace(/[^\p{Lu}]/gu, "").length;
  const mostlyUpper = letters.length > 0 && uppers / letters.length > 0.7;
  const base = mostlyUpper
    ? text
        .toLocaleLowerCase("pt-BR")
        .replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase("pt-BR"))
    : text;
  return base.charAt(0).toLocaleUpperCase("pt-BR") + base.slice(1);
}

/** Privacidade: só o autor vê o próprio nome, sempre abreviado. */
function shortName(raw: string) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0] as string;
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function Post({
  s,
  index,
  trending,
  highlighted,
  savedIds,
}: {
  s: ImpactStory;
  index: number;
  trending: boolean;
  highlighted?: boolean;
  savedIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reacted, setReacted] = useState(Boolean(s.reacted));
  const [delta, setDelta] = useState(0);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = Math.max(0, serverCount ?? s.validations + delta);
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveDirection);
  const unpublishFn = useServerFn(unpublishDirectionImpact);
  const reactFn = useServerFn(toggleImpactReaction);

  useEffect(() => {
    setReacted(Boolean(s.reacted));
    setDelta(0);
    setServerCount(null);
  }, [s.reacted, s.id]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const react = useMutation({
    mutationFn: (on: boolean) => reactFn({ data: { impact_id: s.id, on } }),
    onSuccess: (res: { reacted: boolean; count: number }) => {
      // Estado autoritativo vindo do banco (sem contador local).
      setReacted(Boolean(res.reacted));
      setServerCount(Number(res.count));
      setDelta(0);
      queryClient.invalidateQueries({ queryKey: ["impact-overview"] });
    },
    onError: () => {
      // Desfaz o otimismo se a gravação falhar.
      setReacted(Boolean(s.reacted));
      setDelta(0);
      setServerCount(null);
    },
  });

  function toggleReaction() {
    if (react.isPending) return;
    const next = !reacted;
    setReacted(next);
    setServerCount((c) => (c === null ? null : Math.max(0, c + (next ? 1 : -1))));
    setDelta((d) => d + (next ? 1 : -1));
    if (next) {
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 1000);
    }
    react.mutate(next);
  }

  const mineName = s.isMine && s.authorName ? shortName(s.authorName) : null;
  const saved = savedIds.has(s.id) || justSaved;

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          source_id: s.id,
          direction_text: sentenceCase(s.direction ?? s.story).slice(0, 600),
          why_text: s.howApplied ? sentenceCase(s.howApplied).slice(0, 600) : null,
        },
      }),
    onSuccess: () => {
      setJustSaved(true);
      queryClient.invalidateQueries({ queryKey: ["saved-directions"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => unpublishFn({ data: { id: s.id } }),
    onSuccess: () => {
      setConfirmOpen(false);
      setMenuOpen(false);
      queryClient.setQueryData(["impact-overview"], (prev: ImpactOverview | undefined) =>
        prev ? { ...prev, stories: prev.stories.filter((it) => it.id !== s.id) } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["impact-overview"] });
    },
  });

  return (
    <motion.li
      layout
      id={`impact-${s.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.4, ease: easeOut, delay: Math.min(index, 6) * 0.04 }}
      className={`pb-7 pt-8 first:pt-2 ${highlighted ? "rounded-[20px] px-4" : ""}`}
      style={{
        borderTop: index === 0 || highlighted ? "none" : `1px solid ${HAIRLINE}`,
        background: highlighted ? BLUE_SOFT : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 text-[13.5px]" style={{ color: MUTED }}>
          <span
            aria-hidden
            className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
            style={{ background: BLUE_SOFT }}
          >
            <User className="h-[15px] w-[15px]" strokeWidth={1.7} style={{ color: MUTED }} />
          </span>
          <span>
            <span className="font-semibold" style={{ color: INK }}>
              {mineName ?? s.profession}
            </span>
            {" · "}
            {timeAgo(s.hoursAgo ?? 0)}
            {mineName ? <span className="block text-[12.5px]">{s.profession}</span> : null}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {trending ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px]"
              style={{ background: BLUE_SOFT, color: BLUE }}
            >
              <TrendingUp className="h-[11px] w-[11px]" strokeWidth={2} />
              Em alta
            </span>
          ) : null}
          {s.isMine ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Opções da publicação"
                onClick={() => setMenuOpen((v) => !v)}
                className="-mr-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition active:scale-[0.95]"
                style={{ color: MUTED }}
              >
                <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <AnimatePresence>
                {menuOpen ? (
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      className="fixed inset-0 z-20 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: easeOut }}
                      className="absolute right-0 top-[34px] z-30 min-w-[184px] overflow-hidden rounded-[12px]"
                      style={{
                        background: "#FFFFFF",
                        border: `1px solid ${HAIRLINE}`,
                        boxShadow: "0 10px 28px rgba(17,17,17,0.10)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmOpen(true);
                        }}
                        className="w-full px-4 py-3 text-left text-[14px]"
                        style={{ color: "#C0392B" }}
                      >
                        Excluir publicação
                      </button>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-2.5 text-[16.5px] leading-[1.4]" style={{ color: INK }}>
        {sentenceCase(s.story)}
      </p>

      <div className="mt-5 flex items-center gap-1">
        <div className="relative">
          <motion.button
            type="button"
            onClick={toggleReaction}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.18, ease: easeOut }}
            aria-pressed={reacted}
            aria-label="Boa direção"
            className="-ml-2 inline-flex items-center gap-2 rounded-full px-2.5 py-2 text-[14.5px]"
            style={{ color: reacted ? BLUE : MUTED }}
          >
            <Target
              className="h-[22px] w-[22px]"
              strokeWidth={reacted ? 2 : 1.6}
            />
            {count > 0 ? (
              <span className={reacted ? "font-semibold" : ""}>{nf.format(count)}</span>
            ) : null}
          </motion.button>
          <AnimatePresence>
            {flash ? (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18, ease: easeOut }}
                className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-20 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[12px]"
                style={{
                  background: "#FFFFFF",
                  color: BLUE,
                  border: `1px solid ${HAIRLINE}`,
                  boxShadow: "0 6px 20px rgba(17,17,17,0.08)",
                }}
              >
                Boa direção 🎯
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {s.direction || s.howApplied ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.18, ease: easeOut }}
            aria-label="Ver direção"
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-2 text-[14px]"
            style={{ color: MUTED }}
          >
            <Eye className="h-[22px] w-[22px]" strokeWidth={1.6} />
            <span className="whitespace-nowrap">Ver direção</span>
          </motion.button>
        ) : null}

        <motion.button
          type="button"
          onClick={() => {
            if (!saved) save.mutate();
          }}
          disabled={saved || save.isPending}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.18, ease: easeOut }}
          aria-label={saved ? "Direção salva" : "Salvar direção"}
          aria-pressed={saved}
          className="ml-auto -mr-2 inline-flex items-center justify-center rounded-full px-2.5 py-2 disabled:opacity-100"
          style={{ color: saved ? BLUE : MUTED }}
        >
          <Bookmark
            className="h-[22px] w-[22px]"
            strokeWidth={saved ? 1.9 : 1.6}
            fill={saved ? "currentColor" : "none"}
          />
        </motion.button>
      </div>

      <DirectionSheet
        open={open}
        onClose={() => setOpen(false)}
        story={s}
        saved={saved}
        onSave={() => {
          save.mutate();
          setOpen(false);
        }}
      />

      <AnimatePresence>
        {confirmOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(17,17,17,0.28)" }}
            onClick={() => (remove.isPending ? null : setConfirmOpen(false))}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: easeOut }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[340px] rounded-[20px] p-6 text-center"
              style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(17,17,17,0.16)" }}
            >
              <p className="text-[16px] font-semibold" style={{ color: INK }}>
                Excluir este impacto?
              </p>
              <p className="mt-2 text-[13.5px] leading-[1.45]" style={{ color: MUTED }}>
                Ele deixará de aparecer no mural do Impacto.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={remove.isPending}
                  className="flex-1 rounded-full px-4 py-2.5 text-[14px] transition active:scale-[0.98] disabled:opacity-60"
                  style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="flex-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-white transition active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "#C0392B" }}
                >
                  {remove.isPending ? "Excluindo…" : "Excluir"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

function DirectionSheet({
  open,
  onClose,
  story,
  saved,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  story: ImpactStory;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="dir-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(17,17,17,0.24)" }}
          />
          <motion.div
            key="dir-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="fixed inset-x-0 bottom-0 z-[91] mx-auto max-h-[80vh] max-w-[620px] overflow-y-auto rounded-t-[22px] px-6 pb-8 pt-4"
            style={{ background: BG, boxShadow: "0 -8px 40px rgba(17,17,17,0.08)" }}
          >
            <div
              className="mx-auto mb-5 h-[4px] w-9 rounded-full"
              style={{ background: HAIRLINE }}
            />
            <p className="text-[11.5px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
              Direção seguida
            </p>
            <p className="mt-1.5 text-[16.5px] leading-[1.45]" style={{ color: INK }}>
              {sentenceCase(story.direction ?? story.story)}
            </p>
            {story.howApplied ? (
              <>
                <p
                  className="mt-6 text-[11.5px] uppercase tracking-[0.14em]"
                  style={{ color: MUTED }}
                >
                  Por que essa direção?
                </p>
                <p className="mt-1.5 text-[15px] leading-[1.55]" style={{ color: INK }}>
                  {sentenceCase(story.howApplied)}
                </p>
              </>
            ) : null}
            {saved ? (
              <p
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-medium"
                style={{ background: "#F5F5F7", color: MUTED }}
              >
                <Bookmark className="h-4 w-4" strokeWidth={1.8} fill="currentColor" />
                Direção salva.
              </p>
            ) : (
              <button
                type="button"
                onClick={onSave}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white"
                style={{ background: BLUE }}
              >
                <Bookmark className="h-4 w-4" strokeWidth={1.9} />
                Salvar direção
              </button>
            )}
            <p className="mt-3 text-center text-[12.5px] leading-[1.5]" style={{ color: MUTED }}>
              Direções salvas não viram MAG Meta. A MAG usa esse interesse para escolher a sua
              próxima direção quando fizer sentido.
            </p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function ImpactoPage() {
  return <ImpactoPageInner />;
}

type SortKey = "relevant" | "recent" | "profession" | "trending";

const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: "relevant", label: "Relevantes agora", hint: "Recência, utilidade e afinidade com seu contexto" },
  { key: "recent", label: "Mais recentes", hint: "Impactos publicados agora há pouco" },
  { key: "profession", label: "Minha profissão", hint: "Resultados de quem faz o que você faz" },
  { key: "trending", label: "Em alta", hint: "Direções úteis para mais pessoas que o padrão recente" },
];

/** Concretude: números, valores e verbos de resultado pesam mais. */
function concretenessScore(s: ImpactStory) {
  const text = `${s.story} ${s.fullResult ?? ""}`;
  let score = 0;
  if (/\d/.test(text)) score += 1.2;
  if (/R\$|%|clientes?|agendament|vendas?|reuni|contrat/i.test(text)) score += 1.2;
  if (text.length > 90) score += 0.6;
  if (s.direction) score += 0.4;
  if (s.howApplied) score += 0.4;
  return score;
}

function relevanceScore(s: ImpactStory, profession: string | null) {
  const recency = Math.exp(-hoursOf(s) / 72) * 3; // decai suavemente
  const validation = Math.log1p(s.validations) * 1.4;
  const affinity =
    profession && s.profession && s.profession.toLowerCase().includes(profession.toLowerCase())
      ? 2.2
      : 0;
  return recency + validation + affinity + concretenessScore(s);
}

/** Em alta: validações por hora acima do padrão recente do mural. */
function trendingSet(list: ImpactStory[]) {
  const recent = list.filter((s) => hoursOf(s) <= 72);
  if (recent.length < 3) return new Set<string>();
  const rate = (s: ImpactStory) => s.validations / Math.max(2, hoursOf(s));
  const rates = recent.map(rate);
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const sd =
    Math.sqrt(rates.reduce((a, b) => a + (b - avg) ** 2, 0) / rates.length) || 0;
  const threshold = avg + Math.max(sd, avg * 0.35);
  return new Set(recent.filter((s) => s.validations > 0 && rate(s) > threshold).map((s) => s.id));
}

function FilterSheet({
  open,
  value,
  onChange,
  onClear,
  onClose,
}: {
  open: boolean;
  value: SortKey;
  onChange: (v: SortKey) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(17,17,17,0.24)" }}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-[620px] rounded-t-[22px] px-6 pb-8 pt-4"
            style={{ background: BG, boxShadow: "0 -8px 40px rgba(17,17,17,0.08)" }}
          >
            <div
              className="mx-auto mb-4 h-[4px] w-9 rounded-full"
              style={{ background: HAIRLINE }}
            />
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold" style={{ color: INK }}>
                Filtrar
              </p>
              <button
                type="button"
                onClick={onClear}
                className="text-[13px]"
                style={{ color: BLUE }}
              >
                Limpar
              </button>
            </div>
            <div className="mt-3">
              {SORT_OPTIONS.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onChange(o.key)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  style={{ borderTop: i === 0 ? "none" : `1px solid ${HAIRLINE}` }}
                >
                  <span>
                    <span className="block text-[15px]" style={{ color: INK }}>
                      {o.label}
                    </span>
                    <span className="mt-0.5 block text-[12.5px]" style={{ color: MUTED }}>
                      {o.hint}
                    </span>
                  </span>
                  {value === o.key ? (
                    <Check
                      className="h-[16px] w-[16px] shrink-0"
                      strokeWidth={2}
                      style={{ color: BLUE }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function relativeFromMs(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "Atualizado agora";
  if (min < 60) return `Atualizado há ${min} min`;
  return `Atualizado há ${Math.round(min / 60)} h`;
}

function ImpactoPageInner() {
  return <ImpactoPageBody />;
}

/** Convite direto: o usuário já registrou um resultado, mas ainda não publicou. */
function PendingImpactCard({
  pending,
  profession,
}: {
  pending: { id: string; outcome_text: string; direction_title: string | null };
  profession: string | null;
}) {
  const qc = useQueryClient();
  const publish = useServerFn(publishImpactById);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      let shortName: string | null = null;
      if (uid) {
        const { data: row } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", uid)
          .maybeSingle();
        const n = (row?.full_name as string | null)?.trim();
        if (n) {
          const parts = n.split(/\s+/);
          shortName =
            parts.length > 1 ? `${parts[0]} ${parts[1]![0]!.toUpperCase()}.` : (parts[0] ?? null);
        }
      }
      return publish({
        data: { id: pending.id, author_name: shortName, profession: profession ?? null },
      });
    },
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["impact-overview"] });
      qc.invalidateQueries({ queryKey: ["pending-impact"] });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
      className="mt-10"
    >
      <p className="text-[14px] font-medium" style={{ color: INK }}>
        Seu primeiro impacto está pronto para ser publicado.
      </p>
      <p className="mt-3 text-[16px] leading-[1.45]" style={{ color: BLUE }}>
        “{pending.outcome_text}”
      </p>
      {done ? (
        <p className="mt-5 inline-flex items-center gap-1.5 text-[13px]" style={{ color: MUTED }}>
          <Check className="h-3.5 w-3.5" strokeWidth={2} /> Publicado no Impacto
        </p>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-3 text-[14px] font-medium transition disabled:opacity-70"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          {mutation.isPending ? "Publicando…" : "Publicar impacto"}
        </button>
      )}
    </motion.div>
  );
}

function ImpactoPageBody() {
  const fetchOverview = useServerFn(getImpactOverview);
  const fetchSaved = useServerFn(listSavedDirections);
  const fetchPending = useServerFn(getPendingImpact);
  const { novo } = Route.useSearch();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("relevant");
  const { data, isLoading } = useQuery({
    queryKey: ["impact-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 5 * 60_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
  });

  const { data: savedList } = useQuery({
    queryKey: ["saved-directions"],
    queryFn: () => fetchSaved(),
    staleTime: 60_000,
  });
  const { data: pending } = useQuery({
    queryKey: ["pending-impact"],
    queryFn: () => fetchPending(),
    staleTime: 60_000,
  });
  const savedIds = useMemo(
    () => new Set((savedList ?? []).map((r) => r.source_id).filter(Boolean) as string[]),
    [savedList],
  );

  const [visible, setVisible] = useState<ImpactStory[]>([]);
  const [syncedAt, setSyncedAt] = useState<number>(() => Date.now());
  const [profession, setProfession] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: u }) => {
      const uid = u.user?.id;
      if (!uid) return;
      supabase
        .from("profiles")
        .select("profession")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data: row }) => {
          if (mounted) setProfession((row?.profession as string | null) ?? null);
        });
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Mural vivo: novos impactos entram automaticamente, com transição suave.
  useEffect(() => {
    if (!data?.stories) return;
    setVisible((prev) => {
      const same =
        prev.length === data.stories.length &&
        prev.every((p, i) => {
          const n = data.stories[i];
          return n && n.id === p.id && n.validations === p.validations;
        });
      return same ? prev : data.stories;
    });
    setSyncedAt(Date.now());
  }, [data?.stories]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Notificação tocada: destaca e rola até a publicação
  useEffect(() => {
    if (!novo || visible.length === 0) return;
    const el = document.getElementById(`impact-${novo}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [novo, visible.length]);

  const trendingIds = useMemo(() => trendingSet(visible), [visible]);

  const stories = useMemo(() => {
    let list = [...visible];
    if (sort === "recent") {
      list.sort((a, b) => hoursOf(a) - hoursOf(b));
    } else if (sort === "trending") {
      list = list.filter((s) => trendingIds.has(s.id));
      list.sort((a, b) => b.validations - a.validations);
      return list;
    } else if (sort === "profession") {
      if (profession) {
        const p = profession.toLowerCase();
        list = list.filter((s) => s.profession?.toLowerCase().includes(p));
      }
      list.sort((a, b) => relevanceScore(b, profession) - relevanceScore(a, profession));
      return list;
    } else {
      list.sort((a, b) => relevanceScore(b, profession) - relevanceScore(a, profession));
    }
    return list;
  }, [visible, sort, profession, trendingIds]);

  return (
    <div className="min-h-screen" style={{ background: BG, color: INK }}>
      <AppHeader />
      <main className="mx-auto max-w-[620px] px-6 pb-40 pt-8 sm:px-8 sm:pt-10">
        <div className="flex items-start justify-between gap-4">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="text-[30px] font-semibold leading-[1.05] sm:text-[36px]"
            style={{ ...DISPLAY, color: INK }}
          >
            Impacto
          </motion.h1>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-[7px] text-[13px]"
            style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, color: INK }}
          >
            <SlidersHorizontal
              className="h-[13px] w-[13px]"
              strokeWidth={1.8}
              style={{ color: MUTED }}
            />
            Filtrar
            <ChevronDown className="h-[13px] w-[13px]" strokeWidth={1.8} style={{ color: MUTED }} />
          </button>
        </div>

        <p className="mt-5 text-[12.5px]" style={{ color: MUTED }}>
          {relativeFromMs(syncedAt)}
        </p>

        {isLoading ? (
          <p className="mt-14 text-[14px]" style={{ color: MUTED }}>
            Carregando…
          </p>
        ) : (
          <LayoutGroup>
            <ul className="mt-10">
              <AnimatePresence initial={false}>
                {stories.map((s, i) => (
                  <Post
                    key={s.id}
                    s={s}
                    index={i}
                    trending={trendingIds.has(s.id)}
                    highlighted={novo === s.id}
                    savedIds={savedIds}
                  />
                ))}
              </AnimatePresence>
            </ul>
            {stories.length === 0 ? (
              pending ? (
                <PendingImpactCard pending={pending} profession={profession} />
              ) : (
                <p className="mt-10 text-[14px]" style={{ color: MUTED }}>
                  Nada por aqui ainda. Os primeiros resultados reais aparecem assim que
                  alguém publicar um impacto.
                </p>
              )
            ) : null}
          </LayoutGroup>
        )}

        {data && data.community.professionalsToday > 0 && data.community.usefulPct > 0 ? (
          <p
            className="mt-12 pt-7 text-[13px] leading-[1.6]"
            style={{ color: MUTED, borderTop: `1px solid ${HAIRLINE}` }}
          >
            <span style={{ color: BLUE }}>{nf.format(data.community.professionalsToday)}</span>{" "}
            profissionais seguiram suas MAG Metas.{" "}
            <span style={{ color: BLUE }}>{data.community.usefulPct}%</span> disseram que a direção
            funcionou.
          </p>
        ) : null}
      </main>
      <FilterSheet
        open={sheetOpen}
        value={sort}
        onChange={(v) => {
          setSort(v);
          setSheetOpen(false);
        }}
        onClear={() => {
          setSort("relevant");
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
