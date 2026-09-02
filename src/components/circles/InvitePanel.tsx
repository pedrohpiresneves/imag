import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Search, Share2 } from "lucide-react";
import { searchImagPeople, type ImagPerson } from "@/lib/shared-directions.functions";
import { inviteToCircle } from "@/lib/circles.functions";

const HAIR = "#E9EBEF";
const BLUE = "#335CFF";

export function inviteLink(code: string) {
  const origin = typeof window === "undefined" ? "https://imag.net.br" : window.location.origin;
  return `${origin}/circulos?convite=${code}`;
}

/** Convidar pessoas: busca na iMAG + link de convite compartilhável. */
export function InvitePanel({
  circleId,
  inviteCode,
  circleName,
}: {
  circleId: string;
  inviteCode: string;
  circleName: string;
}) {
  const search = useServerFn(searchImagPeople);
  const invite = useServerFn(inviteToCircle);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 260);
    return () => clearTimeout(t);
  }, [q]);

  const { data: people = [] } = useQuery({
    queryKey: ["circle-people", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length >= 2,
  });

  const sendInvite = useMutation({
    mutationFn: (userId: string) => invite({ data: { circleId, userIds: [userId] } }),
    onSuccess: (_r, userId) => setSent((s) => [...s, userId]),
  });

  const link = inviteLink(inviteCode);

  async function share() {
    const text = `Entre no círculo "${circleName}" na iMAG`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: circleName, text, url: link });
        return;
      } catch {
        /* cancelado */
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5"
        style={{ borderColor: HAIR }}
      >
        <Search className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pessoas na iMAG"
          className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-neutral-400"
        />
      </div>

      {debounced.length >= 2 && (
        <div className="mt-2 space-y-1">
          {people.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-neutral-400">Ninguém encontrado.</p>
          ) : (
            people.map((p: ImagPerson) => {
              const done = sent.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-[14px] px-1 py-2">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[12px] font-semibold"
                    style={{ background: "rgba(51,92,255,0.08)", color: BLUE }}
                  >
                    {(p.full_name ?? p.handle ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">
                      {p.full_name ?? p.handle}
                    </span>
                    {p.handle && (
                      <span className="block truncate text-[12px] text-neutral-400">
                        @{p.handle}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={done || sendInvite.isPending}
                    onClick={() => sendInvite.mutate(p.id)}
                    className="shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-60"
                    style={{
                      borderColor: done ? "transparent" : HAIR,
                      color: done ? BLUE : "#111111",
                      background: done ? "rgba(51,92,255,0.08)" : "transparent",
                    }}
                  >
                    {done ? "Convidado" : "Convidar"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-white"
          style={{ background: BLUE }}
        >
          <Share2 className="h-4 w-4" />
          Compartilhar convite
        </button>
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-medium text-neutral-700"
          style={{ borderColor: HAIR }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
