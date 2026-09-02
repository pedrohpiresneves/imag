import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, Target, UserPlus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MagAvatarMascot } from "@/components/mag/MagMascot";
import { InvitePanel } from "@/components/circles/InvitePanel";
import { ensureCircleDirection } from "@/lib/circle-direction.functions";
import {
  checkinCircleDirection,
  endCircle,
  getCircle,
  leaveCircle,
  updateCircleChallenge,
  type CircleDetail,
  type CircleMemberRow,
} from "@/lib/circles.functions";

const HAIR = "#E9EBEF";
const BLUE = "#335CFF";

export const Route = createFileRoute("/circulos/$id")({
  ssr: false,
  component: CirclePage,
  head: () => ({
    meta: [
      { title: "Círculo · iMAG" },
      {
        name: "description",
        content: "Progresso, sequência e ranking do seu círculo privado na iMAG.",
      },
      { property: "og:title", content: "Círculo · iMAG" },
      {
        property: "og:description",
        content: "Acompanhe o desafio do círculo e o avanço do grupo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function CirclePage() {
  const { id } = useParams({ from: "/circulos/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchCircle = useServerFn(getCircle);
  const doLeave = useServerFn(leaveCircle);
  const doEnd = useServerFn(endCircle);
  const doUpdate = useServerFn(updateCircleChallenge);
  const ensureDirection = useServerFn(ensureCircleDirection);
  const doCheckin = useServerFn(checkinCircleDirection);
  const [note, setNote] = useState("");
  const localDate = new Date().toLocaleDateString("en-CA");
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [challengeText, setChallengeText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["circle", id],
    queryFn: () => fetchCircle({ data: { id } }),
    refetchOnWindowFocus: true,
  });

  const leave = useMutation({
    mutationFn: () => doLeave({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-circles"] });
      navigate({ to: "/circulos" });
    },
  });

  const finish = useMutation({
    mutationFn: () => doEnd({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["circle", id] });
      void qc.invalidateQueries({ queryKey: ["my-circles"] });
    },
  });

  const saveChallenge = useMutation({
    mutationFn: (text: string) =>
      doUpdate({
        data: {
          id,
          challengeKind: (data as CircleDetail)?.circle.challengeKind as
            | "daily"
            | "streak"
            | "count"
            | "custom",
          challengeText: text,
          targetCount: (data as CircleDetail)?.circle.targetCount ?? null,
        },
      }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["circle", id] });
    },
  });

  const checkin = useMutation({
    mutationFn: () => doCheckin({ data: { id, local_date: localDate, note: note.trim() || undefined } }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["circle", id] });
      void qc.invalidateQueries({ queryKey: ["my-circles"] });
    },
  });

  const detail = data as CircleDetail | undefined;
  const ranking = detail?.ranking ?? [];
  const myPos = useMemo(() => ranking.findIndex((m) => m.isMe) + 1, [ranking]);

  const hasDirection = Boolean(detail?.today?.direction);
  const isActiveCircle = detail?.circle.status === "active";

  useEffect(() => {
    if (!detail?.ok || hasDirection || !isActiveCircle) return;
    let cancelled = false;
    void (async () => {
      await ensureDirection({ data: { id, local_date: localDate } });
      if (!cancelled) void qc.invalidateQueries({ queryKey: ["circle", id] });
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.ok, hasDirection, isActiveCircle, ensureDirection, id, localDate, qc]);

  const magLine = useMemo(() => {
    if (!detail?.ok) return null;
    const me = ranking.find((m) => m.isMe);
    if (!me) return null;
    if (myPos > 1) {
      const above = ranking[myPos - 2];
      const gap = above ? above.steps - me.steps : 0;
      if (gap > 0 && gap <= 3)
        return `Você está a ${gap} ${gap === 1 ? "passo" : "passos"} do topo.`;
    }
    if (me.streak > 0) return `Mais uma direção hoje mantém sua sequência de ${me.streak} dias.`;
    if ((detail.group?.steps ?? 0) > 0)
      return `O grupo já avançou ${detail.group.steps} passos.`;
    return "Comece pela sua direção de hoje.";
  }, [detail, ranking, myPos]);

  if (isLoading) {
    return (
      <Shell>
        <div className="mt-6 h-[120px] animate-pulse rounded-[20px] bg-neutral-100" />
        <div className="mt-3 h-[220px] animate-pulse rounded-[20px] bg-neutral-100" />
      </Shell>
    );
  }

  if (!detail?.ok) {
    return (
      <Shell>
        <p className="mt-10 text-center text-[14.5px] text-neutral-500">
          Este círculo não está disponível.
        </p>
      </Shell>
    );
  }

  const c = detail.circle;
  const today = detail.today ?? {
    date: localDate,
    direction: null,
    checkins: [],
    doneCount: 0,
    iDid: false,
  };

  const doneRatio = detail.group.members
    ? Math.round((today.doneCount / detail.group.members) * 100)
    : 0;

  return (
    <Shell>
      {/* Cabeçalho compacto */}
      <div className="pt-1">
        <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em]">{c.name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-500">
          <span>{c.durationDays} dias de foco</span>
          {c.focusLabel && (
            <>
              <Dot />
              <span className="inline-flex items-center gap-1">
                <Target className="h-[13px] w-[13px]" style={{ color: BLUE }} strokeWidth={2.2} />
                Foco: <span className="font-medium text-neutral-800">{c.focusLabel}</span>
              </span>
            </>
          )}
          <Dot />
          <span>
            {c.status === "active"
              ? `${c.daysLeft} ${c.daysLeft === 1 ? "dia restante" : "dias restantes"}`
              : "Finalizado"}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center">
            {ranking.slice(0, 6).map((m) => (
              <MiniAvatar key={m.userId} name={m.name} url={m.avatarUrl} />
            ))}
            {ranking.length > 6 && (
              <span className="ml-1.5 text-[11.5px] text-neutral-400">+{ranking.length - 6}</span>
            )}
          </div>
          <span className="truncate text-[12px] text-neutral-400">{c.challengeText}</span>
        </div>
      </div>

      {/* Direção coletiva + check-in unificados */}
      <section
        className="mt-4 rounded-[18px] p-4"
        style={{ background: "#EEF2FF", border: `1px solid #DCE4FF` }}
      >
        <div className="flex items-center gap-2">
          <MagAvatarMascot state="confident" size={22} />
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: BLUE }}
          >
            Direção da MAG de hoje
          </p>
        </div>
        <p className="mt-2 text-[15.5px] font-medium leading-[1.35] text-neutral-900">
          {today.direction ?? "A MAG está preparando a direção do círculo…"}
        </p>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${doneRatio}%`, background: BLUE }}
            />
          </div>
          <span className="shrink-0 text-[12px] text-neutral-500">
            {today.doneCount} de {detail.group.members} concluíram
          </span>
        </div>

        {today.direction && c.status === "active" && (
          today.iDid ? (
            <div className="mt-3 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: BLUE }}>
              <Check className="h-[15px] w-[15px]" strokeWidth={2.5} />
              Você concluiu hoje
            </div>
          ) : (
            <div className="mt-3">
              <input
                value={note}
                maxLength={240}
                onChange={(e) => setNote(e.target.value)}
                placeholder="O que você fez? (opcional)"
                className="w-full rounded-[12px] border bg-white px-3 py-2.5 text-[13.5px] outline-none placeholder:text-neutral-400"
                style={{ borderColor: "#DCE4FF" }}
              />
              <button
                type="button"
                disabled={checkin.isPending}
                onClick={() => checkin.mutate()}
                className="mt-2 min-h-[42px] w-full rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-60"
                style={{ background: BLUE }}
              >
                {checkin.isPending ? "Registrando…" : "Fiz minha parte hoje"}
              </button>
            </div>
          )
        )}

        {today.checkins.length > 0 && (
          <p className="mt-2.5 truncate text-[12px] text-neutral-500">
            {today.checkins.map((ck) => (ck.isMe ? "Você" : ck.name)).join(" · ")}
          </p>
        )}
      </section>

      {/* Progresso do grupo — linha compacta */}
      <p className="mt-3.5 px-1 text-[12.5px] text-neutral-500">
        {detail.group.consistency ?? 0}% constância <Dot /> {detail.group.members}{" "}
        {detail.group.members === 1 ? "membro" : "membros"} <Dot /> {detail.group.daysElapsed ?? 1}{" "}
        {detail.group.daysElapsed === 1 ? "dia juntos" : "dias juntos"}
      </p>

      {/* Meu progresso */}
      <section className="mt-3 rounded-[16px] border p-3.5" style={{ borderColor: HAIR }}>
        <div className="flex items-center justify-between">
          <MiniMetric value={detail.me.steps} label={detail.me.steps === 1 ? "direção" : "direções"} />
          <MiniMetric value={detail.me.streak} label="dias de sequência" />
          {myPos > 0 && <MiniMetric value={`${myPos}º`} label="no ranking" />}
        </div>
        {magLine && (
          <p className="mt-2.5 text-[12.5px] leading-[1.4] text-neutral-500">{magLine}</p>
        )}
      </section>

      {/* Ranking compacto */}
      <section className="mt-4">
        <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
          Ranking
        </p>
        <ul>
          {ranking.map((m: CircleMemberRow, i) => (
            <li key={m.userId} className="flex items-center gap-2.5 py-1.5">
              <span className="w-3.5 text-[12.5px] tabular-nums text-neutral-400">{i + 1}</span>
              <MiniAvatar name={m.name} url={m.avatarUrl} flush />
              <span
                className="min-w-0 flex-1 truncate text-[13.5px]"
                style={{ fontWeight: m.isMe ? 600 : 400, color: m.isMe ? BLUE : "#111111" }}
              >
                {m.name}
                {m.isMe ? " · você" : ""}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">{m.steps}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ações */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setInviting((v) => !v)}
          className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] border text-[13.5px] font-medium"
          style={{ borderColor: HAIR, color: BLUE }}
        >
          <UserPlus className="h-[16px] w-[16px]" />
          Convidar pessoas
        </button>
        {inviting && (
          <div className="mt-2 rounded-[16px] border p-4" style={{ borderColor: HAIR }}>
            <InvitePanel circleId={c.id} inviteCode={c.inviteCode} circleName={c.name} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-4 text-[12.5px] text-neutral-400">
          {c.isAdmin && c.status === "active" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setChallengeText(c.challengeText);
                  setEditing(true);
                }}
              >
                Editar círculo
              </button>
              <Dot />
              <button type="button" onClick={() => finish.mutate()}>
                Encerrar círculo
              </button>
              <Dot />
            </>
          )}
          <button type="button" onClick={() => leave.mutate()} style={{ color: "#C0453B" }}>
            Sair
          </button>
        </div>

        {editing && (
          <div className="mt-3 rounded-[14px] border p-3" style={{ borderColor: HAIR }}>
            <input
              autoFocus
              defaultValue={c.challengeText}
              maxLength={200}
              onChange={(e) => setChallengeText(e.target.value)}
              className="w-full rounded-[10px] border px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: HAIR }}
            />
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => saveChallenge.mutate(challengeText || c.challengeText)}
                className="rounded-full px-4 py-1.5 text-[12.5px] font-medium text-white"
                style={{ background: BLUE }}
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full border px-4 py-1.5 text-[12.5px] font-medium text-neutral-600"
                style={{ borderColor: HAIR }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Dot() {
  return <span className="text-neutral-300">·</span>;
}

function MiniAvatar({
  name,
  url,
  flush = false,
}: {
  name: string;
  url: string | null;
  flush?: boolean;
}) {
  const initials = (name || "•")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className={`inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-medium text-neutral-500 ${
        flush ? "" : "-ml-1.5 first:ml-0"
      }`}
      style={{ background: "#F2F3F5", boxShadow: flush ? undefined : "0 0 0 2px #FFFFFF" }}
    >
      {url && /^https?:\/\//.test(url) ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function MiniMetric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[19px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      <p className="mt-1 truncate text-[11.5px] text-neutral-500">{label}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] items-center gap-1 px-6 py-4">
          <Link
            to="/circulos"
            className="-ml-2 inline-flex items-center gap-1 text-[14.5px] font-medium text-neutral-500"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
            Círculos
          </Link>
        </div>
      </header>
      <main
        className="mx-auto max-w-[560px] px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
