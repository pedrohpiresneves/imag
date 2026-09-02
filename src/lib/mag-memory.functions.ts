import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deriveFacts,
  getOrCreateQuestion,
  loadMemoryFacts,
  questionMeta,
  recordSignal,
  upsertFact,
  type MemoryFact,
  type PendingQuestion,
} from "./mag/memory.server";

export type MagMemory = {
  facts: MemoryFact[];
  question: PendingQuestion | null;
};

/** Observa: registra um sinal comportamental leve durante o uso normal. */
export const recordMagSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        kind: z.string().min(2).max(60),
        subject: z.string().max(200).optional(),
        value: z.record(z.string(), z.unknown()).optional(),
        local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await recordSignal(context.supabase as never, context.userId, {
      kind: data.kind,
      subject: data.subject ?? null,
      value: (data.value ?? {}) as Record<string, unknown>,
      local_date: data.local_date ?? null,
    });
    return { ok: true };
  });

/** Aprende: deriva fatos dos sinais e devolve a memória + pergunta pendente. */
export const getMagMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MagMemory> => {
    const db = context.supabase as never;
    try {
      await deriveFacts(db, context.userId);
    } catch (e) {
      console.error("[mag-memory] derive_failed", e);
    }
    const facts = await loadMemoryFacts(db, context.userId);
    let question: PendingQuestion | null = null;
    try {
      question = await getOrCreateQuestion(db, context.userId, facts);
    } catch (e) {
      console.error("[mag-memory] question_failed", e);
    }
    return { facts, question };
  });

/** Pergunta pouco: resposta vira fato de alta confiança. */
export const answerMagQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), answer: z.string().min(1).max(200) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as never;
    const { data: q } = await (db as never as typeof context.supabase)
      .from("mag_memory_questions")
      .select("id, fact_key, question")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!q) return { ok: false };
    await (db as never as typeof context.supabase)
      .from("mag_memory_questions")
      .update({ status: "answered", answer: data.answer, answered_at: new Date().toISOString() })
      .eq("id", data.id);
    const meta = questionMeta((q as { fact_key: string }).fact_key);
    await upsertFact(db, context.userId, {
      key: (q as { fact_key: string }).fact_key,
      category: meta?.category ?? "preferencia",
      label: meta?.label ?? "Preferência",
      value: data.answer,
      confidence: 0.95,
      source: "asked",
    });
    return { ok: true };
  });

export const dismissMagQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("mag_memory_questions")
      .update({ status: "dismissed", answered_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** O usuário corrige o que a MAG aprendeu. */
export const updateMagFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), value: z.string().min(1).max(300) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("mag_memory")
      .update({ value: data.value, source: "user", confidence: 1 })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** O usuário remove algo que a MAG aprendeu. */
export const deleteMagFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("mag_memory")
      .update({ status: "removed", source: "user" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Apaga toda a memória comportamental. */
export const clearMagMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("mag_memory").delete().eq("user_id", context.userId);
    await context.supabase.from("mag_signals").delete().eq("user_id", context.userId);
    return { ok: true };
  });
