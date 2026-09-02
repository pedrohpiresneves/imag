import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Lock } from "lucide-react";
import { getAntennaState } from "@/lib/antenna.functions";
import { ANTENNA_LEVELS, levelForMagnetos } from "@/lib/antenna";

export const Route = createFileRoute("/_authenticated/antenas")({
  head: () => ({
    meta: [
      { title: "Antenas · iMAG" },
      { name: "description", content: "Seus níveis na iMAG: cada antena representa a força do seu sinal." },
      { property: "og:title", content: "Antenas · iMAG" },
      { property: "og:description", content: "Seus níveis na iMAG: cada antena representa a força do seu sinal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AntenasPage,
});

const MUTED = "#6B6B70";
const HAIR = "#ECEDF0";

function AntenasPage() {
  const router = useRouter();
  const fetchState = useServerFn(getAntennaState);
  const { data } = useQuery({
    queryKey: ["antenna-state"],
    queryFn: () => fetchState({}),
    staleTime: 30_000,
    retry: false,
  });

  const total = data?.total ?? 0;
  const current = levelForMagnetos(total);

  return (
    <div
      className="min-h-screen fade-rise"
      style={{ background: "#FFFFFF", color: "#111111", fontFamily: "var(--font-sans)" }}
    >
      <header className="mx-auto flex max-w-[520px] items-center gap-3 px-6 pt-6">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Voltar"
          className="-ml-1 grid h-8 w-8 place-items-center rounded-full transition active:opacity-60"
        >
          <ChevronLeft className="h-[19px] w-[19px]" strokeWidth={1.9} />
        </button>
        <h1 className="text-[17px] font-semibold" style={{ letterSpacing: "-0.02em" }}>
          Antenas
        </h1>
      </header>

      <main className="mx-auto max-w-[520px] px-6 pb-24 pt-6">
        <p className="text-[22px] font-semibold" style={{ letterSpacing: "-0.03em" }}>
          {current.name}
        </p>
        <p className="mt-1 text-[13.5px] font-light" style={{ color: MUTED }}>
          {total.toLocaleString("pt-BR")} Magnetos · seu sinal está ficando mais forte.
        </p>

        <ul className="mt-7">
          {ANTENNA_LEVELS.map((l) => {
            const unlocked = total >= l.threshold;
            return (
              <li
                key={l.key}
                className="flex items-center gap-3.5 py-3.5"
                style={{ borderTop: `1px solid ${HAIR}` }}
              >
                <span
                  className="h-[14px] w-[14px] shrink-0 rounded-full"
                  style={{
                    background: unlocked ? l.fill : "#E7E8EC",
                    boxShadow: unlocked
                      ? `0 0 12px ${l.glow}${l.ring ? `, 0 0 0 1px ${l.ring}` : ""}`
                      : "none",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[15px] font-medium"
                    style={{ letterSpacing: "-0.02em", color: unlocked ? "#111111" : "#A6A6AC" }}
                  >
                    {l.name}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-light" style={{ color: MUTED }}>
                    {unlocked
                      ? l.key === current.key
                        ? "Antena atual"
                        : "Desbloqueada"
                      : `${(l.threshold - total).toLocaleString("pt-BR")} Magnetos para desbloquear`}
                  </span>
                </span>
                {!unlocked && (
                  <Lock className="h-[14px] w-[14px] shrink-0" strokeWidth={1.8} style={{ color: "#C4C4CA" }} />
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
