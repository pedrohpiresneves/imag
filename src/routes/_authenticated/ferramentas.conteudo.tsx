import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { generateInstagramCaption } from "@/lib/ai-tools.functions";
import { PaywallLock } from "@/components/PaywallLock";

export const Route = createFileRoute("/_authenticated/ferramentas/conteudo")({
  component: CaptionTool,
});

type Result = { hook: string; caption: string; cta: string; hashtags: string; images: string };

function CaptionTool() {
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<"carrossel" | "reels" | "post">("post");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => generateInstagramCaption({ data: { theme, format } }),
    onSuccess: (r) => { setResult(r); setError(null); },
    onError: (e: Error) => { setError(e.message); setResult(null); },
  });

  const fullText = result
    ? [result.hook, result.caption, result.cta, result.hashtags].filter(Boolean).join("\n\n")
    : "";

  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 04</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Laboratório de Conteúdo
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          Descreva a ideia. O MAG entrega gancho, legenda, CTA, hashtags e direção visual.
        </p>

        <PaywallLock label="Gere conteúdo após liberar seu acesso.">
          <form
            onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}
            className="mt-14 space-y-8 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-7 sm:p-10"
          >
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Sobre o que é a postagem?</p>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
                rows={3}
                placeholder="Ex.: por que cobrar barato afasta a cliente premium."
                className="w-full resize-none rounded-[14px] border border-transparent bg-[#F5F4EF] p-4 text-[15px] text-[#0A0A0A] outline-none transition placeholder:text-[#8B7355]/70 focus:border-[#C6A15B] focus:bg-white"
              />
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-[#8B7355]">Formato</p>
              <div className="flex flex-wrap gap-2">
                {(["post","carrossel","reels"] as const).map((f) => {
                  const active = format === f;
                  return (
                    <button
                      type="button"
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`rounded-full px-4 py-2 text-[13px] capitalize transition ${
                        active ? "bg-[#0A0A0A] text-white" : "border border-[rgba(0,0,0,0.1)] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={gen.isPending}
              className="w-full rounded-full bg-[#0A0A0A] py-4 text-[13px] tracking-[0.04em] text-white transition hover:bg-[#1A1A1A] disabled:opacity-30"
            >
              {gen.isPending ? "Gerando…" : "Gerar conteúdo"}
            </button>
          </form>
        </PaywallLock>

        {error && (
          <p className="mt-6 rounded-[14px] border border-[#C97064]/30 bg-[#FBF3F1] p-4 text-[14px] text-[#C97064]">{error}</p>
        )}

        {result && (
          <section className="mt-12 space-y-4 animate-fade-in">
            {result.hook && <Block label="Gancho" text={result.hook} serif />}
            <Block label="Legenda" text={result.caption} serif />
            {result.cta && <Block label="CTA" text={result.cta} serif />}
            {result.hashtags && <Block label="Hashtags" text={result.hashtags} />}
            {result.images && <Block label="Ideias de imagem" text={result.images} />}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(fullText)}
              className="w-full rounded-full border border-[rgba(0,0,0,0.12)] py-3.5 text-[13px] tracking-[0.04em] text-[#0A0A0A] transition hover:border-[#0A0A0A]"
            >
              Copiar tudo
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Block({ label, text, serif = false }: { label: string; text: string; serif?: boolean }) {
  const [copied, setCopied] = useState(false);
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
      <p className={`mt-5 whitespace-pre-wrap ${serif ? "text-[16px] leading-relaxed text-[#0A0A0A]" : "text-[14px] leading-relaxed text-[#6B6B70]"}`}>
        {text}
      </p>
    </article>
  );
}