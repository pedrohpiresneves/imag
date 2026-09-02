import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  read: boolean;
  createdAt: string;
  synthetic?: boolean;
};

/** Lista as notificações do usuário (persistidas + avisos derivados de conta/campo). */
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppNotification[]> => {
    // Alerta de expiração (persistido, único por usuário) — antes de listar.
    try {
      const { data: access } = await context.supabase.rpc("get_my_access_status");
      const state = (access ?? {}) as {
        reason?: string;
        days_remaining?: number | null;
      };
      const renewing = state.reason === "subscription";
      const days = state.days_remaining ?? null;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (renewing) {
        // Assinou: o alerta some automaticamente.
        await supabaseAdmin
          .from("notifications")
          .delete()
          .eq("user_id", context.userId)
          .eq("kind", "access_expiring");
      } else if (days !== null && days <= 3 && days >= 0) {
        const label = days <= 1 ? (days === 0 ? "hoje" : "em 1 dia") : `em ${days} dias`;
        await supabaseAdmin.from("notifications").upsert(
          {
            user_id: context.userId,
            kind: "access_expiring",
            title: `Seu acesso termina ${label}.`,
            body: "Continue com a iMAG para não interromper suas direções.",
            link: "/planos",
            group_key: "access_expiring",
          },
          { onConflict: "user_id,group_key", ignoreDuplicates: true },
        );
      }
    } catch (e) {
      console.error("[notifications] alerta de expiração falhou", e);
    }

    const { data } = await context.supabase
      .from("notifications")
      .select("id, kind, title, body, link, count, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const items: AppNotification[] = (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      count: n.count ?? 1,
      read: Boolean(n.read_at),
      createdAt: n.created_at,
    }));

    // Marco no Campo Magnético (a cada 10 direções concluídas)
    const { count: completed } = await context.supabase
      .from("user_plans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "completed");
    if (completed && completed >= 10 && completed % 10 === 0) {
      items.unshift({
        id: `campo-${completed}`,
        kind: "campo",
        title: `${completed} direções concluídas`,
        body: "Seu Campo Magnético cresceu. Veja o que mudou.",
        link: "/campo-magnetico",
        count: 1,
        read: false,
        createdAt: new Date().toISOString(),
        synthetic: true,
      });
    }

    return items;
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { unread: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string } | undefined) => ({ id: input?.id ?? null }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (data.id) q = q.eq("id", data.id);
    await q;
    return { ok: true };
  });
