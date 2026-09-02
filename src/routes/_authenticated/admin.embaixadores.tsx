import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import {
  addAmbassadorEmail,
  listAmbassadorEmails,
  removeAmbassadorEmail,
} from "@/lib/ambassadors.functions";

export const Route = createFileRoute("/_authenticated/admin/embaixadores")({
  component: AdminAmbassadors,
  head: () => ({
    meta: [
      { title: "Embaixadores iMAG · Administração" },
      {
        name: "description",
        content:
          "Gerencie os e-mails autorizados como Embaixadores iMAG com acesso completo à plataforma.",
      },
      { property: "og:title", content: "Embaixadores iMAG · Administração" },
      {
        property: "og:description",
        content: "Lista de contas com acesso completo como Embaixador iMAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const BLUE = "#335CFF";
const HAIR = "rgba(0,0,0,0.07)";

function AdminAmbassadors() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const list = useQuery({
    queryKey: ["admin-ambassadors"],
    queryFn: () => listAmbassadorEmails(),
  });

  const add = useMutation({
    mutationFn: () => addAmbassadorEmail({ data: { email, note: note || undefined } }),
    onSuccess: () => {
      setEmail("");
      setNote("");
      toast.success("Embaixador adicionado");
      qc.invalidateQueries({ queryKey: ["admin-ambassadors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (e: string) => removeAmbassadorEmail({ data: { email: e } }),
    onSuccess: () => {
      toast.success("Embaixador removido");
      qc.invalidateQueries({ queryKey: ["admin-ambassadors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <AppHeader />
      <main
        className="mx-auto max-w-[560px] px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
      >
        <div className="pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            Administração
          </p>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Embaixadores iMAG
          </h1>
          <p className="mt-2 text-[14.5px] text-neutral-500">
            E-mails autorizados com acesso completo, sem período gratuito e sem assinatura.
          </p>
        </div>

        <form
          className="mt-7 rounded-[18px] border p-4"
          style={{ borderColor: HAIR }}
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!email.trim()) return;
            add.mutate();
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="email@dominio.com"
            maxLength={255}
            className="w-full rounded-[12px] border px-3 py-2.5 text-[15px] outline-none focus:border-neutral-300"
            style={{ borderColor: HAIR }}
          />
          <input
            type="text"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="Observação (opcional)"
            maxLength={160}
            className="mt-2 w-full rounded-[12px] border px-3 py-2.5 text-[15px] outline-none focus:border-neutral-300"
            style={{ borderColor: HAIR }}
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="mt-3 w-full rounded-[12px] py-2.5 text-[14.5px] font-semibold text-white disabled:opacity-50"
            style={{ background: BLUE }}
          >
            {add.isPending ? "Adicionando…" : "Adicionar embaixador"}
          </button>
        </form>

        <div className="mt-8">
          {list.isPending ? (
            <p className="text-[14px] text-neutral-400">Carregando…</p>
          ) : list.isError ? (
            <p className="text-[14px] text-neutral-400">Acesso restrito a administradores.</p>
          ) : (list.data ?? []).length === 0 ? (
            <p className="text-[14px] text-neutral-400">Nenhum embaixador cadastrado.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: HAIR }}>
              {(list.data ?? []).map((row) => (
                <li key={row.email} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium tracking-[-0.01em]">
                      {row.full_name || row.email}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                      {row.full_name ? `${row.email} · ` : ""}
                      {row.registered ? "Conta ativa" : "Aguardando cadastro"}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => remove.mutate(row.email)}
                    disabled={remove.isPending}
                    className="shrink-0 text-[13.5px] font-medium text-neutral-400 hover:text-neutral-900"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}