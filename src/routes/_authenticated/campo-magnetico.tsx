import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useAccess } from "@/lib/use-access";
import { useServerFn } from "@tanstack/react-start";
import { listRecentReflections } from "@/lib/reflections.functions";
import { Target, Flame, CheckCircle2, TrendingUp, Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeScore } from "@/lib/campo-magnetico/score";
import { getSharedImpact } from "@/lib/shared-directions.functions";
import { ShareCardModal } from "@/components/ShareCardModal";
import { useShareStats } from "@/lib/share-cards/useShareStats";

const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const BLUE = "#335CFF";
const TRACK = "#EEF4FF";
const INK = "#0A0A0A";
const MUTED = "#6E6E73";

export const Route = createFileRoute("/_authenticated/campo-magnetico")({
  head: () => ({
    meta: [
      { title: "Campo Magnético · iMAG" },
      {
        name: "description",
        content:
          "Seu Campo Magnético em quatro anéis: Foco, Consistência, Execução e Impacto.",
      },
      { property: "og:title", content: "Campo Magnético · iMAG" },
      {
        property: "og:description",
        content: "Acompanhe diariamente a evolução do seu Campo Magnético.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CampoMagnetico,
});

function levelFor(total: number | null): string {
  if (total == null) return "Coletando dados";
  if (total >= 70) return "Irradiando";
  if (total >= 40) return "Em expansão";
  if (total >= 15) return "Despertando";
  return "Em formação";
}

function phraseFor(total: number | null): string {
  if (total == null) return "Seus primeiros dias definem a base do seu campo.";
  if (total >= 70) return "Suas ações mostram constância e direção.";
  if (total >= 40) return "Você criou uma rotina sólida. Continue nessa direção.";
  if (total >= 15) return "Seu ritmo está fortalecendo seu campo.";
  return "Você está construindo consistência. Continue.";
}

function AnimatedNumber({
  value,
  duration = 900,
  className,
  style,
}: {
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const to = Math.max(0, Math.round(value));
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={className} style={style}>
      {n}
    </span>
  );
}

type RingKey = "focus" | "consistency" | "authority" | "magnetism";

const META: Record<
  RingKey,
  { label: string; icon: typeof Target; color: string; grad: [string, string]; desc: string }
> = {
  focus: {
    label: "Foco",
    icon: Target,
    color: "#335CFF",
    grad: ["#335CFF", "#5C7CFF"],
    desc: "Mede a clareza do seu objetivo e quanto das suas MAG Metas você conclui.",
  },
  consistency: {
    label: "Consistência",
    icon: Flame,
    color: "#2A56C6",
    grad: ["#2A56C6", "#4F7BF0"],
    desc: "Mede sua presença diária: sequência de check-ins e dias ativos.",
  },
  authority: {
    label: "Execução",
    icon: CheckCircle2,
    color: "#3B72E8",
    grad: ["#3B72E8", "#6C9BFF"],
    desc: "Mede as evidências do seu posicionamento: estratégias executadas e resultados.",
  },
  magnetism: {
    label: "Impacto",
    icon: TrendingUp,
    color: "#6C9BFF",
    grad: ["#6C9BFF", "#A8C4FF"],
    desc: "É o resultado combinado de Foco, Consistência, Execução e atividade recente.",
  },
};

const ORDER: RingKey[] = ["focus", "consistency", "authority", "magnetism"];

/** Um azul iMAG forte + tons progressivamente mais suaves. */
const RING_COLORS: Record<RingKey, string> = {
  focus: "#335CFF",
  consistency: "#7E9BFF",
  authority: "#AEC0FF",
  magnetism: "#D6DFFF",
};

/** Lê o valor bruto de um sinal calculado no score. */
function sig(
  ind: { signals: { key: string; current?: number; target?: number }[] },
  key: string,
): { current: number; target: number } {
  const s = ind.signals.find((x) => x.key === key);
  return { current: s?.current ?? 0, target: s?.target ?? 0 };
}

/** Explicações curtas e concretas, baseadas em dados reais do usuário. */
function explanationsFor(score: ReturnType<typeof computeScore>): Record<RingKey, string> {
  const done = sig(score.focus, "completion");
  const active7 = sig(score.consistency, "active7").current;
  const strategies = sig(score.authority, "strategies").current;
  const results = sig(score.authority, "results").current;
  const shared = sig(score.magnetism, "shared").current;

  return {
    focus:
      done.target > 0
        ? `Você concluiu ${done.current} de ${done.target} direções registradas.`
        : "Você ainda não registrou direções concluídas.",
    consistency:
      active7 > 0
        ? `Você utilizou a iMAG em ${active7} ${active7 === 1 ? "dia" : "dias"} desta semana.`
        : "Você ainda não usou a iMAG esta semana.",
    authority:
      strategies > 0
        ? `Você executou ${strategies} ${strategies === 1 ? "ação" : "ações"} de posicionamento e relacionamento.`
        : "Ainda não há ações de posicionamento registradas.",
    magnetism:
      results > 0 || shared > 0
        ? `Suas direções geraram ${results + shared} ${results + shared === 1 ? "resposta ou oportunidade" : "respostas e oportunidades"}.`
        : "Suas direções ainda não geraram respostas ou oportunidades registradas.",
  };
}

const WHAT_COUNTS: { key: RingKey; text: string }[] = [
  { key: "focus", text: "Concluir as MAG Metas que você recebe todos os dias." },
  { key: "consistency", text: "Voltar à iMAG e registrar o check-in com frequência." },
  {
    key: "authority",
    text: "Executar ações de posicionamento e relacionamento com seu público.",
  },
  {
    key: "magnetism",
    text: "Registrar respostas, contatos e oportunidades que suas direções geraram.",
  },
];

function Rings({
  values,
  selected,
  onSelect,
}: {
  values: Record<RingKey, number>;
  selected: RingKey | null;
  onSelect: (k: RingKey | null) => void;
}) {
  const size = 320;
  const c = size / 2;
  const stroke = 13;
  const gap = 9;
  const radii = ORDER.map((_, i) => c - stroke / 2 - 4 - i * (stroke + gap));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
      {ORDER.map((k, i) => {
        const r = radii[i];
        const circ = 2 * Math.PI * r;
        const v = Math.max(0, Math.min(100, values[k]));
        const dim = selected !== null && selected !== k;
        return (
          <g
            key={k}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(selected === k ? null : k)}
          >
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={TRACK}
              strokeWidth={stroke}
              opacity={dim ? 0.5 : 1}
              style={{ transition: "opacity 300ms ease" }}
            />
            <motion.circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={RING_COLORS[k]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ, opacity: 0 }}
              animate={{
                strokeDashoffset: circ - (circ * v) / 100,
                opacity: dim ? 0.25 : 1,
              }}
              transition={{
                strokeDashoffset: { duration: 0.85, delay: 0.08 * i, ease: easeOut },
                opacity: { duration: 0.3, ease: "easeOut" },
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CampoMagnetico() {
  const { userId } = useAccess();
  const listRecent = useServerFn(listRecentReflections);

  const { data: reflections = [] } = useQuery({
    queryKey: ["reflections-campo", userId],
    queryFn: () => listRecent(),
    enabled: !!userId,
  });

  const { data: profileRow } = useQuery({
    queryKey: ["campo-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("goal")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: magneticRow } = useQuery({
    queryKey: ["campo-magnetic", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("magnetic_profile")
        .select("completeness")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const hasClearGoal = !!(profileRow?.goal && profileRow.goal.trim().length > 3);
  const getImpact = useServerFn(getSharedImpact);
  const { data: sharedImpact } = useQuery({
    queryKey: ["shared-impact", userId],
    queryFn: () => getImpact(),
    enabled: !!userId,
  });
  const score = useMemo(
    () =>
      computeScore({
        reflections,
        profileCompleteness: magneticRow?.completeness ?? null,
        hasClearGoal,
        sharedExecuted:
          (sharedImpact?.executedReceived ?? 0) + (sharedImpact?.executedSent ?? 0),
      }),
    [reflections, magneticRow, hasClearGoal, sharedImpact],
  );

  const values: Record<RingKey, number> = {
    focus: score.focus.value ?? 0,
    consistency: score.consistency.value ?? 0,
    authority: score.authority.value ?? 0,
    magnetism: score.magnetism.value ?? 0,
  };
  const total = score.total ?? 0;

  // Variação da semana: compara com o campo calculado sem os últimos 7 dias.
  const weekDelta = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const past = reflections.filter((r) => r.reflected_for < cutoffIso);
    if (past.length === 0 && reflections.length === 0) return 0;
    const prev = computeScore({
      reflections: past,
      profileCompleteness: magneticRow?.completeness ?? null,
      hasClearGoal,
      sharedExecuted: 0,
    });
    return Math.max(0, (score.total ?? 0) - (prev.total ?? 0));
  }, [reflections, magneticRow, hasClearGoal, score.total]);

  const explanations = useMemo(() => explanationsFor(score), [score]);

  const [selected, setSelected] = useState<RingKey | null>(null);
  const [centerOpen, setCenterOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const share = useShareStats();

  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
    >
      <div className="surface-light">
        <AppHeader />
      </div>

      <main className="relative mx-auto flex max-w-xl flex-col items-center px-5 pb-40 pt-10 sm:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="w-full text-left text-[30px] font-semibold leading-[1.05] sm:text-[36px]"
          style={{ ...DISPLAY, color: INK }}
        >
          Campo
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: easeOut }}
          className="mt-3 w-full self-start max-w-[24rem] text-left text-[15px] leading-snug"
          style={{ color: MUTED }}
        >
          Seu campo evolui a cada direção…
        </motion.p>

        {/* GRÁFICO */}
        <div className="relative mt-8 w-full max-w-[304px]">
          <div className="relative aspect-square w-full">
            <Rings values={values} selected={selected} onSelect={setSelected} />
            <div className="absolute inset-0 grid place-items-center">
              <button
                type="button"
                onClick={() => {
                  if (selected) setSelected(null);
                  else setCenterOpen((v) => !v);
                }}
                className="text-center"
              >
                <AnimatedNumber
                  value={selected ? values[selected] : total}
                  className="block text-[43px] font-semibold leading-none tabular-nums"
                  style={{ ...DISPLAY, color: BLUE }}
                />
                {selected && (
                  <div className="mt-2 text-[13.5px] font-medium" style={{ color: INK }}>
                    {META[selected].label}
                  </div>
                )}
                <div className="mt-2 text-[11.5px] font-normal" style={{ color: "#3A3A3E" }}>
                  {selected
                    ? "Indicador ↗"
                    : weekDelta > 0
                      ? `+${weekDelta} nos últimos 7 dias`
                      : levelFor(score.total)}
                </div>
                <AnimatePresence>
                  {!selected && centerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.28, ease: easeOut }}
                      className="mx-auto mt-2 max-w-[10.5rem] text-[11.5px] leading-snug"
                      style={{ color: MUTED }}
                    >
                      {weekDelta > 0
                        ? `Seu Campo aumentou ${weekDelta} ${weekDelta === 1 ? "ponto" : "pontos"} esta semana.`
                        : "Seu Campo se manteve estável esta semana."}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>

        {/* INDICADORES */}
        <div className="mt-8 grid w-full max-w-[400px] grid-cols-4">
          {ORDER.map((k, i) => {
            const Icon = META[k].icon;
            const active = selected === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(active ? null : k)}
                className="flex flex-col items-center gap-1.5 px-1 py-1 transition"
                style={{
                  opacity: selected && !active ? 0.4 : 1,
                  borderLeft: i === 0 ? undefined : "1px solid #F0F0F3",
                  transitionDuration: "300ms",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} style={{ color: BLUE }} />
                <span
                  className="text-[17px] font-semibold leading-none tabular-nums"
                  style={{ ...DISPLAY, color: "#111111" }}
                >
                  {values[k]}
                </span>
                <span
                  className="text-[11.5px] font-normal leading-none"
                  style={{ color: MUTED, letterSpacing: "-0.005em" }}
                >
                  {META[k].label}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.p
              key={selected}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: easeOut }}
              className="mt-6 max-w-[20rem] text-center text-[13px] leading-relaxed"
              style={{ color: MUTED }}
            >
              <span className="font-medium" style={{ color: INK }}>
                {META[selected].label} — {values[selected]}
              </span>
              <br />
              {explanations[selected]}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!selected && (
            <motion.p
              key={phraseFor(score.total)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.45, ease: easeOut }}
              className="mt-5 max-w-[18rem] text-center text-[12.5px] leading-relaxed"
              style={{ color: MUTED }}
            >
              {phraseFor(score.total)}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-10 flex w-full justify-center">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="text-[13px] font-medium transition hover:opacity-70"
            style={{ color: MUTED }}
          >
            Entenda seu Campo
          </button>
        </div>

        <div className="mt-5 flex w-full justify-center">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center justify-center gap-2 text-[13px] font-medium transition hover:opacity-70"
            style={{ color: "var(--imag-blue)" }}
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.7} />
            Compartilhar progresso
          </button>
        </div>

        <AnimatePresence>
          {guideOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setGuideOpen(false)}
                className="fixed inset-0 z-40"
                style={{ background: "rgba(10,10,10,0.28)" }}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.34, ease: easeOut }}
                className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl rounded-t-[24px] px-6 pb-10 pt-5"
                style={{ background: "#FFFFFF", boxShadow: "0 -12px 40px rgba(10,10,10,0.12)" }}
              >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: "#E7E7EC" }} />
                <div className="flex items-start justify-between gap-4">
                  <h2
                    className="text-[22px] font-semibold leading-tight"
                    style={{ ...DISPLAY, color: INK }}
                  >
                    Entenda seu Campo
                  </h2>
                  <button type="button" onClick={() => setGuideOpen(false)} aria-label="Fechar">
                    <X className="h-5 w-5" strokeWidth={1.8} style={{ color: MUTED }} />
                  </button>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
                  Seu Campo é a média de quatro indicadores. Cada ação registrada na iMAG
                  move um deles.
                </p>
                <ul className="mt-5 space-y-4">
                  {WHAT_COUNTS.map(({ key, text }) => {
                    const Icon = META[key].icon;
                    return (
                      <li key={key} className="flex gap-3">
                        <Icon
                          className="mt-0.5 h-4 w-4 shrink-0"
                          strokeWidth={1.9}
                          style={{ color: META[key].color }}
                        />
                        <div>
                          <div className="text-[14px] font-medium" style={{ color: INK }}>
                            {META[key].label}
                          </div>
                          <div className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                            {text}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-6 text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
                  Não existe comparação com outras pessoas. O Campo mede apenas a sua
                  evolução ao longo do tempo.
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <ShareCardModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          initialTemplate="level"
          data={share.data}
          availableTemplates={share.availableTemplates}
          onOpen={share.refresh}
          refreshing={share.isLoading}
        />
      </main>
      <BottomNav />
    </div>
  );
}
