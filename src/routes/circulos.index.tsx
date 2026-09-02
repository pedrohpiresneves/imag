import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { CreateCircleFlow } from "@/components/circles/CreateCircleFlow";
import {
  listMyCircles,
  respondInvite,
  joinCircle,
  type CircleSummary,
} from "@/lib/circles.functions";

const HAIR = "#E9EBEF";
const BLUE = "#335CFF";
const MUTED = "#6B6B70";

export const Route = createFileRoute("/circulos/")({
  ssr: false,
  component: CirclesPage,
  head: () => ({
    meta: [
      { title: "Círculos · iMAG" },
      {
        name: "description",
        content:
          "Crie círculos privados e avance em metas junto com amigos, colegas ou equipe.",
      },
      { property: "og:title", content: "Círculos · iMAG" },
      {
        property: "og:description",
        content: "Grupos privados para manter consistência e avançar em metas na iMAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function CirclesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const fetchList = useServerFn(listMyCircles);
  const answer = useServerFn(respondInvite);
  const join = useServerFn(joinCircle);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-circles"],
    queryFn: () => fetchList(),
  });

  const respond = useMutation({
    mutationFn: (v: { inviteId: string; accept: boolean }) => answer({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-circles"] }),
  });

  /* Convite por link: /circulos?convite=codigo */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("convite");
    if (!code) return;
    window.history.replaceState({}, "", "/circulos");
    void (async () => {
      const r = await join({ data: { code } });
      await qc.invalidateQueries({ queryKey: ["my-circles"] });
      if (r?.ok && r.id) navigate({ to: "/circulos/$id", params: { id: r.id } });
    })();
  }, [join, navigate, qc]);

  const circles = data?.circles ?? [];
  const invites = data?.invites ?? [];
  const active = circles.filter((c) => c.status === "active");
  const finished = circles.filter((c) => c.status !== "active");

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PageHeader title="Círculos" maxWidth={560} />


      <main
        className="mx-auto max-w-[560px] px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 140px)" }}
      >
        <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.03em]">
          Círculos
        </h1>
        <p className="mt-1.5 text-[14px] font-light" style={{ color: MUTED }}>
          Pessoas com o mesmo foco. Evoluindo juntas.
        </p>

        {invites.length > 0 && (
          <>
            <SectionLabel>Convites</SectionLabel>
            <div className="space-y-2.5">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: HAIR }}
                >
                  <p className="text-[15.5px] font-semibold tracking-[-0.01em]">
                    {inv.circleName}
                  </p>
                  <p className="mt-0.5 text-[13px]" style={{ color: MUTED }}>
                    Convite de {inv.from} · {inv.challengeText}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ inviteId: inv.id, accept: true })}
                      className="flex-1 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-white disabled:opacity-60"
                      style={{ background: BLUE }}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ inviteId: inv.id, accept: false })}
                      className="rounded-full border px-4 py-2.5 text-[13.5px] font-medium text-neutral-600"
                      style={{ borderColor: HAIR }}
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionLabel>Meus círculos</SectionLabel>
        {isLoading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-[132px] animate-pulse rounded-[20px] bg-neutral-100" />
            ))}
          </div>
        ) : circles.length === 0 ? (
          <div
            className="rounded-[20px] border px-5 py-7 text-center"
            style={{ borderColor: HAIR }}
          >
            <p className="text-[14.5px] font-medium">Você ainda não tem círculos</p>
            <p className="mt-1 text-[13px] font-light" style={{ color: MUTED }}>
              Crie um círculo, escolha um foco em comum e recebam a mesma direção da MAG
              todos os dias.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...active, ...finished].map((c) => (
              <CircleCard key={c.id} c={c} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border bg-white text-[14.5px] font-medium transition active:opacity-70"
          style={{ borderColor: BLUE, color: BLUE }}
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2} />
          Criar novo círculo
        </button>

        <p className="mt-3 text-center text-[12.5px] font-light" style={{ color: "#9A9AA0" }}>
          Uma direção da MAG por dia para todo o círculo.
        </p>
      </main>

      <BottomNav />

      {creating && (
        <CreateCircleFlow
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ["my-circles"] });
            navigate({ to: "/circulos/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

const AVATAR_TONES = ["#DCE5FF", "#DFF3E4", "#F2E6FF", "#FFE9DC", "#E4EEF5"];

function Avatars({ initials }: { initials: string[] }) {
  const shown = initials.slice(0, 4);
  return (
    <span className="flex items-center">
      {shown.map((ini, i) => (
        <span
          key={`${ini}-${i}`}
          className="grid h-[26px] w-[26px] place-items-center rounded-full text-[11.5px] font-semibold text-neutral-700 ring-2 ring-white"
          style={{
            background: AVATAR_TONES[i % AVATAR_TONES.length],
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          {ini}
        </span>
      ))}
    </span>
  );
}

/** Card do círculo: foco em comum, direção coletiva da MAG e progresso do grupo. */
function CircleCard({ c }: { c: CircleSummary }) {
  const isActive = c.status === "active";
  const total = Math.max(1, c.totalDays ?? c.daysLeft);
  const done = Math.max(0, Math.min(total, total - c.daysLeft));
  const pct = Math.round((done / total) * 100);
  const initials =
    c.initials && c.initials.length > 0
      ? c.initials
      : Array.from({ length: Math.max(1, c.members) }).map(() => "M");

  return (
    <Link
      to="/circulos/$id"
      params={{ id: c.id }}
      className="block rounded-[20px] border px-4 py-4 transition active:opacity-80"
      style={{ borderColor: HAIR }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold tracking-[-0.02em]">{c.name}</p>
          {c.focusLabel && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px]" style={{ color: MUTED }}>
              <Target className="h-[13px] w-[13px]" style={{ color: BLUE }} strokeWidth={2} />
              Foco do círculo: <span className="font-medium text-neutral-800">{c.focusLabel}</span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-2.5">
            <Avatars initials={initials} />
            <span
              className="flex items-center gap-1.5 text-[13px] font-light"
              style={{ color: MUTED }}
            >
              {c.members} {c.members === 1 ? "membro" : "membros"} ·
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: isActive ? "#23B26D" : "#C4C4C9" }}
              />
              {isActive ? "Em andamento" : "Finalizado"}
            </span>
          </div>
        </div>
        <ChevronRight className="mt-1 h-[18px] w-[18px] shrink-0 text-neutral-300" />
      </div>

      {isActive && (
        <div className="mt-3 rounded-[14px] px-3.5 py-3" style={{ background: "#EEF2FF" }}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: BLUE }}
          >
            Direção da MAG de hoje
          </p>
          <p className="mt-1 text-[14px] leading-[1.35] text-neutral-800">
            {c.todayDirection
              ? `“${c.todayDirection}”`
              : "A MAG envia a direção do grupo ao abrir o círculo."}
          </p>
        </div>
      )}

      <p className="mt-3.5 text-[16px] font-semibold tracking-[-0.02em]">
        {done} de {total} dias
      </p>
      <div
        className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: "#EDEEF1" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: BLUE }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-light" style={{ color: MUTED }}>
          {isActive
            ? `${c.daysLeft} ${c.daysLeft === 1 ? "dia restante" : "dias restantes"}`
            : "Desafio encerrado"}
        </span>
        <span className="text-[13px] font-medium" style={{ color: BLUE }}>
          +20 magnetos
        </span>
      </div>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
      {children}
    </p>
  );
}
