import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

/** Conversas do usuário, fixadas primeiro. */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mentor_conversations")
      .select("id, title, pinned, last_message_at, created_at")
      .order("pinned", { ascending: false })
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: msgs } = await context.supabase
      .from("mentor_messages")
      .select("conversation_id, content, created_at")
      .in(
        "conversation_id",
        rows.map((r) => r.id),
      )
      .order("created_at", { ascending: true })
      .limit(2000);

    const preview = new Map<string, string>();
    for (const m of msgs ?? []) {
      const cid = m.conversation_id as string | null;
      if (!cid || preview.has(cid)) continue;
      preview.set(cid, (m.content ?? "").slice(0, 140));
    }

    return rows.map((r) => ({ ...r, preview: preview.get(r.id) ?? "" }));
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mentor_conversations")
      .insert({ user_id: context.userId, title: "Nova conversa" })
      .select("id, title, pinned, last_message_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => IdInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("mentor_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    IdInput.extend({
      title: z.string().trim().min(1).max(80).optional(),
      pinned: z.boolean().optional(),
    }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const patch: { title?: string; pinned?: boolean } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("mentor_conversations")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mensagens de uma conversa (ou as legadas, sem conversa). */
export const loadMentorHistory = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ conversation_id: z.string().uuid().nullable().optional() }).parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("mentor_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    query = data.conversation_id
      ? query.eq("conversation_id", data.conversation_id)
      : query.is("conversation_id", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SaveInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  conversation_id: z.string().uuid().nullable().optional(),
});

function autoTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 42) return clean;
  return `${clean.slice(0, 42).trimEnd()}…`;
}

export const saveMentorMessage = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SaveInput.parse(raw))
  .handler(async ({ context, data }) => {
    const conversationId = data.conversation_id ?? null;
    const { error } = await context.supabase.from("mentor_messages").insert({
      user_id: context.userId,
      role: data.role,
      content: data.content,
      conversation_id: conversationId,
    });
    if (error) throw new Error(error.message);

    if (conversationId) {
      const patch: { last_message_at: string; title?: string } = {
        last_message_at: new Date().toISOString(),
      };
      if (data.role === "user") {
        const { data: conv } = await context.supabase
          .from("mentor_conversations")
          .select("title")
          .eq("id", conversationId)
          .maybeSingle();
        if (!conv?.title || conv.title === "Nova conversa") patch.title = autoTitle(data.content);
      }
      await context.supabase
        .from("mentor_conversations")
        .update(patch)
        .eq("id", conversationId)
        .eq("user_id", context.userId);
    }
    return { ok: true };
  });

export const clearMentorHistory = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("mentor_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
