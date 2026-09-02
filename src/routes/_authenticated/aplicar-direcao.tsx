import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import { adaptDirection, addDirectionToToday } from "@/lib/apply-direction.functions";

type Search = { d: string; id?: string };

export const Route = createFileRoute("/_authenticated/aplicar-direcao")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    d: typeof raw.d === "string" ? raw.d.slice(0, 600) : "",
    id: typeof raw.id === "string" ? raw.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Aplicar direção · iMAG" },
      {
        name: "description",
        content: "Adapte uma direção validada para o seu momento e transforme em ação de hoje.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AplicarDirecaoPage,
});

const easeOut = [0.22, 1, 0.36, 1] as const;
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.035em",
};

const BG = "#FFFFFF";
const INK = "#111111";
const MUTED = "#7B7F89";
const HAIRLINE = "#EDEDF0";
const BLUE = "#335CFF";
const BLUE_SOFT = "#F1F4FB";

function localDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function markDirectionApplied(id: string) {
  try {
    const raw = localStorage.getItem("imag.applied-directions");
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) localStorage.setItem("imag.applied-directions", JSON.stringify([...list, id]));
  } catch {
    /* ignore */
  }
}

export function isDirectionApplied(id: string) {
  try {
    const raw = localStorage.getItem("imag.applied-directions");
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(id);
  } catch {
    return false;
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function AplicarDirecaoPage() {
  const { d, id } = Route.useSearch();
  const navigate = useNavigate();
  const adapt = useServerFn(adaptDirection);
  const add = useServerFn(addDirectionToToday);
  const [variant, setVariant] = useState(0);
  const [done, setDone] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["adapt-direction", d, variant],
    queryFn: () => adapt({ data: { direction: d, variant } }),
    enabled: d.length > 2,
    staleTime: Infinity,
  });

  const addMutation = useMutation({
    mutationFn: () => add({ data: { local_date: localDate(), action: data?.action ?? d } }),
    onSuccess: () => {
      if (id) markDirectionApplied(id);
      setDone(true);
    },
  });

  if (done) {
    return (
      <div className="min-h-screen" style={{ background: BG, color: INK }}>
        <main className="mx-auto flex min-h-screen max-w-[620px] flex-col justify-center px-6 pb-20 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: BLUE_SOFT }}
            >
              <Check className="h-[20px] w-[20px]" strokeWidth={2} style={{ color: BLUE }} />
            </div>
            <h1
              className="mt-6 text-[34px] font-semibold leading-[1.05]"
              style={{ ...DISPLAY, color: INK }}
            >
              Direção adicionada!
            </h1>
            <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: MUTED }}>
              Ela já está na sua MAG Meta de hoje.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/app" }).catch(() => {})}
              className="mt-9 w-full rounded-[14px] py-[15px] text-[15px] font-semibold text-white"
              style={{ background: BLUE }}
            >
              Ver minha MAG Meta
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/impacto", search: { novo: undefined } }).catch(() => {})}
              className="mt-4 w-full text-[14px]"
              style={{ color: MUTED }}
            >
              Continuar explorando
            </button>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BG, color: INK }}>
      <main className="mx-auto max-w-[620px] px-6 pb-28 pt-8 sm:px-8 sm:pt-12">
        <button
          type="button"
          onClick={() => navigate({ to: "/impacto", search: { novo: undefined } }).catch(() => {})}
          className="inline-flex items-center gap-1.5 text-[13.5px]"
          style={{ color: MUTED }}
        >
          <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} />
          Impacto
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
          className="mt-7 text-[32px] font-semibold leading-[1.05] sm:text-[38px]"
          style={{ ...DISPLAY, color: INK }}
        >
          Aplicar esta direção
        </motion.h1>
        <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: MUTED }}>
          Vou adaptar essa direção para o seu momento.
        </p>

        <div className="mt-10">
          <Label>Direção aplicada</Label>
          <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: INK }}>
            “{d}”
          </p>
        </div>

        <div className="mt-9 pt-8" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <Label>Adaptada para você</Label>
          <p className="mt-1.5 text-[12.5px]" style={{ color: MUTED }}>
            Baseado no seu perfil, profissão e objetivos.
          </p>

          {isFetching || !data ? (
            <p className="mt-5 text-[14px]" style={{ color: MUTED }}>
              Adaptando…
            </p>
          ) : (
            <motion.div
              key={variant}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <div
                className="mt-5 rounded-r-[10px] py-3 pl-3.5 pr-3.5"
                style={{ background: BLUE_SOFT, borderLeft: `2px solid ${BLUE}` }}
              >
                <p className="text-[16px] leading-[1.45]" style={{ color: INK }}>
                  “{data.action}”
                </p>
              </div>
              <p className="mt-4 text-[14.5px] leading-[1.5]" style={{ color: MUTED }}>
                “{data.tip}”
              </p>

              <div className="mt-9">
                <p className="text-[14px] font-semibold" style={{ color: INK }}>
                  Por que essa direção pode funcionar para você?
                </p>
                <p className="mt-1.5 text-[14.5px] leading-[1.55]" style={{ color: MUTED }}>
                  {data.why}
                </p>
              </div>

              <div className="mt-9">
                <Label>Quando fazer</Label>
                <p className="mt-1.5 text-[15px] leading-[1.5]" style={{ color: INK }}>
                  {data.when}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        <button
          type="button"
          disabled={!data || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="mt-12 w-full rounded-[14px] py-[15px] text-[15px] font-semibold text-white disabled:opacity-50"
          style={{ background: BLUE }}
        >
          {addMutation.isPending ? "Adicionando…" : "Adicionar à minha MAG Meta"}
        </button>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => setVariant((v) => v + 1)}
          className="mx-auto mt-4 flex items-center gap-1.5 text-[14px] disabled:opacity-50"
          style={{ color: MUTED }}
        >
          <RefreshCw className="h-[14px] w-[14px]" strokeWidth={1.8} />
          Adaptar de outra forma
        </button>
        {addMutation.isError ? (
          <p className="mt-4 text-center text-[13px]" style={{ color: "#B4483C" }}>
            Não consegui adicionar agora. Tente novamente.
          </p>
        ) : null}
      </main>
    </div>
  );
}