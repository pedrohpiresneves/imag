import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { MODULES } from "@/lib/modules";
import {
  listPodcastAdmin,
  deletePodcastAudio,
  regenerateModuleAudio,
  syncAllChaptersAudio,
  getPodcastSettings,
  setDefaultVoice,
  previewVoice,
  OPENAI_TTS_VOICES,
  type PodcastRow,
} from "@/lib/podcast/podcast.functions";

export const Route = createFileRoute("/_authenticated/admin/podcasts")({
  component: AdminPodcasts,
  errorComponent: ({ error }) => <AdminPodcastsError message={error?.message} />,
});

function formatBytes(n: number | null): string {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AdminPodcasts() {
  const qc = useQueryClient();
  const generating = false; // placeholder, computed after query
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin", "podcasts"],
    queryFn: (): Promise<PodcastRow[]> => listPodcastAdmin(),
    retry: false,
    // Poll while anything is generating so the progress bar advances.
    refetchInterval: (q) => {
      const list = (q.state.data ?? []) as PodcastRow[];
      return list.some((r) => r.status === "generating") ? 1500 : false;
    },
  });

  const { data: settings, error: settingsError } = useQuery({
    queryKey: ["admin", "podcast_settings"],
    queryFn: () => getPodcastSettings(),
    retry: false,
    enabled: !error,
  });

  const bySlug = new Map(rows.map((r) => [r.module_slug, r]));

  const removeMut = useMutation({
    mutationFn: (slug: string) => deletePodcastAudio({ data: { module_slug: slug } }),
    onSuccess: () => {
      toast.success("Áudio removido.");
      qc.invalidateQueries({ queryKey: ["admin", "podcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenMut = useMutation({
    mutationFn: (slug: string) =>
      regenerateModuleAudio({ data: { module_slug: slug } }),
    onMutate: () => {
      qc.invalidateQueries({ queryKey: ["admin", "podcasts"] });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Áudio regenerado.");
      } else {
        toast.error(`Falha: ${res.error}. Áudio anterior mantido.`);
      }
      qc.invalidateQueries({ queryKey: ["admin", "podcasts"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["admin", "podcasts"] });
    },
  });

  const syncAllMut = useMutation({
    mutationFn: () => syncAllChaptersAudio(),
    onMutate: () => qc.invalidateQueries({ queryKey: ["admin", "podcasts"] }),
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const failed = res.results.length - ok;
      if (res.processed === 0) toast.success("Todos os capítulos já estão sincronizados.");
      else if (failed === 0) toast.success(`${ok} capítulo(s) regenerado(s).`);
      else toast.warning(`${ok} regenerado(s), ${failed} falharam.`);
      qc.invalidateQueries({ queryKey: ["admin", "podcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const firstError = (error ?? settingsError) as Error | null;
  if (firstError) {
    return <AdminPodcastsError message={firstError.message} />;
  }

  const busy = rows.some((r) => r.status === "generating") || syncAllMut.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Admin · MAGCast
        </p>
        <h1 className="mt-3 font-serif text-3xl italic text-accent">
          Narração IA dos capítulos
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
          Os áudios são gerados automaticamente por IA (OpenAI TTS via Lovable AI)
          a partir do texto do capítulo e ficam em cache no bucket{" "}
          <code className="font-mono text-xs">podcasts</code>. Se uma geração
          falhar, o áudio anterior continua disponível para os alunos.
        </p>

        <VoiceSettingsCard settings={settings ?? null} disabled={busy} />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => syncAllMut.mutate()}
            disabled={busy}
            className="rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--accent)] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {syncAllMut.isPending ? "Sincronizando…" : "Sincronizar todos"}
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Regenera apenas capítulos com texto alterado ou em erro.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {isLoading && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Carregando…
            </p>
          )}
          {MODULES.map((m) => (
            <PodcastRowCard
              key={m.slug}
              number={m.number}
              title={m.title}
              slug={m.slug}
              row={bySlug.get(m.slug) ?? null}
              regenerate={() => regenMut.mutate(m.slug)}
              regenerating={
                regenMut.isPending && regenMut.variables === m.slug
              }
              onDelete={() => removeMut.mutate(m.slug)}
              deleting={removeMut.isPending && removeMut.variables === m.slug}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function VoiceSettingsCard({
  settings,
  disabled,
}: {
  settings: { default_voice: string; voices: string[] } | null;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(settings?.default_voice ?? "nova");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep local selection in sync when settings load
  if (settings && selected === "nova" && settings.default_voice !== selected && !audioRef.current) {
    // one-shot alignment — no useEffect needed for this simple case
    setSelected(settings.default_voice);
  }

  const voices = settings?.voices ?? (OPENAI_TTS_VOICES as unknown as string[]);

  const previewMut = useMutation({
    mutationFn: (voice: string) => previewVoice({ data: { voice: voice as never } }),
    onMutate: (voice) => setPreviewingVoice(voice),
    onSuccess: (res) => {
      const a = new Audio(res.audio_data_url);
      audioRef.current?.pause();
      audioRef.current = a;
      void a.play();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPreviewingVoice(null),
  });

  const saveMut = useMutation({
    mutationFn: (voice: string) => setDefaultVoice({ data: { voice: voice as never } }),
    onSuccess: () => {
      toast.success("Voz padrão atualizada. Use 'Sincronizar todos' para regenerar.");
      qc.invalidateQueries({ queryKey: ["admin", "podcast_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-8 rounded-lg border border-border bg-surface-1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Voz padrão da narração
          </p>
          <p className="mt-1 font-serif text-lg italic">
            OpenAI TTS · <span className="text-accent">{selected}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => saveMut.mutate(selected)}
          disabled={disabled || saveMut.isPending || selected === settings?.default_voice}
          className="rounded-full border border-[color:var(--accent)]/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10 disabled:opacity-40"
        >
          {saveMut.isPending ? "Salvando…" : "Definir como padrão"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {voices.map((v) => {
          const active = v === selected;
          const isPrev = previewingVoice === v;
          return (
            <div key={v} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelected(v)}
                className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
              <button
                type="button"
                onClick={() => previewMut.mutate(v)}
                disabled={previewMut.isPending}
                aria-label={`Ouvir prévia da voz ${v}`}
                className="rounded-full border border-border px-2 py-1.5 text-[10px] text-muted-foreground transition hover:text-[color:var(--accent)] disabled:opacity-40"
              >
                {isPrev ? "…" : "▶"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodcastRowCard({
  slug,
  number,
  title,
  row,
  regenerate,
  regenerating,
  onDelete,
  deleting,
}: {
  slug: string;
  number: number;
  title: string;
  row: PodcastRow | null;
  regenerate: () => void;
  regenerating: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const status = row?.status ?? "idle";
  const hasAudio = !!row?.storage_path;
  const isGenerating = status === "generating" || regenerating;
  const progress = row?.progress ?? 0;

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Capítulo {String(number).padStart(2, "0")} · {slug}
          </p>
          <p className="mt-1 font-serif text-lg italic">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <StatusPill status={status} hasAudio={hasAudio} />
            {row?.voice_id && <span>voz: {row.voice_id}</span>}
            <span>{formatDuration(row?.duration_seconds ?? null)}</span>
            <span>{formatBytes(row?.size_bytes ?? null)}</span>
            {row?.last_generated_at && (
              <span>gerado {new Date(row.last_generated_at).toLocaleString("pt-BR")}</span>
            )}
          </div>
          {status === "error" && row?.error_message && (
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-destructive">
              Erro: {row.error_message}
            </p>
          )}
          {isGenerating && (
            <div className="mt-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[color:var(--accent)] transition-all"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Gerando narração… {progress}%
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={isGenerating}
            className="rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--accent)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {isGenerating ? "Gerando…" : hasAudio ? "Regenerar" : "Gerar áudio"}
          </button>
          {hasAudio && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Remover o áudio deste capítulo?")) onDelete();
              }}
              disabled={deleting || isGenerating}
              className="rounded-full border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-destructive disabled:opacity-50"
            >
              {deleting ? "Removendo…" : "Excluir"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  hasAudio,
}: {
  status: PodcastRow["status"];
  hasAudio: boolean;
}) {
  const label =
    status === "generating"
      ? "gerando"
      : status === "error"
        ? hasAudio
          ? "erro · áudio anterior no ar"
          : "erro"
        : hasAudio
          ? "no ar"
          : "sem áudio";
  const cls =
    status === "error"
      ? "border-destructive/50 text-destructive"
      : status === "generating"
        ? "border-[color:var(--accent)]/60 text-[color:var(--accent)]"
        : hasAudio
          ? "border-emerald-500/40 text-emerald-400"
          : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 ${cls}`}>{label}</span>
  );
}

function AdminPodcastsError({ message }: { message?: string }) {
  const denied = !!message && /acesso negado|forbidden|unauthorized/i.test(message);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Admin · MAGCast
        </p>
        <h1 className="mt-4 font-serif text-3xl italic text-accent">
          {denied ? "Acesso negado" : "Não foi possível carregar"}
        </h1>
        <p className="mt-4 font-serif italic text-muted-foreground">
          {denied
            ? "Sua conta não tem permissão de administrador para acessar este painel."
            : message || "Ocorreu um erro inesperado. Tente novamente em instantes."}
        </p>
      </main>
    </div>
  );
}