import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MagPrefs = {
  enabled: boolean;
  direction: boolean;
  appointments: boolean;
  priorities: boolean;
  checkin: boolean;
  dayClose: boolean;
  dayCloseHour: number;
  insights: boolean;
  quietStart: number;
  quietEnd: number;
  timezone: string;
  dailyLimit: number;
  lockScreenPrivacy: "context" | "minimal";
};

/** Chave pública VAPID (segura no cliente). */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: process.env["WEBPUSH_PUBLIC_KEY"] ?? null,
}));

export const getMagPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MagPrefs & { devices: number }> => {
    const [{ data }, { count }] = await Promise.all([
      context.supabase
        .from("notification_preferences")
        .select(
          "enabled, direction_enabled, appointments_enabled, priorities_enabled, checkin_enabled, day_close_enabled, day_close_hour, insights_enabled, quiet_hours_start, quiet_hours_end, timezone, daily_limit, lock_screen_privacy",
        )
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("enabled", true)
        .is("revoked_at", null),
    ]);

    return {
      enabled: data?.enabled ?? false,
      direction: data?.direction_enabled ?? true,
      appointments: data?.appointments_enabled ?? true,
      priorities: data?.priorities_enabled ?? true,
      checkin: data?.checkin_enabled ?? true,
      dayClose: data?.day_close_enabled ?? true,
      dayCloseHour: data?.day_close_hour ?? 20,
      insights: data?.insights_enabled ?? true,
      quietStart: data?.quiet_hours_start ?? 22,
      quietEnd: data?.quiet_hours_end ?? 8,
      timezone: data?.timezone ?? "America/Sao_Paulo",
      dailyLimit: data?.daily_limit ?? 2,
      lockScreenPrivacy:
        (data?.lock_screen_privacy as "context" | "minimal" | undefined) ?? "context",
      devices: count ?? 0,
    };
  });

export type MagPrefsPatch = Partial<MagPrefs>;

export const updateMagPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MagPrefsPatch) => input ?? {})
  .handler(async ({ data, context }) => {
    const clampHour = (v: unknown) => Math.min(23, Math.max(0, Math.round(Number(v) || 0)));
    const patch: Record<string, unknown> = { user_id: context.userId };
    if (data.enabled !== undefined) patch["enabled"] = Boolean(data.enabled);
    if (data.direction !== undefined) patch["direction_enabled"] = Boolean(data.direction);
    if (data.appointments !== undefined) patch["appointments_enabled"] = Boolean(data.appointments);
    if (data.priorities !== undefined) patch["priorities_enabled"] = Boolean(data.priorities);
    if (data.checkin !== undefined) patch["checkin_enabled"] = Boolean(data.checkin);
    if (data.dayClose !== undefined) patch["day_close_enabled"] = Boolean(data.dayClose);
    if (data.dayCloseHour !== undefined) patch["day_close_hour"] = clampHour(data.dayCloseHour);
    if (data.insights !== undefined) patch["insights_enabled"] = Boolean(data.insights);
    if (data.quietStart !== undefined) patch["quiet_hours_start"] = clampHour(data.quietStart);
    if (data.quietEnd !== undefined) patch["quiet_hours_end"] = clampHour(data.quietEnd);
    if (data.timezone) patch["timezone"] = String(data.timezone).slice(0, 64);
    if (data.dailyLimit !== undefined)
      patch["daily_limit"] = Math.min(5, Math.max(1, Math.round(Number(data.dailyLimit) || 2)));
    if (data.lockScreenPrivacy)
      patch["lock_screen_privacy"] = data.lockScreenPrivacy === "minimal" ? "minimal" : "context";

    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(patch as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      deviceLabel?: string;
      platform?: string;
      timezone?: string;
    }) => {
      const endpoint = String(input?.endpoint ?? "").trim();
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000)
        throw new Error("endpoint inválido");
      const p256dh = String(input?.p256dh ?? "").trim();
      const auth = String(input?.auth ?? "").trim();
      if (p256dh.length < 20 || auth.length < 8) throw new Error("chaves inválidas");
      return {
        endpoint,
        p256dh,
        auth,
        deviceLabel: (input?.deviceLabel ?? "").slice(0, 80) || null,
        platform: (input?.platform ?? "web").slice(0, 24),
        timezone: (input?.timezone ?? "").slice(0, 64) || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        subscription_id: data.endpoint,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        device_label: data.deviceLabel,
        platform: data.platform,
        enabled: true,
        revoked_at: null,
      },
      { onConflict: "subscription_id" },
    );
    if (error) throw new Error(error.message);

    await context.supabase.from("notification_preferences").upsert(
      {
        user_id: context.userId,
        enabled: true,
        ...(data.timezone ? { timezone: data.timezone } : {}),
      } as never,
      { onConflict: "user_id" },
    );
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint?: string } | undefined) => ({
    endpoint: input?.endpoint ? String(input.endpoint).slice(0, 1000) : null,
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("push_subscriptions")
      .update({ enabled: false, revoked_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (data.endpoint) q = q.eq("endpoint", data.endpoint);
    await q;
    await context.supabase
      .from("notification_preferences")
      .upsert({ user_id: context.userId, enabled: false } as never, { onConflict: "user_id" });
    return { ok: true };
  });

/** Notificação de teste do próprio usuário. Nunca devolve detalhe técnico. */
export const sendMagTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deliverMagNotification } = await import("@/lib/notifications/dispatch.server");
    const result = await deliverMagNotification(context.userId, {
      type: "test",
      category: "system",
      body: "Estou por aqui. Quando houver algo realmente importante, eu aviso.",
      targetRoute: "/mentor",
      dedupeKey: `test:${Date.now()}`,
      bypassLimits: true,
    });
    if (!result.ok) console.error("[push] teste falhou", result.reason);
    return { ok: result.ok };
  });

/** Ferramenta interna: dispara um tipo específico (somente admin). */
export const adminSendMagNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { type: string }) => ({ type: String(input?.type ?? "test") }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const { deliverMagNotification } = await import("@/lib/notifications/dispatch.server");
    const samples: Record<string, { body: string; route: string; category: string }> = {
      context: {
        body: "Você tem algumas horas até o próximo compromisso. Eu começaria pela prioridade principal.",
        route: "/atividade?focus=priority",
        category: "priorities",
      },
      appointment: {
        body: "Seu próximo compromisso é às 14h. Quer revisar o que precisa estar pronto?",
        route: "/atividade?focus=appointment",
        category: "appointments",
      },
      direction: {
        body: "Sua direção continua em aberto. Quer transformá-la em um passo de 10 minutos?",
        route: "/atividade?focus=direction",
        category: "direction",
      },
      firmness: {
        body: 'Vou ser sincera: "Revisar contas" já foi adiada mais de uma vez. Vamos resolver ou replanejar?',
        route: "/atividade?focus=priority",
        category: "priorities",
      },
      checkin: {
        body: "Antes de encerrar: o que realmente avançou hoje?",
        route: "/atividade?checkin=true",
        category: "checkin",
      },
      reorganize: {
        body: "Seu dia mudou. Posso reorganizar suas prioridades sem perder o que importa.",
        route: "/mentor?context=reorganize-day",
        category: "insights",
      },
      test: {
        body: "Estou por aqui. Quando houver algo realmente importante, eu aviso.",
        route: "/mentor",
        category: "system",
      },
    };
    const sample = samples[data.type] ?? samples["test"]!;
    const result = await deliverMagNotification(context.userId, {
      type: `admin_${data.type}`,
      category: sample.category as never,
      body: sample.body,
      targetRoute: sample.route,
      dedupeKey: `admin:${data.type}:${Date.now()}`,
      bypassLimits: true,
    });
    return { ok: result.ok, reason: result.ok ? null : result.reason };
  });
