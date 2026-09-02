import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  // Role check runs with service_role (bypasses RLS) so the check itself
  // cannot be circumvented by a signed-in user tampering with policies.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso negado");
}

export const adminListAmbassadors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ambassadors")
      .select("user_id, code, tier, status, pix_key, terms_accepted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const userIds = rows.map((r) => r.user_id);
    const emails: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      (profiles ?? []).forEach((p) => {
        if (p.email) emails[p.id] = p.email;
      });
    }
    return rows.map((r) => ({ ...r, email: emails[r.user_id] ?? "" }));
  });

const setStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "blocked", "pending_review"]),
});
export const adminSetAmbassadorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setStatusSchema>) => setStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ambassadors").update({ status: data.status }).eq("user_id", data.userId);
    return { ok: true };
  });

export const adminListCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("referral_commissions")
      .select("id, ambassador_user_id, amount_cents, status, created_at, release_at, order_id")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

const commissionActionSchema = z.object({
  commissionId: z.string().uuid(),
  action: z.enum(["release", "reverse", "cancel"]),
  reason: z.string().optional(),
});
export const adminCommissionAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof commissionActionSchema>) => commissionActionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.action === "release"
        ? { status: "available" as const, released_at: new Date().toISOString() }
        : data.action === "reverse"
        ? { status: "reversed" as const, reversed_at: new Date().toISOString(), reversal_reason: data.reason ?? "manual" }
        : { status: "cancelled" as const, reversal_reason: data.reason ?? "manual" };
    await supabaseAdmin.from("referral_commissions").update(patch).eq("id", data.commissionId);
    return { ok: true };
  });

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payouts")
      .select("id, ambassador_user_id, amount_cents, status, method, pix_key_snapshot, provider_ref, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

const markPayoutSchema = z.object({
  payoutId: z.string().uuid(),
  status: z.enum(["processing", "paid", "failed"]),
  providerRef: z.string().optional(),
  notes: z.string().optional(),
});
export const adminMarkPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof markPayoutSchema>) => markPayoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payouts")
      .update({
        status: data.status,
        provider_ref: data.providerRef ?? null,
        notes: data.notes ?? null,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", data.payoutId);
    if (data.status === "paid") {
      await supabaseAdmin
        .from("referral_commissions")
        .update({ status: "paid" })
        .eq("payout_id", data.payoutId);
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("referral_settings").select("*").eq("id", 1).single();
    return data;
  });

const settingsSchema = z.object({
  default_rate_bps: z.number().int().min(0).max(10000),
  guarantee_days: z.number().int().min(0).max(90),
  cookie_days: z.number().int().min(1).max(365),
  min_payout_cents: z.number().int().min(100).max(10_000_000),
});
export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof settingsSchema>) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("referral_settings")
      .update({ ...data, updated_by: context.userId, updated_at: new Date().toISOString() })
      .eq("id", 1);
    const { invalidateSettingsCache } = await import("./settings.server");
    invalidateSettingsCache();
    return { ok: true };
  });

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("referral_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  rate_bps: z.number().int().min(0).max(10000),
  starts_at: z.string(),
  ends_at: z.string(),
  code: z.string().optional(),
  active: z.boolean().default(true),
});
export const adminUpsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof campaignSchema>) => campaignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      await supabaseAdmin.from("referral_campaigns").update(data).eq("id", data.id);
    } else {
      await supabaseAdmin.from("referral_campaigns").insert(data);
    }
    return { ok: true };
  });

export const adminListFraudFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("fraud_flags")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

const resolveFraudSchema = z.object({ id: z.string().uuid(), notes: z.string().optional() });
export const adminResolveFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resolveFraudSchema>) => resolveFraudSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("fraud_flags")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
        notes: data.notes,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminRunRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { releaseDueCommissions } = await import("./commissions.server");
    return releaseDueCommissions();
  });

export const adminExportCommissionsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("referral_commissions")
      .select("id, ambassador_user_id, order_id, amount_cents, status, created_at, released_at, reversed_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    const header = "id,ambassador_user_id,order_id,amount_cents,status,created_at,released_at,reversed_at\n";
    const body = (data ?? [])
      .map((r) =>
        [r.id, r.ambassador_user_id, r.order_id, r.amount_cents, r.status, r.created_at, r.released_at ?? "", r.reversed_at ?? ""].join(","),
      )
      .join("\n");
    return header + body;
  });