import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODULES } from "@/lib/modules";

// OpenAI TTS voices supported via Lovable AI Gateway (openai/gpt-4o-mini-tts).
export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;
export type OpenAiVoice = (typeof OPENAI_TTS_VOICES)[number];

const TTS_MODEL = "openai/gpt-4o-mini-tts";
const TTS_INSTRUCTIONS =
  "Narre em português brasileiro com voz calma, sofisticada e acolhedora. Ritmo pausado, tom premium, pronúncia clara. Faça pausas naturais entre parágrafos.";
const CHUNK_MAX_CHARS = 1600;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso negado");
}

function buildChapterText(slug: string): string | null {
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) return null;
  const parts: string[] = [];
  parts.push(`Capítulo ${m.number}. ${m.title}.`);
  if (m.subtitle) parts.push(m.subtitle);
  parts.push(m.intro);
  for (const p of m.paragraphs) parts.push(p);
  if (m.quote) parts.push(`Reflexão final: ${m.quote}`);
  return parts.join("\n\n");
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chunkText(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]?\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = "";
      for (let i = 0; i < s.length; i += maxChars) {
        chunks.push(s.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if ((cur + s).length > maxChars) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 0);
}

async function ttsChunkToMp3(
  chunk: string,
  voice: string,
  apiKey: string,
): Promise<Uint8Array> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: chunk,
      voice,
      instructions: TTS_INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS ${res.status}: ${body.slice(0, 300)}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export type PodcastRow = {
  module_slug: string;
  storage_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  content_type: string | null;
  updated_at: string;
  text_hash: string | null;
  voice_id: string | null;
  status: "idle" | "generating" | "ready" | "error";
  error_message: string | null;
  progress: number;
  last_generated_at: string | null;
};

export const listPodcastAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PodcastRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("module_audio")
      .select(
        "module_slug, storage_path, duration_seconds, size_bytes, content_type, updated_at, text_hash, voice_id, status, error_message, progress, last_generated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PodcastRow[];
  });

// Settings ------------------------------------------------------------------

export const getPodcastSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("podcast_settings")
      .select("default_voice, updated_at")
      .eq("id", 1)
      .maybeSingle();
    return {
      default_voice: (data?.default_voice ?? "nova") as OpenAiVoice,
      updated_at: data?.updated_at ?? null,
      voices: OPENAI_TTS_VOICES as unknown as string[],
    };
  });

export const setDefaultVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ voice: z.enum(OPENAI_TTS_VOICES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("podcast_settings")
      .upsert({ id: 1, default_voice: data.voice }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Voice preview -------------------------------------------------------------

export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        voice: z.enum(OPENAI_TTS_VOICES),
        text: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
    const sample =
      data.text?.trim() ||
      "Bem-vindo à Agenda Magnética. Este é um teste da voz que será usada para narrar os capítulos do manual.";
    const bytes = await ttsChunkToMp3(sample, data.voice, apiKey);
    // Return base64 data URL (small: ~30 KB) so the client can play it directly.
    const b64 = Buffer.from(bytes).toString("base64");
    return { audio_data_url: `data:audio/mpeg;base64,${b64}` };
  });

// Regeneration --------------------------------------------------------------

async function performRegeneration(
  slug: string,
  voiceOverride: string | null,
): Promise<{ ok: true; slug: string } | { ok: false; slug: string; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const text = buildChapterText(slug);
  if (!text) return { ok: false, slug, error: "Capítulo não encontrado" };

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, slug, error: "LOVABLE_API_KEY ausente" };

  // Resolve voice
  let voice = voiceOverride;
  if (!voice) {
    const { data: settings } = await supabaseAdmin
      .from("podcast_settings")
      .select("default_voice")
      .eq("id", 1)
      .maybeSingle();
    voice = (settings?.default_voice as string | undefined) ?? "nova";
  }

  const hash = await sha256Hex(`${voice}::${text}`);
  const chunks = chunkText(text);

  // Mark generating (but DO NOT touch storage_path — students keep hearing the previous file)
  await supabaseAdmin
    .from("module_audio")
    .upsert(
      {
        module_slug: slug,
        status: "generating",
        error_message: null,
        progress: 0,
        generation_started_at: new Date().toISOString(),
      },
      { onConflict: "module_slug" },
    );

  try {
    const mp3Parts: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const bytes = await ttsChunkToMp3(chunks[i], voice, apiKey);
      mp3Parts.push(bytes);
      const progress = Math.min(
        99,
        Math.round(((i + 1) / chunks.length) * 95),
      );
      await supabaseAdmin
        .from("module_audio")
        .update({ progress })
        .eq("module_slug", slug);
    }

    const total = mp3Parts.reduce((a, b) => a + b.length, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const p of mp3Parts) {
      merged.set(p, off);
      off += p.length;
    }

    const path = `${slug}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("podcasts")
      .upload(path, merged, {
        upsert: true,
        contentType: "audio/mpeg",
        cacheControl: "3600",
      });
    if (upErr) throw new Error(upErr.message);

    // Rough duration estimate: 150 wpm PT-BR → chars/900 minutes
    const estSeconds = Math.round((text.length / 900) * 60);

    await supabaseAdmin.from("module_audio").upsert(
      {
        module_slug: slug,
        storage_path: path,
        content_type: "audio/mpeg",
        size_bytes: merged.length,
        duration_seconds: estSeconds,
        voice_id: voice,
        text_hash: hash,
        status: "ready",
        error_message: null,
        progress: 100,
        last_generated_at: new Date().toISOString(),
      },
      { onConflict: "module_slug" },
    );
    return { ok: true, slug };
  } catch (e) {
    const msg = (e as Error).message ?? "Falha desconhecida";
    // Keep previous storage_path intact → students continue hearing the old audio.
    await supabaseAdmin
      .from("module_audio")
      .update({
        status: "error",
        error_message: msg.slice(0, 500),
        progress: 0,
      })
      .eq("module_slug", slug);
    return { ok: false, slug, error: msg };
  }
}

export const regenerateModuleAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        module_slug: z.string().min(1),
        voice: z.enum(OPENAI_TTS_VOICES).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return performRegeneration(data.module_slug, data.voice ?? null);
  });

/** Regenerates every chapter whose text hash differs from the stored one (or that has no audio yet). */
export const syncAllChaptersAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("module_audio")
      .select("module_slug, text_hash, voice_id, status");
    const { data: settings } = await supabaseAdmin
      .from("podcast_settings")
      .select("default_voice")
      .eq("id", 1)
      .maybeSingle();
    const voice = (settings?.default_voice as string) ?? "nova";
    const byslug = new Map(
      (rows ?? []).map((r) => [r.module_slug, r as { text_hash: string | null; voice_id: string | null; status: string }]),
    );

    const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
    for (const m of MODULES) {
      const text = buildChapterText(m.slug)!;
      const expected = await sha256Hex(`${voice}::${text}`);
      const row = byslug.get(m.slug);
      const needs = !row || row.text_hash !== expected || row.status === "error";
      if (!needs) continue;
      const r = await performRegeneration(m.slug, voice);
      results.push({ slug: m.slug, ok: r.ok, error: r.ok ? undefined : r.error });
    }
    return { processed: results.length, results };
  });

export const deletePodcastAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ module_slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("module_audio")
      .select("storage_path")
      .eq("module_slug", data.module_slug)
      .maybeSingle();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("podcasts").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("module_audio")
      .delete()
      .eq("module_slug", data.module_slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getModuleAudioSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ module_slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // gate on paid access
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("has_access")
      .eq("id", context.userId)
      .maybeSingle();
    // allow admins even without has_access
    let allowed = !!profile?.has_access;
    if (!allowed) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      allowed = !!roleRow;
    }
    if (!allowed) throw new Error("Acesso restrito ao Modo Podcast.");

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("module_audio")
      .select("storage_path, duration_seconds, content_type")
      .eq("module_slug", data.module_slug)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row?.storage_path) throw new Error("Áudio ainda não disponível.");

    const EXPIRES = 60 * 60 * 6; // 6h
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("podcasts")
      .createSignedUrl(row.storage_path, EXPIRES);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "Não foi possível gerar o link.");

    return {
      url: signed.signedUrl,
      duration_seconds: row.duration_seconds,
      content_type: row.content_type,
    };
  });