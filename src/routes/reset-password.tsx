import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImagLockup } from "@/components/ImagLogo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha · Agenda Magnética" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // detectSessionInUrl already runs on client init; give it a tick,
    // then verify a recovery session was hydrated.
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setErr("Link inválido ou expirado. Solicite um novo e-mail para redefinir sua senha.");
      }
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      window.setTimeout(() => navigate({ to: "/app", replace: true }), 900);
    } catch (e: any) {
      setErr(e?.message ?? "Não foi possível salvar sua senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 py-16 sm:px-10">
        <a href="/" aria-label="iMAG — ir para o início" className="inline-flex items-center transition hover:opacity-90">
          <ImagLockup size={18} />
        </a>
        <h1
          className="mt-6 text-center font-sans text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl"
          style={{ fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}
        >
          Defina sua senha
        </h1>
        <p className="mt-4 max-w-[42ch] text-center text-[15px] leading-relaxed text-muted-foreground">
          Escolha uma senha segura para acessar sua conta.
        </p>

        {done ? (
          <p className="mt-10 rounded-md border border-hairline bg-surface-1 px-4 py-3 text-sm text-foreground">
            Senha atualizada. Redirecionando…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 w-full space-y-4 text-left">
            <Field
              label="Nova senha"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
            />
            <Field
              label="Confirmar senha"
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              required
            />
            {err && (
              <p className="text-center text-[13px] leading-relaxed text-destructive">{err}</p>
            )}
            <button
              type="submit"
              disabled={loading || !ready}
              className="cta-shine inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-accent px-8 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent-foreground transition hover:-translate-y-0.5 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Salvando…" : "Salvar senha"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface-1/70 px-4 py-3 transition focus-within:border-accent">
      <label className="block font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}