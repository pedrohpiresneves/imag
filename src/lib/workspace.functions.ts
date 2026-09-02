import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- weekly tasks
export const listWeeklyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("weekly_tasks")
      .select("id, title, done, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWeeklyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ title: z.string().min(1).max(200) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("weekly_tasks")
      .insert({ user_id: context.userId, title: data.title });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleWeeklyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("weekly_tasks")
      .update({ done: data.done })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWeeklyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("weekly_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- activity log
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("activity_log")
      .select("id, kind, ref, label, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// -------- checklist
export const loadChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("checklist_state")
      .select("item_key, done");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ item_key: z.string().min(1), done: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("checklist_state")
      .upsert(
        { user_id: context.userId, item_key: data.item_key, done: data.done },
        { onConflict: "user_id,item_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- notes
export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notes")
      .select("id, title, body, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().max(200).default(""),
        body: z.string().max(20000).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("notes")
        .update({ title: data.title, body: data.body })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("notes")
      .insert({ user_id: context.userId, title: data.title, body: data.body })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });