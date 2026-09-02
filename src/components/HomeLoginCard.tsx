import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { track } from "@/lib/analytics";
import { Mail } from "lucide-react";

const INK = "#111111";
const MUTED = "#7B7F89";
const HAIR = "#E8EAF0";
const BLUE = "#335CFF";
const BLUE_CTA = "#335CFF";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "signin" | "magic";

export function HomeLoginCard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function routeAfterAuth() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", u.user.id)
      .maybeSingle();
    navigate({ to: p?.onboarding_completed_at ? "/app" : "/preparar" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email: value,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) {
          setErr("Não foi possível enviar o link agora. Tente novamente.");
          return;
        }
        track("login", { method: "magic_link" });
        setSent(true);
        return;
      }
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

  const fieldClass =
    "h-[52px] w-full rounded-[14px] border bg-white px-4 text-[15px] outline-none transition placeholder:text-black/25 focus:border-[#111111]";

  if (sent) {
    return (
      <Shell>
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "rgba(51, 92, 255,0.08)" }}
        >
          <Mail size={18} style={{ color: BLUE }} />
        </span>
        <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>
          Confira seu e-mail
        </h2>
        <p className="mt-2 text-[14px] leading-[1.5]" style={{ color: MUTED }}>
          Enviamos um link de acesso para{" "}
          <span className="font-medium" style={{ color: INK }}>
            {email}
          </span>
          .
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 text-[13px] underline underline-offset-4"
          style={{ color: MUTED }}
        >
          Usar outro e-mail
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>
        Entre na iMAG
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5]" style={{ color: MUTED }}>
        {mode === "magic"
          ? "Enviamos um link e você entra sem senha."
          : "Continue com a direção que você já começou."}
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-full border bg-white text-[15px] font-medium transition hover:bg-black/[0.02]"
        style={{ borderColor: HAIR, color: INK }}
      >
        <GoogleG /> Continuar com Google
      </button>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: HAIR }} />
        <span className="text-[12px]" style={{ color: MUTED }}>
          ou
        </span>
        <div className="h-px flex-1" style={{ background: HAIR }} />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          aria-label="Seu e-mail"
          autoComplete="email"
          inputMode="email"
          required
          className={fieldClass}
          style={{ borderColor: HAIR, color: INK }}
        />
        {mode === "signin" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            aria-label="Sua senha"
            autoComplete="current-password"
            required
            className={fieldClass}
            style={{ borderColor: HAIR, color: INK }}
          />
        )}
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-medium text-white transition hover:opacity-95 disabled:opacity-60"
          style={{ background: BLUE_CTA }}
        >
          {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Enviar link de acesso"}
        </button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-1.5 text-[13px]">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "magic" : "signin");
            setErr(null);
          }}
          className="font-medium"
          style={{ color: BLUE }}
        >
          {mode === "signin" ? "Receber link de acesso por e-mail" : "Entrar com e-mail e senha"}
        </button>
        <Link to="/auth" search={{ intent: "login" }} style={{ color: MUTED }}>
          Esqueci minha senha
        </Link>
      </div>

      <div
        className="mt-5 pt-4 text-center text-[13px]"
        style={{ borderTop: `1px solid ${HAIR}`, color: MUTED }}
      >
        Ainda não tem conta?{" "}
        <Link
          to="/auth"
          search={{ intent: "signup" }}
          onClick={() => track("cta_click", { location: "home_login_card", target: "signup" })}
          className="font-medium"
          style={{ color: BLUE }}
        >
          Experimentar grátis
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-[400px] rounded-[24px] bg-white p-6 sm:p-7"
      style={{
        border: `1px solid ${HAIR}`,
        boxShadow: "0 24px 60px -40px rgba(17,17,17,0.35)",
      }}
    >
      {children}
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
