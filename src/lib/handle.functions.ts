import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SetHandleResult =
  | { ok: true; handle: string; unchanged?: boolean }
  | { ok: false; reason: "not_authenticated" | "invalid_format" | "taken" | "cooldown"; next_allowed_at?: string };

export const checkHandleAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { handle: string }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ available: boolean; error?: string; code?: string }> => {
      // Usa o client autenticado: assim a função SQL ignora o registro do
      // próprio usuário (auth.uid()) ao editar uma identidade existente.
      const { data: ok, error } = await context.supabase.rpc("check_handle_available", {
        _handle: data.handle,
      });
      if (error) {
        return { available: false, error: error.message, code: error.code ?? "unknown" };
      }
      return { available: Boolean(ok) };
    },
  );

export const suggestHandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { base: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("suggest_handles", {
      _base: data.base,
    });
    if (error) return { suggestions: [] as string[] };
    return { suggestions: (rows as string[] | null) ?? [] };
  });

export const setMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { handle: string }) => data)
  .handler(async ({ data, context }): Promise<SetHandleResult> => {
    const { data: res, error } = await context.supabase.rpc("set_my_handle", { _handle: data.handle });
    if (error) throw new Error(error.message);
    return res as SetHandleResult;
  });

export const getMyHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("handle, handle_updated_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      handle: (data?.handle as string | null) ?? null,
      handleUpdatedAt: (data?.handle_updated_at as string | null) ?? null,
    };
  });

// Client-side normalization mirror (matches SQL normalize_handle_body)
export function normalizeHandleBody(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.+/g, ".")
    .slice(0, 30);
}

export function isValidHandleBody(h: string): boolean {
  if (h.length < 3 || h.length > 30) return false;
  if (h.startsWith(".") || h.endsWith(".")) return false;
  if (h.includes("..")) return false;
  return /^[a-z0-9._]+$/.test(h);
}