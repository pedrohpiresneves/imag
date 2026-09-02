import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  AtSign,
  KeyRound,
  Mail,
  LogOut,
  Headphones,
  ChevronRight,
  ChevronLeft,
  BadgeCheck,
  Crown,
  User,
  Languages,
  Instagram,
  Sparkles,

} from "lucide-react";
import { restartTour } from "@/lib/mag/tour";
import { MagNotificationsCard } from "@/components/MagNotificationsCard";
import { ImagHandleField } from "@/components/ImagHandleField";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import { fetchProfile } from "@/lib/user-data";
import { getMyHandle, setMyHandle } from "@/lib/handle.functions";
import { createStripePortalSession } from "@/lib/stripe/checkout.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useI18n, LOCALE_LABELS } from "@/lib/i18n";
import {
  describeSubscription,
  useSubscriptionRefreshOnResume,
  useSubscriptionState,
} from "@/lib/subscription-state";

export const Route = createFileRoute("/configuracoes")({
  ssr: false,
  component: ConfiguracoesPage,
  head: () => ({
    meta: [
      { title: "Configurações · iMAG" },
      {
        name: "description",
        content: "Gerencie sua conta e preferências essenciais na iMAG.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const BLUE = "var(--blue)";
const HAIR = "#E9EBEF";

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(
    typeof document !== "undefined" ? document.documentElement.lang || "pt-BR" : "pt-BR",
    { day: "2-digit", month: "long", year: "numeric" },
  ).format(d);
}

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId, email, isLoggedIn } = useAccess();
  const { t, locale } = useI18n();

  const [sheet, setSheet] = useState<null | "handle" | "signout" | "instagram">(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
  const {
    data: subState,
    isLoading: subLoading,
    isError: subError,
  } = useSubscriptionState();
  useSubscriptionRefreshOnResume();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const raw = (p as { avatar_url?: string | null } | null)?.avatar_url;
      if (!raw) return;
      if (raw.startsWith("http")) {
        if (alive) setAvatarUrl(raw);
        return;
      }
      const { data: s } = await supabase.storage
        .from("avatars")
        .createSignedUrl(raw, 60 * 60 * 24);
      if (alive) setAvatarUrl(s?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function requestPasswordReset() {
    if (!email) return;
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      alert(t("settings", "resetSent"));
    } catch {
      alert(t("settings", "resetFailed"));
    }
  }

  async function changeEmail() {
    const next = window.prompt(t("settings", "newEmailPrompt"), email ?? "");
    if (!next || next === email) return;
    const { error } = await supabase.auth.updateUser({ email: next });
    if (error) alert(error.message);
    else alert(t("settings", "emailChangeSent"));
  }

  const displayName =
    profile?.full_name?.trim() || email?.split("@")[0] || t("common", "myAccount");
  const initial = displayName.charAt(0).toUpperCase();

  /* ---- fonte única de assinatura (igual em todas as telas) ---- */
  const subCopy = describeSubscription(subState, {
    loading: subLoading,
    error: subError,
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Cabeçalho interno: voltar + título */}
      <header
        className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur"
        style={{ borderColor: "#F1F1F4", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-[52px] max-w-[560px] items-center gap-1 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Voltar"
            className="grid h-10 w-10 place-items-center rounded-full transition active:opacity-60"
          >
            <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={1.9} />
          </button>
          <span className="flex-1 text-[16px] font-semibold tracking-[-0.02em]">Configurações</span>
        </div>
      </header>

      <main
        className="mx-auto max-w-[560px] px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 48px)" }}
      >
        {/* Resumo da conta */}
        <Card className="mt-4">
          <div className="flex items-center gap-4 p-4">
            <div
              className="grid h-[54px] w-[54px] shrink-0 place-items-center overflow-hidden rounded-full text-[20px] font-semibold"
              style={{ background: "var(--blue-tint)", color: BLUE }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold tracking-[-0.01em]">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[13.5px] text-neutral-500">
                {email ?? "—"}
              </p>
              {subLoading ? (
                <span className="mt-2 block h-4 w-32 animate-pulse rounded bg-neutral-100" />
              ) : (
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ background: "var(--blue-tint)", color: BLUE }}
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {subCopy.short}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Conta */}
        <SectionLabel>{t("settings", "accountSection")}</SectionLabel>
        <Card>
          <Row
            icon={<AtSign className="h-[18px] w-[18px]" />}
            label={t("settings", "changeHandle")}
            onClick={() => setSheet("handle")}
            disabled={!isLoggedIn}
          />
          <Divider />
          <Row
            icon={<Mail className="h-[18px] w-[18px]" />}
            label={t("settings", "changeEmail")}
            onClick={changeEmail}
            disabled={!isLoggedIn}
          />
          <Divider />
          <Row
            icon={<KeyRound className="h-[18px] w-[18px]" />}
            label={t("settings", "changePassword")}
            onClick={requestPasswordReset}
            disabled={!email}
          />
        </Card>

        {/* Preferências */}
        <SectionLabel>{t("settings", "preferencesSection")}</SectionLabel>
        <Card>
          <Link
            to="/idioma"
            className="flex min-h-[58px] w-full items-center gap-3.5 px-4 text-left transition hover:bg-neutral-50"
          >
            <IconBubble>
              <Languages className="h-[18px] w-[18px]" />
            </IconBubble>
            <span className="flex-1 text-[15px] font-medium tracking-[-0.01em]">
              {t("settings", "language")}
            </span>
            <span className="text-[14px] text-neutral-400">{LOCALE_LABELS[locale]}</span>
            <ChevronRight className="h-[18px] w-[18px] text-neutral-300" />
          </Link>
        </Card>


        {/* Assinatura */}
        {/* Conexões */}
        <SectionLabel>Conexões</SectionLabel>
        <Card>
          <div className="flex w-full items-center gap-3.5 p-4 text-left">
            <IconBubble>
              <Instagram className="h-[18px] w-[18px]" />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium tracking-[-0.01em]">Instagram</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
                Conecte sua conta profissional para personalizar suas direções.
              </p>
            </div>
            <span className="shrink-0 text-[14px] font-medium text-neutral-400">
              Em breve
            </span>
          </div>
        </Card>
        <p className="mt-2 px-1 text-[11.5px] text-neutral-400">
          A iMAG nunca publicará nada sem sua autorização.
        </p>

        <SectionLabel>{t("settings", "subscriptionSection")}</SectionLabel>
        <Card>
          {subLoading ? (
            <div className="flex items-center gap-3.5 p-4">
              <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100" />
              <div className="flex-1">
                <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
                <div className="mt-2 h-3 w-56 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-3.5">
                <IconBubble>
                  <Crown className="h-[18px] w-[18px]" />
                </IconBubble>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-semibold tracking-[-0.01em]">
                    {subCopy.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {subCopy.subtitle}
                  </p>
                </div>
                {subCopy.action?.kind === "portal" && (
                  <ManageSubscription label={subCopy.action.label} />
                )}
              </div>
              {subCopy.action && subCopy.action.kind === "plans" && (
                <Link
                  to="/planos"
                  className="mt-4 flex min-h-[46px] w-full items-center justify-center rounded-xl text-[14px] font-medium text-white transition"
                  style={{ background: BLUE }}
                >
                  {subCopy.action.label}
                </Link>
              )}
            </div>
          )}
        </Card>

        {/* Notificações */}
        <MagNotificationsCard
          Card={Card}
          SectionLabel={SectionLabel}
          IconBubble={IconBubble}
        />

        {/* Suporte */}
        <SectionLabel>{t("settings", "supportSection")}</SectionLabel>
        <Card>
          <div className="flex items-center gap-3.5 p-4">
            <IconBubble>
              <Headphones className="h-[18px] w-[18px]" />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] font-semibold tracking-[-0.01em]">
                {t("settings", "needHelp")}
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                {t("settings", "supportSubtitle")}
              </p>
            </div>
            <Link
              to="/suporte"
              className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-medium"
              style={{ color: BLUE }}
            >
              {t("settings", "talkToSupport")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        {/* Tutorial da MAG */}
        <SectionLabel>Tutorial</SectionLabel>
        <Card>
          <div className="flex items-center gap-3.5 p-4">
            <IconBubble>
              <Sparkles className="h-[18px] w-[18px]" />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] font-semibold tracking-[-0.01em]">
                Apresentação da MAG
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                Refaça o passo a passo guiado pelo app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void restartTour()}
              className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-medium"
              style={{ color: BLUE }}
            >
              Ver novamente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>

        {/* Encerrar sessão */}
        <button
          type="button"
          onClick={() => setSheet("signout")}
          disabled={!isLoggedIn}
          className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] text-[14.5px] font-medium transition disabled:opacity-40"
          style={{ background: "#FDF2F2", color: "#C0453B" }}
        >
          <LogOut className="h-[17px] w-[17px]" />
          {t("settings", "signOut")}
        </button>

        {/* Rodapé */}
        <div className="mt-6 flex items-center justify-between text-[12px] text-neutral-400">
          <Link to="/privacidade" className="transition hover:text-neutral-600">
            {t("settings", "privacy")}
          </Link>
          <span>{t("common", "version")} 1.0</span>
        </div>
      </main>

      

      {sheet === "handle" && <HandleSheet onClose={() => setSheet(null)} />}
      {sheet === "instagram" && (
        <Sheet onClose={() => setSheet(null)} title="Conexão com o Instagram">
          <p className="text-[13.5px] leading-relaxed text-neutral-500">
            Em breve você poderá conectar sua conta profissional do Instagram para
            que a MAG leia sinais reais do seu negócio e gere direções ainda mais
            precisas. A iMAG nunca publicará nada sem sua autorização.
          </p>
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-xl text-[14px] font-medium text-white"
            style={{ background: BLUE }}
          >
            Entendi
          </button>
        </Sheet>
      )}
      {sheet === "signout" && (
        <Sheet onClose={() => setSheet(null)} title={t("settings", "signOutConfirm")}>
          <p className="text-[13.5px] text-neutral-500">
            {t("settings", "signOutBody")}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="flex-1 min-h-[48px] rounded-xl border text-[14px] font-medium text-neutral-700"
              style={{ borderColor: HAIR }}
            >
              {t("common", "cancel")}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex-1 min-h-[48px] rounded-xl text-[14px] font-medium"
              style={{ background: "#FDF2F2", color: "#C0453B" }}
            >
              {t("settings", "signOut")}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)] ${className ?? ""}`}
      style={{ borderColor: HAIR }}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 mt-7 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="ml-[62px] h-px" style={{ background: HAIR }} />;
}

function IconBubble({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
      style={{ background: "var(--blue-tint)", color: BLUE }}
    >
      {children}
    </span>
  );
}

function Row({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[58px] w-full items-center gap-3.5 px-4 text-left transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <IconBubble>{icon}</IconBubble>
      <span className="flex-1 text-[15px] font-medium tracking-[-0.01em]">{label}</span>
      <ChevronRight className="h-[18px] w-[18px] text-neutral-300" />
    </button>
  );
}

function ManageSubscription({ label = "Gerenciar assinatura" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  async function openPortal() {
    setBusy(true);
    try {
      const res = await createStripePortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank", "noopener");
    } catch {
      alert("Não foi possível abrir o portal agora.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-medium disabled:opacity-40"
      style={{ color: BLUE }}
    >
      {busy ? "Abrindo…" : label}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheets                                                                     */

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/25"
      />
      <div className="relative w-full max-w-[440px] rounded-t-[26px] bg-white p-6 shadow-[0_-8px_40px_rgba(16,24,40,0.10)] sm:rounded-[26px]">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function HandleSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-handle"],
    queryFn: () => getMyHandle(),
  });
  const current = data?.handle ?? null;
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);

  const canSave = status === "available" && value.length > 0 && value !== current;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await setMyHandle({ data: { handle: value } });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["my-handle"] });
        onClose();
        return;
      }
      if (res.reason === "cooldown") {
        setNextAllowed(res.next_allowed_at ?? null);
        setError("Você já alterou sua iMAG ID recentemente.");
      } else if (res.reason === "taken") setError("Essa identidade já está em uso.");
      else setError("Não foi possível salvar. Verifique o formato e tente novamente.");
      setConfirming(false);
    } catch {
      setError("Não foi possível salvar agora.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="Alterar iMAG ID" onClose={onClose}>
      <p className="text-[13px] text-neutral-500">Sua identificação atual</p>
      <p className="mt-0.5 text-[16px] font-semibold" style={{ color: BLUE }}>
        {current ? `im.${current}` : "—"}
      </p>

      <div className="mt-5">
        <ImagHandleField
          value={value}
          onChange={setValue}
          onStatusChange={setStatus}
          currentHandle={current}
          autoFocus
          label="Nova iMAG ID"
          helper="Use letras minúsculas, números e ponto. Sem espaços."
        />
      </div>

      {error && (
        <p className="mt-3 text-[12.5px]" style={{ color: "#C0453B" }}>
          {error}
          {nextAllowed
            ? ` Disponível novamente em ${formatDate(nextAllowed) ?? "breve"}.`
            : ""}
        </p>
      )}

      {confirming ? (
        <div className="mt-5">
          <p className="text-[13.5px] text-neutral-600">
            Confirmar alteração para <strong>im.{value}</strong>?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="flex-1 min-h-[48px] rounded-xl border text-[14px] font-medium text-neutral-700"
              style={{ borderColor: HAIR }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 min-h-[48px] rounded-xl text-[14px] font-medium text-white disabled:opacity-50"
              style={{ background: BLUE }}
            >
              {saving ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-xl border text-[14px] font-medium text-neutral-700"
            style={{ borderColor: HAIR }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canSave}
            className="min-h-[48px] flex-[1.4] rounded-xl text-[14px] font-medium text-white disabled:opacity-40"
            style={{ background: BLUE }}
          >
            Salvar nova iMAG ID
          </button>
        </div>
      )}
    </Sheet>
  );
}
