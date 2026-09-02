import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import {
  listRecentPayments,
  searchPayments,
  adminConfirmPayment,
  adminRecheckPayment,
  type AdminPaymentRow,
} from "@/lib/payments/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPayments,
});

type RowsQueryKey = ["admin", "payments", string];

function AdminPayments() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  const key: RowsQueryKey = ["admin", "payments", query];
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: key,
    queryFn: (): Promise<AdminPaymentRow[]> =>
      query ? searchPayments({ data: { query } }) : listRecentPayments(),
  });

  const recheck = useMutation({
    mutationFn: (paymentId: string) => adminRecheckPayment({ data: { paymentId } }),
    onSuccess: (r) => {
      if (r.ok && r.status === "paid") toast.success("Pagamento confirmado e acesso liberado.");
      else if (!r.ok && "error" in r && r.error) toast.error(r.error);
      else toast.info("Ainda pendente na InfinitePay.");
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: (paymentId: string) => adminConfirmPayment({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Acesso liberado.");
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(term.trim());
  }

  function clearSearch() {
    setTerm("");
    setQuery("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[980px] px-6 py-10 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">Admin</p>
        <h1 className="mt-2 font-serif text-3xl italic">Pagamentos</h1>
        <p className="mt-2 max-w-[62ch] font-serif italic text-muted-foreground">
          Pesquise por e-mail, order_nsu, id do pedido ou id do pagamento. Reverifique a
          transação diretamente na InfinitePay ou libere manualmente o acesso quando um
          webhook falhar.
        </p>

        <form onSubmit={submitSearch} className="mt-8 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e-mail, order_nsu ou id"
            className="flex-1 rounded-sm border border-hairline bg-surface-1 px-3 py-2 font-mono text-xs"
          />
          <button
            type="submit"
            className="rounded-sm bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground"
          >
            Buscar
          </button>
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-sm border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em]"
            >
              Limpar
            </button>
          )}
        </form>

        {(isLoading || isFetching) && (
          <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
        )}
        {error && (
          <p className="mt-6 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Acesso negado ou erro ao carregar.
          </p>
        )}
        {!isLoading && data && data.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
        )}

        <div className="mt-6 space-y-2">
          {data?.map((p) => (
            <div
              key={p.id}
              className="rounded-sm border border-hairline bg-surface-1 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm">{p.email || "— sem e-mail —"}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {p.provider} · {p.method} · R${(p.amount_cents / 100).toFixed(2)} ·{" "}
                    <span
                      className={
                        p.status === "paid"
                          ? "text-accent"
                          : p.status === "failed" || p.status === "cancelled"
                            ? "text-destructive"
                            : ""
                      }
                    >
                      {p.status}
                    </span>
                    {p.has_access && (
                      <span className="ml-2 text-accent">· acesso {p.access_type ?? "ok"}</span>
                    )}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground/70">
                    order_nsu: {p.order_nsu ?? "—"} · payment: {p.id}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    criado {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.paid_at && ` · pago ${new Date(p.paid_at).toLocaleString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-[180px]">
                  <button
                    onClick={() => recheck.mutate(p.id)}
                    disabled={p.status === "paid" || recheck.isPending}
                    className="rounded-sm border border-hairline px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition hover:border-accent disabled:opacity-40"
                  >
                    Reverificar
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Liberar acesso vitalício para ${p.email || p.id}?\n\nUse quando o cliente pagou mas o webhook falhou.`,
                        )
                      )
                        grant.mutate(p.id);
                    }}
                    disabled={grant.isPending || (p.status === "paid" && p.has_access)}
                    className="rounded-sm bg-accent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground disabled:opacity-40"
                  >
                    Liberar acesso
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}