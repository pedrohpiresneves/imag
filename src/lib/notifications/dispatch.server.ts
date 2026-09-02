/** Motor de entrega: preferências, horário silencioso, limite diário, dedupe e envio. Server-only. */
import { sendWebPush, webPushConfigured, type PushTarget } from "./webpush.server";

export const MAG_TITLE = "MAG";

export type MagCategory =
  | "direction"
  | "appointments"
  | "priorities"
  | "checkin"
  | "day_close"
  | "insights"
  | "system";

export type MagNotificationSpec = {
  type: string;
  category: MagCategory;
  body: string;
  targetRoute: string;
  entityId?: string | null;
  dedupeKey: string;
  /** ISO — depois disso a notificação não é mais útil. */
  expiresAt?: string | null;
  /** Só para teste manual: ignora limite diário e horário silencioso. */
  bypassLimits?: boolean;
};

export type Prefs = {
  user_id: string;
  enabled: boolean;
  direction_enabled: boolean;
  appointments_enabled: boolean;
  priorities_enabled: boolean;
  checkin_enabled: boolean;
  day_close_enabled: boolean;
  day_close_hour: number;
  insights_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
  daily_limit: number;
  lock_screen_privacy: string;
};

export const PREFS_COLUMNS =
  "user_id, enabled, direction_enabled, appointments_enabled, priorities_enabled, checkin_enabled, day_close_enabled, day_close_hour, insights_enabled, quiet_hours_start, quiet_hours_end, timezone, daily_limit, lock_screen_privacy";

export type DeliveryResult =
  | { ok: true; devices: number; eventId: string }
  | { ok: false; reason: string };

function categoryAllowed(prefs: Prefs, category: MagCategory) {
  switch (category) {
    case "direction":
      return prefs.direction_enabled;
    case "appointments":
      return prefs.appointments_enabled;
    case "priorities":
      return prefs.priorities_enabled;
    case "checkin":
      return prefs.checkin_enabled;
    case "day_close":
      return prefs.day_close_enabled !== false;
    case "insights":
      return prefs.insights_enabled;
    default:
      return true;
  }
}

/** Hora local (0-23) do usuário, respeitando o fuso salvo. */
export function localHour(timezone: string, at = new Date()) {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(at);
    return Number(hour);
  } catch {
    return at.getUTCHours();
  }
}

/** Data local YYYY-MM-DD do usuário. */
export function localDate(timezone: string, at = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function inQuietHours(prefs: Prefs, at = new Date()) {
  const hour = localHour(prefs.timezone, at);
  const start = prefs.quiet_hours_start;
  const end = prefs.quiet_hours_end;
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/**
 * Entrega uma notificação da MAG a um usuário, aplicando todas as travas.
 * Nunca lança para o chamador: devolve o motivo de não envio.
 */
export async function deliverMagNotification(
  userId: string,
  spec: MagNotificationSpec,
): Promise<DeliveryResult> {
  if (!webPushConfigured()) return { ok: false, reason: "push_not_configured" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prefsRow } = await supabaseAdmin
    .from("notification_preferences")
    .select(PREFS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  const prefs = prefsRow as Prefs | null;
  if (!prefs || !prefs.enabled) return { ok: false, reason: "notifications_off" };
  if (!categoryAllowed(prefs, spec.category)) return { ok: false, reason: "category_off" };

  const now = new Date();
  if (!spec.bypassLimits) {
    if (inQuietHours(prefs, now)) return { ok: false, reason: "quiet_hours" };

    const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("sent_at", "is", null)
      .neq("type", "test")
      .gte("sent_at", dayStart);
    if ((count ?? 0) >= (prefs.daily_limit ?? 2)) return { ok: false, reason: "daily_limit" };
  }

  const minimal = prefs.lock_screen_privacy === "minimal";
  const body = minimal ? "A MAG tem uma orientação para você." : spec.body;

  // Dedupe: chave única (user_id, deduplication_key).
  const { data: event, error: insertError } = await supabaseAdmin
    .from("notification_events")
    .insert({
      user_id: userId,
      type: spec.type,
      title: MAG_TITLE,
      body,
      target_route: spec.targetRoute,
      entity_id: spec.entityId ?? null,
      scheduled_for: now.toISOString(),
      deduplication_key: spec.dedupeKey,
      expires_at: spec.expiresAt ?? null,
    })
    .select("id")
    .maybeSingle();
  if (insertError || !event) return { ok: false, reason: "duplicate" };

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("enabled", true)
    .is("revoked_at", null)
    .not("endpoint", "is", null);

  const targets = (subs ?? []).filter((s) => s.endpoint && s.p256dh && s.auth) as PushTarget[];
  if (targets.length === 0) {
    await supabaseAdmin
      .from("notification_events")
      .update({ cancelled_at: now.toISOString(), cancellation_reason: "no_devices" })
      .eq("id", event.id);
    return { ok: false, reason: "no_devices" };
  }

  const payload = {
    title: MAG_TITLE,
    body,
    tag: spec.type,
    data: {
      type: spec.type,
      notificationId: event.id,
      userId,
      targetRoute: spec.targetRoute,
      entityId: spec.entityId ?? null,
      createdAt: now.toISOString(),
      expiresAt: spec.expiresAt ?? null,
    },
  };

  let delivered = 0;
  for (const target of targets) {
    try {
      const result = await sendWebPush(target, payload);
      if (result.ok) {
        delivered += 1;
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString() })
          .eq("id", target.id);
      } else if (result.gone) {
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ enabled: false, revoked_at: new Date().toISOString() })
          .eq("id", target.id);
      } else {
        console.error("[push] falha de envio", { status: result.status });
      }
    } catch (e) {
      console.error("[push] erro de envio", e instanceof Error ? e.message : "unknown");
    }
  }

  if (delivered === 0) {
    await supabaseAdmin
      .from("notification_events")
      .update({ cancelled_at: new Date().toISOString(), cancellation_reason: "delivery_failed" })
      .eq("id", event.id);
    return { ok: false, reason: "delivery_failed" };
  }

  await supabaseAdmin
    .from("notification_events")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", event.id);

  return { ok: true, devices: delivered, eventId: event.id };
}

/** Cancela eventos ainda não enviados (direção concluída, prioridade feita, etc.). */
export async function cancelPendingNotifications(
  userId: string,
  types: string[],
  reason: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("notification_events")
    .update({ cancelled_at: new Date().toISOString(), cancellation_reason: reason })
    .eq("user_id", userId)
    .in("type", types)
    .is("sent_at", null)
    .is("cancelled_at", null);
}
