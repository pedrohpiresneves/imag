import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useAccess } from "@/lib/use-access";
import { Avatar } from "@/components/ShareDirectionModal";
import { Check, Archive, MessageCircle, Sparkles } from "lucide-react";
import {
  listPendingDirections,
  listSharedDirections,
  respondToDirection,
  type SharedDirection,
} from "@/lib/shared-directions.functions";

const INK = "#0A0A0A";
const MUTED = "#7B7F89";
const HAIRLINE = "#ECEBE5";
const BLUE_DARK = "#335CFF";
const BLUE = "#335CFF";
const easeOut = [0.22, 1, 0.36, 1] as const;

export const Route = createFileRoute("/_authenticated/direcoes")({
  head: () => ({
    meta: [
      { title: "Direções compartilhadas · iMAG" },
      {
        name: "description",
        content:
          "Direções que outras pessoas compartilharam com você na iMAG — execute, adapte ou arquive.",
      },
      { property: "og:title", content: "Direções compartilhadas · iMAG" },
      {
        property: "og:description",
        content: "Receba e execute direções compartilhadas por pessoas da sua rede iMAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DirecoesPage,
});

function firstName(d: SharedDirection) {
  const n = d.person?.full_name ?? d.person?.handle ?? "Alguém";
  return n.split(" ")[0];
}

function DirecoesPage() {
  const { userId } = useAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pendingFn = useServerFn(listPendingDirections);
  const acceptedFn = useServerFn(listSharedDirections);
  const respondFn = useServerFn(respondToDirection);

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-directions", userId],
    queryFn: () => pendingFn(),
    enabled: !!userId,
  });
  const { data: accepted = [] } = useQuery({
    queryKey: ["shared-directions", userId],
    queryFn: () => acceptedFn({ data: { include_archived: false } }),
    enabled: !!userId,
  });

  const respond = useMutation({
    mutationFn: (vars: { id: string; action: "accept" | "decline" | "archive" | "execute" }) =>
      respondFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-directions"] });
      queryClient.invalidateQueries({ queryKey: ["shared-directions"] });
      queryClient.invalidateQueries({ queryKey: ["shared-impact"] });
    },
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
          className="text-[27px] font-semibold tracking-[-0.035em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Direções compartilhadas
        </motion.h1>
        <p className="mt-1.5 text-[14px]" style={{ color: MUTED }}>
          Direções que fizeram sentido para alguém e podem fazer sentido para você.
        </p>

        {pending.length > 0 && (
          <section className="mt-8">
            <SectionLabel>Novas</SectionLabel>
            <div className="mt-3 flex flex-col gap-3">
              {pending.map((d) => (
                <DirectionCard
                  key={d.id}
                  d={d}
                  primary={{
                    label: "Receber esta MAG Meta",
                    onClick: () => respond.mutate({ id: d.id, action: "accept" }),
                  }}
                  secondary={{
                    label: "Talvez depois",
                    onClick: () => respond.mutate({ id: d.id, action: "decline" }),
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-9">
          <SectionLabel>Recebidas</SectionLabel>
          {accepted.length === 0 ? (
            <p
              className="mt-3 rounded-[20px] border px-4 py-6 text-center text-[13.5px]"
              style={{ borderColor: HAIRLINE, color: MUTED }}
            >
              Nenhuma direção recebida ainda.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {accepted.map((d) => (
                <DirectionCard
                  key={d.id}
                  d={d}
                  executed={!!d.executed_at}
                  primary={
                    d.executed_at
                      ? undefined
                      : {
                          label: "Executei esta direção",
                          onClick: () => respond.mutate({ id: d.id, action: "execute" }),
                        }
                  }
                  actions={[
                    {
                      label: "Conversar com a MAG",
                      icon: <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />,
                      onClick: () => navigate({ to: "/mentor" }),
                    },
                    {
                      label: "Arquivar",
                      icon: <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />,
                      onClick: () => respond.mutate({ id: d.id, action: "archive" }),
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase"
      style={{ color: BLUE_DARK, letterSpacing: "0.22em", fontFamily: "var(--font-mono)" }}
    >
      {children}
    </p>
  );
}

type Action = { label: string; onClick: () => void; icon?: React.ReactNode };

function DirectionCard({
  d,
  primary,
  secondary,
  actions,
  executed,
}: {
  d: SharedDirection;
  primary?: Action;
  secondary?: Action;
  actions?: Action[];
  executed?: boolean;
}) {
  const [showReason, setShowReason] = useState(false);
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="rounded-[22px] border p-5"
      style={{ borderColor: HAIRLINE, background: "#FFFFFF" }}
    >
      <div className="flex items-center gap-2.5">
        {d.person && <Avatar person={d.person} size={30} />}
        <p className="text-[13px]" style={{ color: MUTED }}>
          <span style={{ color: INK, fontWeight: 500 }}>{firstName(d)}</span> compartilhou uma MAG
          Meta com você.
        </p>
      </div>

      <p className="mt-3 text-[16px] leading-[1.5]" style={{ color: INK }}>
        {d.description}
      </p>

      {d.message && (
        <p className="mt-2.5 text-[13.5px] italic" style={{ color: MUTED }}>
          “{d.message}”
        </p>
      )}

      <p className="mt-3 text-[13px]" style={{ color: MUTED }}>
        {firstName(d)} acredita que essa direção também pode fazer sentido para você.
      </p>

      {d.reason && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowReason((v) => !v)}
            className="text-[12.5px] font-medium"
            style={{ color: BLUE_DARK }}
          >
            {showReason ? "Ocultar contexto" : "Por que essa meta?"}
          </button>
          {showReason && (
            <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: MUTED }}>
              {d.reason}
            </p>
          )}
        </div>
      )}

      {executed && (
        <p
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: BLUE }}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
          Executada — seu Campo Magnético foi fortalecido.
        </p>
      )}

      {(primary || secondary) && (
        <div className="mt-4 flex flex-col gap-2">
          {primary && (
            <button
              type="button"
              onClick={primary.onClick}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium text-white transition hover:opacity-90"
              style={{ background: BLUE }}
            >
              <Check className="h-4 w-4" strokeWidth={2} />
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="w-full rounded-full px-5 py-3 text-[13.5px] font-medium transition hover:bg-black/[0.03]"
              style={{ color: MUTED }}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition hover:border-[#335CFF]/40"
              style={{ borderColor: HAIRLINE, color: INK }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </motion.article>
  );
}