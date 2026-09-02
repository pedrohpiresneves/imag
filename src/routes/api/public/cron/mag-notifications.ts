import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/mag-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ?? request.headers.get("x-webhook-secret");
        const accepted = [process.env["CRON_SECRET"], process.env["MAG_CRON_TOKEN"]].filter(
          (value): value is string => Boolean(value),
        );
        if (!provided || !accepted.includes(provided)) {
          return new Response("unauthorized", { status: 401 });
        }
        try {
          const { runMagNotificationSweep } = await import("@/lib/notifications/engine.server");
          const result = await runMagNotificationSweep();
          return Response.json(result);
        } catch (e) {
          console.error("[push] sweep falhou", e instanceof Error ? e.message : "unknown");
          return new Response("erro", { status: 500 });
        }
      },
    },
  },
});
