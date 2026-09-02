import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await (context.supabase as any).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Acesso negado");
}

export type AmbassadorRow = {
  email: string;
  note: string | null;
  created_at: string;
  /** true quando já existe uma conta criada com esse e-mail. */
  registered: boolean;
  full_name: string | null;
};

export const listAmbassadorEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AmbassadorRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ambassador_emails")
      .select("email, note, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .in(
        "email",
        rows.map((r) => r.email),
      );
    const byEmail = new Map(
      (profiles ?? []).map((p) => [(p.email ?? "").toLowerCase(), p.full_name ?? null]),
    );
    return rows.map((r) => ({
      ...r,
      registered: byEmail.has(r.email),
      full_name: byEmail.get(r.email) ?? null,
    }));
  });

const AddInput = z.object({
  email: z.string().trim().email().max(255),
  note: z.string().trim().max(160).optional(),
});

export const addAmbassadorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AddInput.parse(raw))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ambassador_emails")
      .upsert(
        { email, note: data.note ?? null, created_by: context.userId },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);

    // Se a conta já existe, marca o perfil como embaixador imediatamente.
    await supabaseAdmin
      .from("profiles")
      .update({
        has_access: true,
        access_type: "ambassador",
        access_granted_at: new Date().toISOString(),
      })
      .eq("email", email);

    return { ok: true as const, email };
  });

export const removeAmbassadorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ email: z.string().email() }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ambassador_emails")
      .delete()
      .eq("email", email);
    if (error) throw new Error(error.message);

    // Remove apenas a cortesia de embaixador; não altera assinaturas reais.
    await supabaseAdmin
      .from("profiles")
      .update({ has_access: false, access_type: null, access_granted_at: null })
      .eq("email", email)
      .eq("access_type", "ambassador");

    return { ok: true as const };
  });