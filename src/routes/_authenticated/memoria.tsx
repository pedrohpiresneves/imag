import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import {
  clearMagMemory,
  deleteMagFact,
  getMagMemory,
  updateMagFact,
} from "@/lib/mag-memory.functions";

export const Route = createFileRoute("/_authenticated/memoria")({
  head: () => ({
    meta: [
      { title: "O que a MAG aprendeu sobre você · iMAG" },
      {
        name: "description",
        content:
          "Veja, corrija ou remova o que a MAG aprendeu observando o seu uso diário da iMAG.",
      },
      { property: "og:title", content: "O que a MAG aprendeu sobre você · iMAG" },
      {
        property: "og:description",
        content: "Memória da MAG: visualize, corrija ou apague o que ela aprendeu com você.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MemoriaPage,
});

const BLUE = "#335CFF";
const MUTED = "#6B6B70";
const HAIR = "#ECEDF0";

const CATEGORY_LABEL: Record<string, string> = {
  ritmo: "Ritmo",
  execucao: "Execução",
  preferencia: "Preferências",
  contexto: "Contexto",
  padrao: "Padrões",
};

function MemoriaPage() {
  const qc = useQueryClient();
  const load = useServerFn(getMagMemory);
  const update = useServerFn(updateMagFact);
  const remove = useServerFn(deleteMagFact);
  const clear = useServerFn(clearMagMemory);

  const { data, isLoading } = useQuery({ queryKey: ["mag-memory"], queryFn: () => load() });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mag-memory"] });
  const save = useMutation({
    mutationFn: (v: { id: string; value: string }) => update({ data: v }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });
  const clearAll = useMutation({ mutationFn: () => clear(), onSuccess: invalidate });

  const facts = data?.facts ?? [];
  const groups = facts.reduce<Record<string, typeof facts>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="min-h-dvh bg-white pb-28">
      <AppHeader />
      <main className="mx-auto w-full max-w-[560px] px-4 pt-4">
        <Link
          to="/perfil"
          className="inline-flex items-center gap-1 text-[13px]"
          style={{ color: MUTED }}
        >
          <ChevronLeft size={15} /> Perfil
        </Link>

        <h1 className="mt-3 text-[24px] font-semibold tracking-tight">
          O que a MAG aprendeu sobre você
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
          A MAG pergunta pouco, observa muito e aprende sempre. Tudo aqui vem do seu uso do
          app — você pode corrigir ou apagar quando quiser.
        </p>

        {isLoading ? (
          <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
            Carregando…
          </p>
        ) : facts.length === 0 ? (
          <p className="mt-8 text-[13.5px]" style={{ color: MUTED }}>
            Ainda não há nada aprendido. Conforme você usar a iMAG, a MAG vai entender seu
            ritmo, seus horários e suas preferências.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {Object.entries(groups).map(([cat, items]) => (
              <section key={cat}>
                <h2
                  className="text-[11.5px] font-semibold uppercase tracking-wide"
                  style={{ color: MUTED }}
                >
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <ul className="mt-2 space-y-2">
                  {items.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-[18px] border p-3"
                      style={{ borderColor: HAIR }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px]" style={{ color: MUTED }}>
                            {f.label}
                          </p>
                          {editing === f.id ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                autoFocus
                                className="min-w-0 flex-1 rounded-xl border px-2.5 py-1.5 text-[14px] outline-none"
                                style={{ borderColor: HAIR }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  draft.trim() && save.mutate({ id: f.id, value: draft.trim() })
                                }
                                className="rounded-full p-2 text-white"
                                style={{ background: BLUE }}
                                aria-label="Salvar"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <p className="mt-0.5 text-[14.5px] font-medium leading-snug">
                              {f.value}
                            </p>
                          )}
                          <p className="mt-1 text-[11.5px]" style={{ color: MUTED }}>
                            {f.source === "user"
                              ? "corrigido por você"
                              : f.source === "asked"
                                ? "você respondeu à MAG"
                                : `observado no uso · ${f.evidence_count} sinais`}
                          </p>
                        </div>
                        {editing !== f.id && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              aria-label="Corrigir"
                              onClick={() => {
                                setEditing(f.id);
                                setDraft(f.value);
                              }}
                              className="rounded-full p-2"
                              style={{ color: MUTED }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="Remover"
                              onClick={() => del.mutate(f.id)}
                              className="rounded-full p-2"
                              style={{ color: MUTED }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <button
              type="button"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
              className="w-full rounded-[18px] border py-3 text-[13.5px] font-medium"
              style={{ borderColor: HAIR, color: "#C0392B" }}
            >
              Apagar tudo o que a MAG aprendeu
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
