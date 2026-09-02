import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  adminCommissionAction,
  adminExportCommissionsCsv,
  adminGetSettings,
  adminListAmbassadors,
  adminListCampaigns,
  adminListCommissions,
  adminListFraudFlags,
  adminListPayouts,
  adminMarkPayout,
  adminResolveFraud,
  adminRunRelease,
  adminSetAmbassadorStatus,
  adminUpdateSettings,
  adminUpsertCampaign,
} from "@/lib/referrals/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  component: AdminReferrals,
});

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Tab = "ambassadors" | "commissions" | "payouts" | "fraud" | "settings" | "campaigns";

function AdminReferrals() {
  const [tab, setTab] = useState<Tab>("ambassadors");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[1180px] px-6 py-10 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">Admin</p>
        <h1 className="mt-2 font-serif text-3xl italic">Círculo iMAG</h1>
        <div className="mt-6 flex flex-wrap gap-6 border-b border-hairline">
          {(
            [
              ["ambassadors", "Embaixadores"],
              ["commissions", "Comissões"],
              ["payouts", "Payouts"],
              ["fraud", "Fraude"],
              ["settings", "Configurações"],
              ["campaigns", "Campanhas"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`pb-3 font-mono text-[10px] uppercase tracking-[0.24em] ${
                tab === id ? "border-b-2 border-accent text-accent" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          {tab === "ambassadors" && <Ambassadors />}
          {tab === "commissions" && <Commissions />}
          {tab === "payouts" && <Payouts />}
          {tab === "fraud" && <Fraud />}
          {tab === "settings" && <Settings />}
          {tab === "campaigns" && <Campaigns />}
        </div>
      </main>
    </div>
  );
}

function Ambassadors() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "ambassadors"],
    queryFn: () => adminListAmbassadors(),
  });
  const setStatus = useMutation({
    mutationFn: (v: { userId: string; status: "active" | "blocked" | "pending_review" }) =>
      adminSetAmbassadorStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "ambassadors"] }),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-2">
        <tr>
          <Th>Código</Th><Th>Email</Th><Th>Status</Th><Th>Termos</Th><Th>{" "}</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((a) => (
          <tr key={a.user_id} className="border-t border-hairline">
            <td className="p-3 font-mono">{a.code}</td>
            <td className="p-3">{a.email}</td>
            <td className="p-3">{a.status}</td>
            <td className="p-3 text-muted-foreground">{a.terms_accepted_at ? "aceitos" : "—"}</td>
            <td className="p-3">
              <select
                value={a.status}
                onChange={(e) =>
                  setStatus.mutate({ userId: a.user_id, status: e.target.value as "active" | "blocked" | "pending_review" })
                }
                className="rounded-sm border border-hairline bg-background px-2 py-1 text-xs"
              >
                <option value="active">active</option>
                <option value="blocked">blocked</option>
                <option value="pending_review">pending_review</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Commissions() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin", "commissions"],
    queryFn: () => adminListCommissions(),
  });
  const action = useMutation({
    mutationFn: (v: { commissionId: string; action: "release" | "reverse" | "cancel"; reason?: string }) =>
      adminCommissionAction({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "commissions"] }),
  });
  const release = useMutation({
    mutationFn: () => adminRunRelease(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "commissions"] }),
  });
  async function exportCsv() {
    const csv = await adminExportCommissionsCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commissions-${Date.now()}.csv`;
    a.click();
  }
  return (
    <div>
      <div className="mb-4 flex gap-3">
        <button onClick={() => release.mutate()} className="rounded-sm border border-hairline px-4 py-2 text-xs">
          Liberar vencidas
        </button>
        <button onClick={exportCsv} className="rounded-sm border border-hairline px-4 py-2 text-xs">
          Exportar CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr><Th>Data</Th><Th>Embaixador</Th><Th>Valor</Th><Th>Status</Th><Th>Libera em</Th><Th>{" "}</Th></tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id} className="border-t border-hairline">
              <td className="p-3">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
              <td className="p-3 font-mono text-[10px]">{c.ambassador_user_id.slice(0, 8)}</td>
              <td className="p-3">{brl(c.amount_cents)}</td>
              <td className="p-3">{c.status}</td>
              <td className="p-3 text-muted-foreground">{new Date(c.release_at).toLocaleDateString("pt-BR")}</td>
              <td className="p-3">
                {c.status === "pending" && (
                  <button onClick={() => action.mutate({ commissionId: c.id, action: "release" })} className="mr-2 text-xs text-accent">liberar</button>
                )}
                {(c.status === "pending" || c.status === "available") && (
                  <button onClick={() => action.mutate({ commissionId: c.id, action: "reverse", reason: "manual" })} className="text-xs text-destructive">reverter</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Payouts() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin", "payouts"], queryFn: () => adminListPayouts() });
  const mark = useMutation({
    mutationFn: (v: { payoutId: string; status: "processing" | "paid" | "failed"; providerRef?: string }) =>
      adminMarkPayout({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payouts"] }),
  });
  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-2">
        <tr><Th>Data</Th><Th>Embaixador</Th><Th>Valor</Th><Th>Chave PIX</Th><Th>Status</Th><Th>{" "}</Th></tr>
      </thead>
      <tbody>
        {data.map((p) => (
          <tr key={p.id} className="border-t border-hairline">
            <td className="p-3">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
            <td className="p-3 font-mono text-[10px]">{p.ambassador_user_id.slice(0, 8)}</td>
            <td className="p-3">{brl(p.amount_cents)}</td>
            <td className="p-3 font-mono text-[10px]">{p.pix_key_snapshot}</td>
            <td className="p-3">{p.status}</td>
            <td className="p-3">
              {p.status !== "paid" && (
                <button
                  onClick={() => {
                    const ref = window.prompt("ID/comprovante do PIX?") ?? "";
                    mark.mutate({ payoutId: p.id, status: "paid", providerRef: ref });
                  }}
                  className="text-xs text-accent"
                >
                  marcar pago
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Fraud() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin", "fraud"], queryFn: () => adminListFraudFlags() });
  const resolve = useMutation({
    mutationFn: (v: { id: string; notes?: string }) => adminResolveFraud({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "fraud"] }),
  });
  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="font-serif italic text-muted-foreground">Nenhuma sinalização.</p>}
      {data.map((f) => (
        <div key={f.id} className="rounded-sm border border-hairline bg-surface-1 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest">{f.reason} · {f.severity}</p>
          <p className="mt-1 text-sm text-muted-foreground">{f.notes ?? "sem notas"}</p>
          {!f.resolved_at && (
            <button
              onClick={() => resolve.mutate({ id: f.id, notes: window.prompt("Nota:") ?? undefined })}
              className="mt-2 text-xs text-accent"
            >
              resolver
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "referral-settings"], queryFn: () => adminGetSettings() });
  const update = useMutation({
    mutationFn: (v: Parameters<typeof adminUpdateSettings>[0]["data"]) => adminUpdateSettings({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "referral-settings"] }),
  });
  if (!data) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        update.mutate({
          default_rate_bps: Number(f.get("rate")),
          guarantee_days: Number(f.get("guarantee")),
          cookie_days: Number(f.get("cookie")),
          min_payout_cents: Number(f.get("min")),
        });
      }}
    >
      <Field name="rate" label="Taxa padrão (bps — 2000 = 20%)" defaultValue={data.default_rate_bps} />
      <Field name="guarantee" label="Dias de garantia" defaultValue={data.guarantee_days} />
      <Field name="cookie" label="Dias do cookie de indicação" defaultValue={data.cookie_days} />
      <Field name="min" label="Valor mínimo de saque (centavos)" defaultValue={data.min_payout_cents} />
      <button className="rounded-sm bg-accent px-5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground">
        Salvar
      </button>
    </form>
  );
}

function Campaigns() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin", "campaigns"], queryFn: () => adminListCampaigns() });
  const upsert = useMutation({
    mutationFn: (v: Parameters<typeof adminUpsertCampaign>[0]["data"]) => adminUpsertCampaign({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });
  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-sm border border-hairline bg-surface-1 p-5 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          upsert.mutate({
            name: String(f.get("name")),
            rate_bps: Number(f.get("rate")),
            starts_at: new Date(String(f.get("starts"))).toISOString(),
            ends_at: new Date(String(f.get("ends"))).toISOString(),
            code: (f.get("code") as string) || undefined,
            active: true,
          });
          (e.currentTarget as HTMLFormElement).reset();
        }}
      >
        <input name="name" placeholder="Nome" required className="rounded-sm border border-hairline bg-background px-2 py-1 text-sm" />
        <input name="rate" type="number" placeholder="bps" required className="rounded-sm border border-hairline bg-background px-2 py-1 text-sm" />
        <input name="starts" type="datetime-local" required className="rounded-sm border border-hairline bg-background px-2 py-1 text-sm" />
        <input name="ends" type="datetime-local" required className="rounded-sm border border-hairline bg-background px-2 py-1 text-sm" />
        <input name="code" placeholder="Código (opcional)" className="rounded-sm border border-hairline bg-background px-2 py-1 text-sm" />
        <button className="md:col-span-5 rounded-sm bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-foreground">
          Criar campanha
        </button>
      </form>
      <div className="space-y-2">
        {data.map((c) => (
          <div key={c.id} className="flex justify-between rounded-sm border border-hairline bg-surface-1 p-4 text-sm">
            <span>{c.name} — {c.rate_bps / 100}%{c.code ? ` (${c.code})` : ""}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {new Date(c.starts_at).toLocaleDateString("pt-BR")} → {new Date(c.ends_at).toLocaleDateString("pt-BR")} · {c.active ? "ativa" : "off"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{children}</th>;
}
function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input name={name} type="number" defaultValue={defaultValue} className="w-full rounded-sm border border-hairline bg-background px-3 py-2 text-sm" />
    </label>
  );
}