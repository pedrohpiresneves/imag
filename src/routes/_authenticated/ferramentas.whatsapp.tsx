import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { generateWhatsappMessages } from "@/lib/ai-tools.functions";
import { PaywallLock } from "@/components/PaywallLock";

export const Route = createFileRoute("/_authenticated/ferramentas/whatsapp")({
  component: WhatsappTool,
});

const OBJECTIVES = [
  { id: "cobranca", label: "Cobrança" },
  { id: "retorno", label: "Retorno de paciente" },
  { id: "fechamento", label: "Fechamento" },
  { id: "pos-venda", label: "Pós-venda" },
  { id: "recuperacao-lead", label: "Recuperação de lead" },
  { id: "indicacao", label: "Indicação" },
] as const;

const TONES = [
  { id: "elegante", label: "Elegante" },
  { id: "acolhedor", label: "Acolhedor" },
  { id: "direto", label: "Direto" },
  { id: "provocador", label: "Provocador" },
] as const;

type Objective = (typeof OBJECTIVES)[number]["id"];
type Tone = (typeof TONES)[number]["id"];
type Result = { elegante: string; persuasiva: string; objetiva: string };

function WhatsappTool() {
  const [objective, setObjective] = useState<Objective>("retorno");
  const [tone, setTone] = useState<Tone>("elegante");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill vindo da Home (MAG Meta 1 → "Aplicar agora").
  useEffect(() => {
    try {
      const pre = sessionStorage.getItem("wa_prefill");
      if (pre && pre.trim()) {
        setContext(pre.trim());
        sessionStorage.removeItem("wa_prefill");
      }
    } catch {}
  }, []);

  const gen = useMutation({
    mutationFn: () => generateWhatsappMessages({ data: { objective, tone, context } }),
    onSuccess: (r) => { setResult(r); setError(null); },
    onError: (e: Error) => { setError(e.message); setResult(null); },
  });

  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 03</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Mensagens Magnéticas
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          Escolha o objetivo e o MAG entrega três versões prontas: elegante, persuasiva e objetiva.
        </p>

        <PaywallLock label="Gere mensagens de WhatsApp após liberar seu acesso.">
          <form
            onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}
            className="mt-14 space-y-8 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-7 sm:p-10"
          >
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Objetivo</p>
              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map((o) => {
                  const active = objective === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setObjective(o.id)}
                      className={`rounded-full px-4 py-2 text-[13px] transition ${
                        active
                          ? "bg-[#0A0A0A] text-white"
                          : "border border-[rgba(0,0,0,0.1)] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Tom</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => {
                  const active = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`rounded-full px-4 py-2 text-[13px] transition ${
                        active
                          ? "bg-[#0A0A0A] text-white"
                          : "border border-[rgba(0,0,0,0.1)] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Contexto (opcional)</p>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="Ex.: cliente sumiu há 30 dias após harmonização facial."
                className="w-full resize-none rounded-[14px] border border-transparent bg-[#F5F4EF] p-4 text-[15px] text-[#0A0A0A] outline-none transition placeholder:text-[#8B7355]/70 focus:border-[#C6A15B] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={gen.isPending}
              className="w-full rounded-full bg-[#0A0A0A] py-4 text-[13px] tracking-[0.04em] text-white transition hover:bg-[#1A1A1A] disabled:opacity-30"
            >
              {gen.isPending ? "Gerando…" : "Gerar 3 mensagens"}
            </button>
          </form>
        </PaywallLock>

        {error && (
          <p className="mt-6 rounded-[14px] border border-[#C97064]/30 bg-[#FBF3F1] p-4 text-[14px] text-[#C97064]">{error}</p>
        )}

        {result && (
          <section className="mt-12 space-y-4 animate-fade-in">
            <MessageCard label="Elegante" text={result.elegante} />
            <MessageCard label="Persuasiva" text={result.persuasiva} />
            <MessageCard label="Objetiva" text={result.objetiva} />
          </section>
        )}
      </main>
    </div>
  );
}

function MessageCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <article className="rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#8B7355]">{label}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-full border border-[rgba(0,0,0,0.12)] px-3.5 py-1.5 text-[11px] tracking-[0.04em] text-[#0A0A0A] transition hover:border-[#0A0A0A]"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-[16px] leading-relaxed text-[#0A0A0A]">{text}</p>
    </article>
  );
}