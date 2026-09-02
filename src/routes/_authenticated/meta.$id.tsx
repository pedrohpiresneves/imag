import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, Check, MessageCircle, RefreshCw, ThumbsDown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { getGoalDetail, markGoalNotUseful } from "@/lib/goal-history.functions";

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

export const Route = createFileRoute("/_authenticated/meta/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Detalhes da meta · iMAG" },
      {
        name: "description",
        content: "Veja o contexto completo de uma direção anterior e o que aconteceu depois.",
      },
      { property: "og:title", content: "Detalhes da meta · iMAG" },
      { property: "og:description", content: "O contexto completo de uma direção da iMAG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MetaDetailPage,
});

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  completed: { label: "✓ Concluída", color: "#1F7A4C" },
  missed: { label: "Não realizada", color: "#C2703B" },
  expired: { label: "Expirada", color: "#8A8A90" },
  active: { label: "Em andamento", color: BLUE },
};

function MetaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const detailFn = useServerFn(getGoalDetail);
  const notUsefulFn = useServerFn(markGoalNotUseful);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["goal-detail", id],
    queryFn: () => detailFn({ data: { id } }),
  });

  const notUseful = useMutation({
    mutationFn: () => notUsefulFn({ data: { id, title: meta?.title } }),
  });

  const status = meta ? (STATUS_LABEL[meta.status] ?? STATUS_LABEL.active!) : null;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
    >
      <div className="surface-light">
        <AppHeader />
      </div>

      <main className="mx-auto w-full max-w-xl px-5 pb-40 pt-7 sm:px-8">
        <button
          type="button"
          onClick={() => navigate({ to: "/historico", search: { f: undefined } })}
          className="inline-flex items-center gap-1.5 text-[13.5px]"
          style={{ color: MUTED }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          Histórico
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mt-5 text-[30px] font-semibold sm:text-[36px]"
          style={DISPLAY}
        >
          Detalhes da meta
        </motion.h1>

        {isLoading ? (
          <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
            Carregando…
          </p>
        ) : !meta ? (
          <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
            Esta meta não está mais disponível.
          </p>
        ) : (
          <>
            <p className="mt-6 text-[12.5px]" style={{ color: MUTED }}>
              {formatDate(meta.date)}
            </p>
            <p className="mt-2 text-[17px] leading-[1.5]" style={{ color: INK }}>
              {meta.description ?? meta.title}
            </p>
            <p className="mt-3 text-[12.5px]" style={{ color: MUTED }}>
              Origem:{" "}
              {meta.origin_kind === "shared"
                ? `Compartilhada por ${meta.origin_label ?? "alguém"}`
                : meta.origin_kind === "impact"
                  ? "Impacto"
                  : "MAG Meta"}
            </p>
            <p className="mt-1 text-[12.5px] font-medium" style={{ color: status!.color }}>
              {status!.label}
            </p>

            {meta.reason && (
              <Block title="Por que essa meta?">{meta.reason}</Block>
            )}
            {meta.after && <Block title="O que aconteceu depois?">{meta.after}</Block>}

            <div className="mt-8 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/aplicar-direcao",
                    search: { d: meta.description ?? meta.title },
                  })
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium text-white transition hover:opacity-90"
                style={{ background: BLUE }}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
                Aplicar novamente
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "mag_prefill",
                      `Quero falar sobre esta direção: "${meta.description ?? meta.title}". O que faço agora?`,
                    );
                  } catch {
                    /* sessionStorage indisponível */
                  }
                  navigate({ to: "/mentor" });
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3.5 text-[14px] font-medium transition hover:bg-black/[0.02]"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
                Conversar com a MAG sobre isso
              </button>
              <button
                type="button"
                disabled={notUseful.isPending || notUseful.isSuccess}
                onClick={() => notUseful.mutate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium transition hover:bg-black/[0.03] disabled:opacity-70"
                style={{ color: MUTED }}
              >
                {notUseful.isSuccess ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={1.9} />
                    Obrigado pelo retorno
                  </>
                ) : (
                  <>
                    <ThumbsDown className="h-4 w-4" strokeWidth={1.7} />
                    Não foi útil para mim
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <p
        className="text-[10px] font-semibold uppercase"
        style={{ color: BLUE, letterSpacing: "0.22em", fontFamily: "var(--font-mono)" }}
      >
        {title}
      </p>
      <p className="mt-2 text-[14.5px] leading-[1.55]" style={{ color: INK }}>
        {children}
      </p>
    </div>
  );
}
