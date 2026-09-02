import { createFileRoute } from "@tanstack/react-router";

/** Marca uma notificação como aberta. Só grava timestamp — nenhum dado é devolvido. */
export const Route = createFileRoute("/api/public/notifications/opened")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { id?: string };
          const id = String(body?.id ?? "");
          if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("ok");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("notification_events")
            .update({ opened_at: new Date().toISOString() })
            .eq("id", id)
            .is("opened_at", null);
        } catch {
          /* telemetria: nunca falha para o cliente */
        }
        return new Response("ok");
      },
    },
  },
});
