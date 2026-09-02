import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AccessGate } from "@/components/AccessGate";
import { usePaid } from "@/lib/use-paid";
import {
  Users,
  Clock,
  Gem,
  Wallet,
  Share2,
  Copy,
  Link2,
  UserPlus,
  Inbox,
  Info,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  acceptReferralTerms,
  getMyAmbassadorDashboard,
  requestPayout,
  updatePixKey,
} from "@/lib/referrals/dashboard.functions";

export const Route = createFileRoute("/_authenticated/circulo")({
  component: CirculoMagnetico,
});

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  pending: "em aprovação",
  available: "disponível",
  paid: "paga",
  reversed: "revertida",
  cancelled: "cancelada",
};

function CirculoMagnetico() {
  const qc = useQueryClient();
  const { isPaid, isLoading: paidLoading } = usePaid();
  const { data, isLoading } = useQuery({
    queryKey: ["ambassador", "dashboard"],
    queryFn: () => getMyAmbassadorDashboard(),
    enabled: isPaid,
  });
  const [tab, setTab] = useState<"historico" | "materiais" | "pagamentos" | "termos">(
    "historico",
  );
  const [copied, setCopied] = useState(false);

  const accept = useMutation({
    mutationFn: () => acceptReferralTerms(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ambassador", "dashboard"] }),
  });
  const payout = useMutation({
    mutationFn: () => requestPayout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ambassador", "dashboard"] }),
  });
  const pix = useMutation({
    mutationFn: (v: { pixKey: string; pixKeyType: "cpf" | "cnpj" | "email" | "phone" | "random" }) =>
      updatePixKey({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ambassador", "dashboard"] }),
  });

  async function copyLink() {
    if (!data?.referralUrl) return;
    await navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    if (!data?.referralUrl) return;
    const text = `Conheça a iMAG — sua mentora estratégica de IA.\n\n${data.referralUrl}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Círculo iMAG", text, url: data.referralUrl });
        return;
      } catch {
        // usuário cancelou — fallback silencioso
      }
    }
    await copyLink();
  }

  const needsTerms = !isLoading && data && !data.termsAcceptedAt;
  const shortLink = data?.referralUrl.replace(/^https?:\/\//, "") ?? "";

  if (!paidLoading && !isPaid) {
    return (
      <div
        className="surface-light min-h-screen"
        style={{ ["--accent" as string]: "#335CFF", ["--primary" as string]: "#335CFF", ["--ring" as string]: "#335CFF" } as React.CSSProperties}
      >
        <AppHeader />
        <main
          className="mx-auto max-w-[720px] px-6 py-12 sm:px-8 sm:py-16"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
        >
          <Hero />
          <div className="mt-10">
            <AccessGate variant="generic" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="surface-light min-h-screen"
      style={{ ["--accent" as string]: "#335CFF", ["--primary" as string]: "#335CFF", ["--ring" as string]: "#335CFF" } as React.CSSProperties}
    >
      <AppHeader />
      <main
        className="mx-auto max-w-[720px] px-6 py-10 sm:px-8 sm:py-14"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
      >
        <Hero />

        {isLoading && <p className="mt-10 text-sm text-muted-foreground">Carregando…</p>}

        {data && (
          <>
            {/* Card de recompensa */}
            <section className="mt-10 rounded-[20px] border border-black/[0.06] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/8 text-accent">
                  <UserPlus className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-light text-muted-foreground">Sua recompensa</p>
                  <p className="mt-1 text-[40px] leading-none font-semibold tracking-[-0.03em] text-accent">
                    {data.rateBps / 100}%
                  </p>
                  <p className="mt-2 text-[14px] text-foreground/80">por assinatura confirmada</p>
                  <p className="mt-0.5 text-[13px] font-light text-muted-foreground">
                    Recebimento automático via Pix.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
            </section>

            {/* Seu convite */}
            <section className="mt-6 rounded-[20px] border border-black/[0.06] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <p className="text-[15px] font-medium tracking-[-0.01em]">Seu convite</p>
              <p className="mt-1 text-[13px] font-light text-muted-foreground">
                Seu link exclusivo para convidar profissionais.
              </p>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAF7] px-4 py-3">
                <Link2 className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <p className="flex-1 truncate text-[14px] font-medium tracking-[-0.01em]">
                  {shortLink}
                </p>
                <button
                  aria-label="Copiar link"
                  onClick={copyLink}
                  className="rounded-full p-1.5 text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  onClick={shareInvite}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14px] font-medium text-white transition hover:brightness-110"
                >
                  <Share2 className="h-4 w-4" strokeWidth={2} />
                  Compartilhar convite
                </button>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/25 px-6 py-3.5 text-[14px] font-medium text-accent transition hover:bg-accent/[0.04]"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                  {copied ? "Link copiado" : "Copiar link"}
                </button>
              </div>

              {needsTerms && (
                <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4">
                  <p className="text-[13px] text-foreground/80">
                    Antes de compartilhar, aceite os termos do Círculo iMAG.
                  </p>
                  <button
                    onClick={() => setTab("termos")}
                    className="mt-2 text-[13px] font-medium text-accent"
                  >
                    Abrir termos →
                  </button>
                </div>
              )}
            </section>

            {/* Seu desempenho */}
            <section className="mt-6 rounded-[20px] border border-black/[0.06] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <p className="text-[15px] font-medium tracking-[-0.01em]">Seu desempenho</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
                  value={String(data.metrics.conversions)}
                  label="Profissionais convidados"
                />
                <StatCard
                  icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
                  value={String(data.metrics.trialCount ?? 0)}
                  label="Em aprovação"
                />
                <StatCard
                  icon={<Gem className="h-4 w-4" strokeWidth={1.5} />}
                  value={brl(data.metrics.totalEarnedCents)}
                  label="Recompensas acumuladas"
                />
                <StatCard
                  icon={<Wallet className="h-4 w-4" strokeWidth={1.5} />}
                  value={brl(data.metrics.availableCents)}
                  label="Disponível para saque"
                />
              </div>
            </section>

            {/* Abas */}
            <section className="mt-8">
              <div className="flex flex-wrap gap-6 border-b border-black/[0.08]">
                {(["historico", "materiais", "pagamentos", "termos"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`pb-3 text-[14px] font-medium tracking-[-0.01em] transition ${
                      tab === t
                        ? "border-b-2 border-accent text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "historico" ? "Histórico" : t === "materiais" ? "Materiais" : t === "pagamentos" ? "Pagamentos" : "Termos"}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                {tab === "historico" && (
                  <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                    {data.history.length === 0 ? (
                      <EmptyState
                        title="Nenhuma indicação registrada ainda."
                        subtitle="Compartilhe seu convite para começar."
                      />
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-black/[0.02]">
                          <tr>
                            <th className="p-3 text-left text-[11px] font-medium text-muted-foreground">Data</th>
                            <th className="p-3 text-left text-[11px] font-medium text-muted-foreground">Valor</th>
                            <th className="p-3 text-left text-[11px] font-medium text-muted-foreground">Status</th>
                            <th className="p-3 text-left text-[11px] font-medium text-muted-foreground">Libera em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.history.map((h) => (
                            <tr key={h.id} className="border-t border-black/[0.06]">
                              <td className="p-3">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</td>
                              <td className="p-3">{brl(h.amountCents)}</td>
                              <td className="p-3">
                                <span className={h.status === "available" || h.status === "paid" ? "text-accent" : "text-muted-foreground"}>
                                  {STATUS_LABEL[h.status] ?? h.status}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {new Date(h.releaseAt).toLocaleDateString("pt-BR")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {tab === "materiais" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {materialTemplates(data.referralUrl).map((m) => (
                    <MaterialCard
                      key={m.title}
                      title={m.title}
                      body={m.body}
                      variants={"variants" in m ? m.variants : undefined}
                    />
                    ))}
                  </div>
                )}

                {tab === "pagamentos" && (
                  <div className="space-y-8">
                    <PixForm
                      current={data.pixKey}
                      currentType={data.pixKeyType}
                      onSave={(v) => pix.mutate(v)}
                      saving={pix.isPending}
                    />
                    <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
                      <p className="text-[13px] font-light text-muted-foreground">
                        Solicitar saque
                      </p>
                      <p className="mt-3 text-2xl font-medium" style={{ letterSpacing: "-0.02em" }}>
                        {brl(data.metrics.availableCents)} disponíveis
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mínimo para saque: {brl(data.minPayoutCents)}
                      </p>
                      <button
                        disabled={
                          data.metrics.availableCents < data.minPayoutCents ||
                          !data.pixKey ||
                          !data.termsAcceptedAt ||
                          payout.isPending
                        }
                        onClick={() => payout.mutate()}
                        className="mt-5 rounded-full bg-accent px-6 py-3 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {payout.isPending ? "Solicitando…" : "Solicitar via PIX"}
                      </button>
                      {payout.error && (
                        <p className="mt-3 text-sm text-destructive">
                          {(payout.error as Error).message}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="mb-3 text-[13px] font-light text-muted-foreground">
                        Histórico de pagamentos
                      </p>
                      {data.payouts.length === 0 ? (
                        <EmptyState
                          title="Nenhum saque solicitado ainda."
                          subtitle="Suas recompensas aparecerão aqui."
                        />
                      ) : (
                        <div className="space-y-2">
                          {data.payouts.map((p) => (
                            <div key={p.id} className="flex justify-between rounded-2xl border border-black/[0.06] bg-white p-4 text-sm">
                              <span>{new Date(p.createdAt).toLocaleDateString("pt-BR")} — {brl(p.amountCents)}</span>
                              <span className="text-[12px] text-muted-foreground">{p.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === "termos" && (
                  <div className="max-w-[70ch] space-y-4 text-[15px] leading-relaxed font-light">
                    <p>
                      Ao participar do Círculo iMAG, você concorda em <strong>divulgar de
                      forma transparente</strong> qualquer relação comercial ou comissão em
                      publicações promocionais, seguindo boas práticas de publicidade (CONAR e
                      legislação vigente).
                    </p>
                    <p>
                      Este é um programa de indicação direta (1 nível). Cada assinatura confirmada
                      gera recompensa apenas para quem indicou diretamente — <strong>não existem
                      níveis, camadas ou formação de rede</strong>. Uma indicação, uma recompensa.
                    </p>
                    <p>
                      Recompensas são criadas após a aprovação do pagamento, permanecem em
                      aprovação durante o período de garantia e são revertidas em caso de
                      reembolso ou disputa. Auto-indicação, criação de contas duplicadas e
                      atividades suspeitas resultam em bloqueio.
                    </p>
                    <p>
                      Seus dados são tratados conforme os princípios da LGPD. Você pode solicitar
                      exportação ou exclusão dos seus dados a qualquer momento — comissões pagas
                      são mantidas apenas pelo período fiscal exigido por lei.
                    </p>
                    {data.termsAcceptedAt ? (
                      <p className="text-[13px] font-medium text-accent">
                        Termos aceitos em {new Date(data.termsAcceptedAt).toLocaleDateString("pt-BR")}
                      </p>
                    ) : (
                      <button
                        onClick={() => accept.mutate()}
                        disabled={accept.isPending}
                        className="mt-4 rounded-full bg-accent px-6 py-3 text-[13px] font-medium text-white"
                      >
                        {accept.isPending ? "Confirmando…" : "Aceito os termos"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Rodapé informativo */}
            <section className="mt-8 rounded-[20px] border border-black/[0.06] bg-[#FAFAF7] p-5">
              <div className="flex gap-3">
                <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" strokeWidth={1.5} />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  A iMAG recompensa indicações genuínas de profissionais que realmente utilizam e
                  acreditam na plataforma.{" "}
                  <span className="text-foreground/80">
                    Não existe comissão por recrutamento, múltiplos níveis ou formação de rede.
                  </span>
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Hero() {
  return (
    <section className="pb-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.08] px-3 py-1.5 text-[11px] font-medium text-accent">
        <Sparkles className="h-3 w-3" strokeWidth={2} />
        Círculo iMAG
      </span>
      <h1 className="mt-6 text-[clamp(28px,6vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em]">
        Convide profissionais.
        <br />
        Fortaleça a <span className="text-accent">comunidade.</span>
      </h1>
      <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground font-light">
        Convide profissionais que possam se beneficiar da iMAG. Quando uma assinatura for
        confirmada através do seu convite, você recebe automaticamente{" "}
        <span className="text-accent font-medium">20% de recompensa</span>.
      </p>
    </section>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF7] p-4">
      <div className="text-accent">{icon}</div>
      <p className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-accent tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-snug font-light text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/[0.08] text-accent">
        <Inbox className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <p className="mt-2 text-[14px] text-foreground/80">{title}</p>
      <p className="text-[13px] font-light text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function MaterialCard({
  title,
  body,
  variants,
}: {
  title: string;
  body: string;
  variants?: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [index, setIndex] = useState(0);
  const options = variants && variants.length > 0 ? [body, ...variants] : [body];
  const text = options[index] ?? body;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "iMAG", text });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  return (
    <div className="rounded-[20px] border border-black/[0.06] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium tracking-[-0.01em]">{title}</p>
        {options.length > 1 && (
          <button
            onClick={() => setIndex((i) => (i + 1) % options.length)}
            className="shrink-0 rounded-full border border-black/[0.08] px-3 py-1.5 text-[12px] font-light text-muted-foreground transition hover:bg-black/[0.03] hover:text-foreground"
          >
            Outra versão · {index + 1}/{options.length}
          </button>
        )}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85">
        {text}
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          onClick={share}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
          Compartilhar
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-full border border-accent/25 px-5 py-2.5 text-[13px] font-medium text-accent transition hover:bg-accent/[0.04]"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          {copied ? "Copiado" : "Copiar texto"}
        </button>
      </div>
    </div>
  );
}

function materialTemplates(url: string) {
  return [
    {
      title: "Menos sobrecarga",
      body: `Pare de gastar energia pensando no que fazer.\n\nA iMAG transforma seus objetivos em direção prática para cada dia.\n\nMenos sobrecarga. Mais direção.\n\n${url}`,
      variants: [
        `Menos tempo decidindo. Mais tempo executando. A iMAG cuida da direção.\n\n${url}`,
        `Enquanto você trabalha, a iMAG pensa na próxima melhor ação.\n\n${url}`,
        `Você não precisa mais decidir o próximo passo. A iMAG ajuda a definir a melhor direção.\n\n${url}`,
        `Chega de perder tempo tentando descobrir o que fazer. A iMAG entrega clareza e direção.\n\n${url}`,
      ],
    },
    {
      title: "WhatsApp direto",
      body: `Se você vive com a cabeça cheia de tarefas e nunca sabe por onde começar, dá uma olhada na iMAG.\n\nEla organiza seus objetivos e entrega uma direção prática por dia.\n\n${url}`,
    },
    {
      title: "Story / bio",
      body: `Inteligência estratégica pra rotina profissional.\nMenos sobrecarga. Mais direção.\n${url}`,
    },
    {
      title: "E-mail curto",
      body: `Oi,\n\nComecei a usar a iMAG para transformar meus objetivos em ações práticas do dia. Reduziu bastante o ruído mental por aqui.\n\n${url}\n\nSe fizer sentido, me conta depois.`,
    },
    {
      title: "Indicação profissional",
      body: `Se você trabalha com metas e decisões o dia inteiro, a iMAG ajuda: ela interpreta seu momento e aponta a próxima melhor ação.\n\n${url}`,
    },
  ];
}

function PixForm({
  current,
  currentType,
  onSave,
  saving,
}: {
  current: string | null;
  currentType: string | null;
  onSave: (v: { pixKey: string; pixKeyType: "cpf" | "cnpj" | "email" | "phone" | "random" }) => void;
  saving: boolean;
}) {
  const [pixKey, setPixKey] = useState(current ?? "");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "cnpj" | "email" | "phone" | "random">(
    (currentType as "cpf" | "cnpj" | "email" | "phone" | "random") ?? "email",
  );
  return (
    <form
      className="rounded-xl border border-black/10 bg-white/60 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (pixKey.trim().length >= 3) onSave({ pixKey: pixKey.trim(), pixKeyType });
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Chave PIX para recebimento
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select
          value={pixKeyType}
          onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
        >
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="email">E-mail</option>
          <option value="phone">Telefone</option>
          <option value="random">Chave aleatória</option>
        </select>
        <input
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="Sua chave PIX"
          className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}