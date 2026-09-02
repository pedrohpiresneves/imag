import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailDns } from "@/lib/dns-check.functions";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [
      { title: "Status do pagamento — Agenda Magnética" },
      {
        name: "description",
        content:
          "Acompanhe o status do checkout, das compras e da verificação da conta Stripe (sandbox e LIVE).",
      },
    ],
  }),
  component: StatusPage,
});

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function environmentFromToken(): "sandbox" | "live" | "unconfigured" {
  if (clientToken?.startsWith("pk_live_")) return "live";
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  return "unconfigured";
}

function StatusPage() {
  const { user } = Route.useRouteContext() as { user: { id: string; email: string } };
  const env = environmentFromToken();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase-status", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("status, amount_cents, paid_at, stripe_session_id, created_at")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const goLiveSteps: Array<{ label: string; status: "done" | "action" | "waiting" }> = [
    { label: "Conta Stripe conectada ao sandbox", status: "done" },
    { label: "Formulário de go-live concluído", status: "done" },
    { label: "Instalar app da Lovable na conta LIVE", status: "action" },
    { label: "Provisionar chaves LIVE (automático)", status: "waiting" },
    { label: "Verificação final (automática)", status: "waiting" },
  ];

  const dnsQuery = useQuery({
    queryKey: ["email-dns-check"],
    queryFn: () => checkEmailDns(),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[420px] px-6 py-10 sm:max-w-[560px] sm:px-10 sm:py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Painel · Pagamentos
        </p>
        <h1 className="mt-3 font-serif text-3xl italic">Status</h1>
        <p className="mt-2 max-w-[46ch] text-sm text-muted-foreground">
          Acompanhe seu checkout, o histórico da sua compra e a verificação da conta
          Stripe para receber pagamentos reais.
        </p>

        {/* Ambiente atual */}
        <section className="mt-10 border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Ambiente ativo
          </p>
          <div className="mt-3 flex items-center justify-between">
            <h2 className="font-serif text-xl italic">
              {env === "live"
                ? "LIVE (pagamentos reais)"
                : env === "sandbox"
                  ? "Sandbox (teste)"
                  : "Não configurado"}
            </h2>
            <span
              className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                env === "live"
                  ? "bg-foreground text-background"
                  : env === "sandbox"
                    ? "border border-foreground"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {env}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {env === "live"
              ? "Os pagamentos processados aqui são reais e serão liquidados na sua conta bancária."
              : env === "sandbox"
                ? "Use o cartão 4242 4242 4242 4242 com validade futura e CVC qualquer para testar o fluxo."
                : "Conclua o go-live do Stripe para habilitar cobranças reais."}
          </p>
        </section>

        {/* Minha compra */}
        <section className="mt-8 border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Sua compra
          </p>
          {isLoading ? (
            <p className="mt-3 font-serif italic text-muted-foreground">Carregando…</p>
          ) : !purchase ? (
            <div className="mt-3">
              <h2 className="font-serif text-xl italic">Nenhum checkout iniciado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Você ainda não abriu o checkout desta conta.
              </p>
              <Link
                to="/checkout"
                className="mt-5 inline-block border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-[0.2em]"
              >
                Abrir checkout →
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl italic">
                  {purchase.status === "paid"
                    ? "Acesso liberado"
                    : "Pagamento pendente"}
                </h2>
                <span
                  className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                    purchase.status === "paid"
                      ? "bg-foreground text-background"
                      : "border border-foreground"
                  }`}
                >
                  {purchase.status}
                </span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-[11px]">
                <dt className="text-muted-foreground">Valor</dt>
                <dd>R$ {(purchase.amount_cents / 100).toFixed(2)}</dd>
                <dt className="text-muted-foreground">Iniciado</dt>
                <dd>{new Date(purchase.created_at).toLocaleString("pt-BR")}</dd>
                {purchase.paid_at && (
                  <>
                    <dt className="text-muted-foreground">Pago em</dt>
                    <dd>{new Date(purchase.paid_at).toLocaleString("pt-BR")}</dd>
                  </>
                )}
                {purchase.stripe_session_id && (
                  <>
                    <dt className="text-muted-foreground">Sessão</dt>
                    <dd className="truncate">{purchase.stripe_session_id.slice(0, 24)}…</dd>
                  </>
                )}
              </dl>
              {purchase.status !== "paid" && (
                <Link
                  to="/checkout"
                  className="inline-block border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  Retomar checkout →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Go-live Stripe */}
        <section className="mt-8 border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Verificação da conta Stripe (LIVE)
          </p>
          <h2 className="mt-3 font-serif text-xl italic">Passos do go-live</h2>
          <ol className="mt-4 space-y-3">
            {goLiveSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] ${
                    step.status === "done"
                      ? "border-foreground bg-foreground text-background"
                      : step.status === "action"
                        ? "border-foreground"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {step.status === "done" ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{step.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {step.status === "done"
                      ? "Concluído"
                      : step.status === "action"
                        ? "Ação necessária"
                        : "Automático"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted-foreground">
            Abra o painel de pagamentos para concluir a instalação do app na sua conta
            LIVE. Depois disso, as chaves LIVE são provisionadas automaticamente.
          </p>
          <a
            href="https://dashboard.stripe.com/settings/account"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block bg-foreground px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-background"
          >
            Abrir painel do Stripe →
          </a>
        </section>

        {/* DNS de e-mail */}
        <section className="mt-8 border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            DNS do domínio de e-mail
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl italic">notify.agendamagnetica.net.br</h2>
            {dnsQuery.data && (
              <span
                className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                  dnsQuery.data.allNsOk && dnsQuery.data.allTxtOk
                    ? "bg-foreground text-background"
                    : "border border-foreground"
                }`}
              >
                {dnsQuery.data.allNsOk && dnsQuery.data.allTxtOk ? "propagado" : "pendente"}
              </span>
            )}
          </div>

          {dnsQuery.isLoading && !dnsQuery.data ? (
            <p className="mt-3 font-serif italic text-muted-foreground">Consultando resolvers…</p>
          ) : dnsQuery.error ? (
            <p className="mt-3 text-sm text-red-700">Falha ao consultar DNS.</p>
          ) : dnsQuery.data ? (
            <div className="mt-4 space-y-4">
              {dnsQuery.data.results.map((r) => (
                <div key={r.resolver} className="border border-border p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Resolver · {r.resolver}
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px]">
                    <li className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-block h-3 w-3 border ${r.nsOk ? "bg-foreground border-foreground" : "border-foreground"}`}
                      />
                      <span>
                        NS: {r.ns.length ? r.ns.join(", ") : "— sem resposta —"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-block h-3 w-3 border ${r.txtOk ? "bg-foreground border-foreground" : "border-foreground"}`}
                      />
                      <span className="break-all">
                        TXT: {r.txt.length ? r.txt.join(", ") : "— sem resposta —"}
                      </span>
                    </li>
                  </ul>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Atualizado {new Date(dnsQuery.data.checkedAt).toLocaleTimeString("pt-BR")} · recheca a cada 60s
                </p>
                <button
                  onClick={() => dnsQuery.refetch()}
                  disabled={dnsQuery.isFetching}
                  className="border-b border-foreground pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] disabled:opacity-50"
                >
                  {dnsQuery.isFetching ? "verificando…" : "verificar agora"}
                </button>
              </div>
              {!(dnsQuery.data.allNsOk && dnsQuery.data.allTxtOk) && (
                <div className="border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-mono text-[10px] uppercase tracking-widest">Registros esperados</p>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] break-all">
                    <li>NS notify → ns5.lovable.cloud</li>
                    <li>NS notify → ns6.lovable.cloud</li>
                    <li>TXT _lovable-email → {dnsQuery.data.expected.txtValue}</li>
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <Link
          to="/app"
          className="mt-10 inline-block font-mono text-[10px] uppercase tracking-[0.2em] underline underline-offset-4"
        >
          ← Voltar ao painel
        </Link>
      </main>
    </div>
  );
}