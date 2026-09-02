import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { deleteNote, listNotes, upsertNote } from "@/lib/workspace.functions";
import { PaywallLock } from "@/components/PaywallLock";

export const Route = createFileRoute("/_authenticated/notas")({
  component: Notes,
});

function Notes() {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: () => listNotes() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const active = notes.find((n) => n.id === activeId);

  useEffect(() => {
    if (active) {
      setTitle(active.title);
      setBody(active.body);
    } else {
      setTitle("");
      setBody("");
    }
  }, [activeId, active]);

  const save = useMutation({
    mutationFn: () => upsertNote({ data: { id: activeId ?? undefined, title, body } }),
    onSuccess: (r) => {
      setActiveId(r.id);
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteNote({ data: { id } }),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto grid max-w-[1180px] grid-cols-1 gap-px border-x border-border bg-border sm:grid-cols-[280px_1fr]">
        <aside className="bg-background p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Notas</p>
            <button
              onClick={() => setActiveId(null)}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              + Nova
            </button>
          </div>
          <ul className="mt-6 space-y-1">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setActiveId(n.id)}
                  className={`w-full truncate p-2 text-left text-sm ${activeId === n.id ? "bg-muted" : ""}`}
                >
                  {n.title || "(sem título)"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <PaywallLock label="Crie e salve notas após liberar seu acesso.">
        <section className="min-h-[70vh] bg-background p-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da nota"
            className="w-full bg-transparent font-serif text-3xl italic outline-none placeholder:text-muted-foreground"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva sua nota…"
            rows={16}
            className="mt-6 w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-foreground px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-background disabled:opacity-40"
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </button>
            {activeId && (
              <button
                onClick={() => confirm("Apagar esta nota?") && del.mutate(activeId)}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Apagar
              </button>
            )}
          </div>
        </section>
        </PaywallLock>
      </main>
    </div>
  );
}