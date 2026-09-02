import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/release-commissions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { releaseDueCommissions } = await import(
          "@/lib/referrals/commissions.server"
        );
        const result = await releaseDueCommissions();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});