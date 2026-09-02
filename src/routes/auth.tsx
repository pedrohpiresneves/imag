import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { lovable } from "@/integrations/lovable";
import { ImagLogo } from "@/components/ImagLogo";
import { Mail, Lock } from "lucide-react";

const INK = "#111111";
const MUTED = "#7B7F89";
const HAIR = "#E8EAF0";
const BLUE = "#335CFF"; // institucional
const BLUE_CTA = "#335CFF"; // ação

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string; intent?: "signup" | "login"; email?: string } => ({
    ...(typeof s.next === "string" ? { next: s.next } : {}),
    ...(s.intent === "signup" || s.intent === "login"
      ? { intent: s.intent as "signup" | "login" }
      : {}),
    ...(typeof s.email === "string" ? { email: s.email } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Entre na iMAG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!p?.onboarding_completed_at) throw redirect({ to: "/preparar" });
      const next =
        typeof search?.next === "string" &&
        search.next.startsWith("/") &&
        !search.next.startsWith("//")
          ? search.next
          : null;
      if (next) {
        if (typeof window !== "undefined") window.location.assign(next);
        return;
      }
      throw redirect({ to: "/app" });
    }
  },
  component: AuthPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "form" | "sent" | "reset-sent";
type Mode = "signin" | "signup" | "magic" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const search = Route.useSearch();
  const nextUrl =
    search.next && search.next.startsWith("/") && !search.next.startsWith("//")
      ? search.next
      : null;

  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<Mode>(search.intent === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [name] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void routeAfterAuth();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function routeAfterAuth() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", u.user.id)
      .maybeSingle();
    const dest = p?.onboarding_completed_at ? "/app" : "/preparar";
    if (nextUrl && p?.onboarding_completed_at) {
      window.location.assign(nextUrl);
      return;
    }
    navigate({ to: dest });
  }

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth${
        nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
      });
      if (error) {
        setErr("Não foi possível enviar o link agora. Tente novamente.");
        return;
      }
      track("login", { method: "magic_link" });
      setEmail(value);
      setStep("sent");
      setResendIn(45);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Informe um e-mail válido.");
      return;
    }
    if (!password) {
      setErr("Informe sua senha.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: value,
        password,
      });
      if (error) {
        setErr("E-mail ou senha incorretos.");
        return;
      }
      track("login", { method: "password" });
      await routeAfterAuth();
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Informe um e-mail válido.");
      return;
    }
    if (password.length < 8) {
      setErr("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: value,
        password,
        options: {
          data: { full_name: name.trim() || value.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/auth${
            nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ""
          }`,
        },
      });
      if (error) {
        setErr(
          error.message.toLowerCase().includes("registered")
            ? "Este e-mail já possui conta. Faça login."
            : "Não foi possível criar sua conta agora.",
        );
        return;
      }
      track("signup_completed", { method: "password" });
      if (data.session) {
        await routeAfterAuth();
        return;
      }
      setStep("sent");
      setResendIn(45);
    } finally {
      setLoading(false);
    }
  }

  async function sendReset(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setErr("Não foi possível enviar o e-mail agora. Tente novamente.");
        return;
      }
      setEmail(value);
      setStep("reset-sent");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setErr("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    track("login", { method: "google" });
    await routeAfterAuth();
  }

  const isSignup = mode === "signup";
  const title =
    mode === "signup"
      ? "Comece na iMAG"
      : mode === "forgot"
        ? "Redefinir senha"
        : mode === "magic"
          ? "Receber link de acesso"
          : "Entre na iMAG";
  const subtitle =
    mode === "signup"
      ? "10 dias para experimentar uma direção mais clara."
      : mode === "forgot"
        ? "Enviaremos um e-mail para você criar uma nova senha."
        : mode === "magic"
          ? "Enviamos um link e você entra sem senha."
          : "Continue com a direção que você já começou.";

  const fieldClass =
    "h-[56px] w-full rounded-[14px] border bg-white px-4 text-[15px] text-[color:var(--ink)] outline-none transition placeholder:text-black/25 focus:border-[color:var(--ink)]";

  if (!mounted) return null;

  return (
    <div
      className="min-h-[100dvh] bg-white text-[color:var(--ink)]"
      style={{
        // @ts-expect-error CSS var
        "--ink": INK,
        "--muted": MUTED,
        "--hair": HAIR,
        "--blue": BLUE,
        fontFamily:
          "'Geist', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-6 pt-6 pb-8">
        <header>
          <a href="/" aria-label="iMAG — ir para o início" className="inline-flex items-center">
            <ImagLogo size={15} color={INK} />
          </a>
        </header>

        <main className="flex flex-1 flex-col justify-center py-6">
          {step === "form" ? (
            <>
              <h1 className="text-[42px] font-semibold leading-[1.02] tracking-[-0.03em]">
                {title}
              </h1>
              <p className="mt-3 max-w-[34ch] text-[15px] leading-[1.5] text-[color:var(--muted)]">
                {subtitle}
              </p>

              {mode !== "forgot" && (
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="mt-8 inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-full border bg-white text-[15px] font-medium text-[color:var(--ink)] transition hover:bg-black/[0.02]"
                  style={{ borderColor: HAIR }}
                >
                  <GoogleG /> Continuar com Google
                </button>
              )}

              {mode !== "forgot" && (
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: HAIR }} />
                  <span className="text-[12px] text-[color:var(--muted)]">ou</span>
                  <div className="h-px flex-1" style={{ background: HAIR }} />
                </div>
              )}

              <form
                onSubmit={
                  mode === "signin"
                    ? signInWithPassword
                    : mode === "signup"
                      ? signUpWithPassword
                      : mode === "forgot"
                        ? sendReset
                        : sendLink
                }
                className={`space-y-3 ${mode === "forgot" ? "mt-8" : ""}`}
              >
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  aria-label="Seu e-mail"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className={fieldClass}
                  style={{ borderColor: HAIR }}
                />

                {(mode === "signin" || mode === "signup") && (
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "Crie uma senha" : "Sua senha"}
                    aria-label={isSignup ? "Crie uma senha" : "Sua senha"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                    className={fieldClass}
                    style={{ borderColor: HAIR }}
                  />
                )}

                {err && <p className="text-[13px] text-red-600">{err}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-[56px] w-full items-center justify-center rounded-full text-[15px] font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: BLUE_CTA }}
                >
                  {loading
                    ? "Aguarde…"
                    : mode === "signin"
                      ? "Entrar"
                      : mode === "signup"
                        ? "Criar minha conta"
                        : mode === "forgot"
                          ? "Enviar e-mail"
                          : "Enviar link de acesso"}
                </button>

                <div className="flex flex-col items-center gap-1.5 pt-4 text-[13px]">
                  {mode === "signin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("magic");
                          setErr(null);
                        }}
                        className="font-medium"
                        style={{ color: BLUE }}
                      >
                        Receber link de acesso por e-mail
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setErr(null);
                        }}
                        style={{ color: BLUE }}
                      >
                        Esqueci minha senha
                      </button>
                    </>
                  )}
                  {(mode === "magic" || mode === "forgot") && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErr(null);
                      }}
                      style={{ color: BLUE }}
                    >
                      Entrar com e-mail e senha
                    </button>
                  )}
                </div>
              </form>

              <div
                className="mt-8 pt-5 text-center text-[13px] text-[color:var(--muted)]"
                style={{ borderTop: `1px solid ${HAIR}` }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignup ? "signin" : "signup");
                    setErr(null);
                  }}
                >
                  {isSignup ? (
                    <>Já tem conta? <span className="font-medium" style={{ color: BLUE }}>Entrar</span></>
                  ) : (
                    <>Ainda não tem conta? <span className="font-medium" style={{ color: BLUE }}>Experimentar grátis</span></>
                  )}
                </button>
              </div>
            </>
          ) : step === "reset-sent" ? (
            <div>
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "rgba(51, 92, 255,0.08)" }}
              >
                <Mail size={20} style={{ color: BLUE }} />
              </span>
              <h1 className="mt-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
                Confira seu e-mail
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted)]">
                Enviamos um link para redefinir sua senha para{" "}
                <span className="font-medium text-[color:var(--ink)]">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setMode("signin");
                  setErr(null);
                }}
                className="mt-8 block w-full text-center text-[13px] text-[color:var(--muted)] underline underline-offset-4"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <SentStep
              email={email}
              onResend={() => sendLink()}
              resendIn={resendIn}
              onEdit={() => {
                setStep("form");
                setErr(null);
                setResendIn(0);
              }}
              loading={loading}
              err={err}
            />
          )}
        </main>

        <footer className="flex items-center justify-center gap-1.5 pt-4 text-[12px] text-[color:var(--muted)]">
          <Lock size={12} />
          Seguro, privado e exclusivo para profissionais.
        </footer>
      </div>
    </div>
  );
}

function SentStep({
  email,
  onResend,
  resendIn,
  onEdit,
  loading,
  err,
}: {
  email: string;
  onResend: () => void;
  resendIn: number;
  onEdit: () => void;
  loading: boolean;
  err: string | null;
}) {
  return (
    <div>
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(51, 92, 255,0.08)" }}
      >
        <Mail size={20} style={{ color: BLUE }} />
      </span>

      <h1 className="mt-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
        Confira seu e-mail
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted)]">
        Enviamos um link de acesso para{" "}
        <span className="font-medium text-[color:var(--ink)]">{email}</span>.
        Clique no link para entrar na iMAG.
      </p>

      {err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}

      <a
        href="https://mail.google.com/mail/u/0/#search/iMAG"
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white transition hover:opacity-95"
        style={{ background: BLUE_CTA }}
      >
        Abrir meu e-mail
      </a>

      <button
        type="button"
        onClick={onResend}
        disabled={loading || resendIn > 0}
        className="mt-4 block w-full text-center text-[13px] text-[color:var(--muted)] underline underline-offset-4 hover:text-[color:var(--ink)] disabled:opacity-60"
      >
        {resendIn > 0 ? `Reenviar link em ${resendIn}s` : "Reenviar link"}
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="mt-3 block w-full text-center text-[13px] text-[color:var(--muted)] underline underline-offset-4 hover:text-[color:var(--ink)]"
      >
        Trocar e-mail
      </button>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}