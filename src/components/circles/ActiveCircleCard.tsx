import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { getActiveCircle, type ActiveCircleMember } from "@/lib/circles.functions";
import { QuickCircleSheet } from "./QuickCircleSheet";

const HAIR = "#ECECEF";
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
  const initial = initialsOf(m.name) || "•";
  const [broken, setBroken] = useState(false);
  const src = m.avatarUrl && /^https?:\/\//.test(m.avatarUrl) && !broken ? m.avatarUrl : null;
  return (
    <span
      title={m.name}
      className="relative -ml-1.5 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[11px] font-medium first:ml-0"
      style={{
        background: "#F2F3F5",
        color: MUTED,
        boxShadow: `0 0 0 2px #FFFFFF${m.doneToday ? `, 0 0 0 3.5px ${BLUE}` : ""}`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/** Recurso secundário: compromisso compartilhado, sem ranking nem competição. */
export function ActiveCircleCard({ className = "" }: { className?: string }) {
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

  if (isLoading) return null;

  const members = data?.members ?? [];

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ color: "#9A9AA0" }}
        >
          Círculos
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="-mr-2 -my-1.5 px-2 py-1.5 text-[12px] font-medium transition active:opacity-60"
          style={{ color: BLUE }}
        >
          + Criar
        </button>
      </div>

      {data ? (
        <Link
          to="/circulos/$id"
          params={{ id: data.id }}
          className="block rounded-[16px] px-4 py-4.5 transition active:opacity-80"
          style={{ background: "#FFFFFF", border: `1px solid ${HAIR}` }}
        >
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13.5px] font-medium"
                style={{ color: "#111111" }}
              >
                {data.name}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: MUTED }}>
                {data.doneToday} de {data.memberCount}{" "}
                {data.memberCount === 1 ? "participante concluiu" : "participantes concluíram"} a
                direção hoje
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: "#B7B7BD" }} />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="flex shrink-0 items-center">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.userId} m={m} />
              ))}
              {members.length > 5 && (
                <span className="ml-1.5 text-[11px]" style={{ color: MUTED }}>
                  +{members.length - 5}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block h-[4px] w-full overflow-hidden rounded-full"
                style={{ background: "#F0F1F4" }}
              >
                <span
                  className="block h-full rounded-full transition-all"
                  style={{ width: `${data.weekProgress}%`, background: BLUE }}
                />
              </span>
              <span className="mt-1.5 block text-[11px]" style={{ color: MUTED }}>
                Semana · {data.weekProgress}% · {data.daysLeft}{" "}
                {data.daysLeft === 1 ? "dia restante" : "dias restantes"}
              </span>
            </span>
          </div>
        </Link>
      ) : (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{ background: "#FFFFFF", border: `1px solid ${HAIR}` }}
        >
          <p className="text-[13.5px] font-medium" style={{ color: "#111111" }}>
            Avançar junto pode ser mais fácil.
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: MUTED }}>
            Crie um círculo e convide quem também quer manter a direção.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 inline-flex min-h-[38px] items-center rounded-[12px] px-3.5 text-[12.5px] font-medium transition active:opacity-70"
            style={{ border: `1px solid ${HAIR}`, color: BLUE }}
          >
            Criar círculo
          </button>
        </div>
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
    </div>
  );
}
