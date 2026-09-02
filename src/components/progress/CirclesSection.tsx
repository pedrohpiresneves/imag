import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { getActiveCircle, type ActiveCircleMember } from "@/lib/circles.functions";
import { QuickCircleSheet } from "@/components/circles/QuickCircleSheet";

const BLUE = "#335CFF";
const MUTED = "#6B6B70";

function initialsOf(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

function Avatar({ m }: { m: ActiveCircleMember }) {
  const [broken, setBroken] = useState(false);
  const src = m.avatarUrl && /^https?:\/\//.test(m.avatarUrl) && !broken ? m.avatarUrl : null;
  return (
    <span
      title={m.name}
      className="relative -ml-2.5 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[12.5px] font-medium first:ml-0"
      style={{ background: "#F2F3F5", color: "#111111", boxShadow: "0 0 0 2px #FFFFFF" }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initialsOf(m.name) || "•"
      )}
    </span>
  );
}

/** Círculos em linhas minimalistas, sem cards. */
export function CirclesSection({ className = "" }: { className?: string }) {
  const fetchActive = useServerFn(getActiveCircle);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["active-circle"],
    queryFn: () => fetchActive(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const members = data?.members ?? [];

  return (
    <section className={className}>
      <div className="flex items-center justify-between">
        <h2
          className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
          style={{ color: "#9A9AA0" }}
        >
          Círculos
        </h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="-mr-2 -my-1.5 px-2 py-1.5 text-[13px] font-medium transition active:opacity-60"
          style={{ color: MUTED }}
        >
          + Criar
        </button>
      </div>

      {!isLoading && data && (
        <Link
          to="/circulos/$id"
          params={{ id: data.id }}
          className="mt-4 flex items-center gap-4 transition active:opacity-70"
        >
          <span className="flex shrink-0 items-center">
            {members.slice(0, 3).map((m) => (
              <Avatar key={m.userId} m={m} />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[15px] font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              {data.name}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] font-light" style={{ color: MUTED }}>
              Hoje: {data.doneToday} de {data.memberCount} concluíram
            </span>
            <span
              className="mt-2 block h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: "#EDEEF1" }}
            >
              <span
                className="block h-full rounded-full transition-all"
                style={{ width: `${data.weekProgress}%`, background: BLUE }}
              />
            </span>
            <span className="mt-1.5 block text-[12px] font-light" style={{ color: MUTED }}>
              {data.weekProgress}% do desafio concluído · {data.daysLeft}{" "}
              {data.daysLeft === 1 ? "dia restante" : "dias restantes"}
            </span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} style={{ color: "#B7B7BD" }} />
        </Link>
      )}

      {!isLoading && !data && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-3 block w-full text-left text-[13px] font-light transition active:opacity-60"
          style={{ color: MUTED }}
        >
          Desafie seus amigos. Evoluam juntos. Concluam o desafio e ganhem Magnetos.
        </button>
      )}

      {creating && (
        <QuickCircleSheet
          onClose={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["active-circle"] });
          }}
          onCreated={(id) => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["active-circle"] });
            navigate({ to: "/circulos/$id", params: { id } });
          }}
        />
      )}
    </section>
  );
}
