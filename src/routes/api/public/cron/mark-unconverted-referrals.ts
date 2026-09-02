import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/mark-unconverted-referrals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("mark_unconverted_referrals");
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, updated: data ?? 0 });
      },
    },
  },
});