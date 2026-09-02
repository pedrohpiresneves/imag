import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const code = params.code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
          const to = sanitizeReturnPath(url.searchParams.get("to"));
          const target = new URL(to, url.origin);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: amb } = await supabaseAdmin
            .from("ambassadors")
            .select("user_id, status")
            .eq("code", code)
            .maybeSingle();

          if (!amb || amb.status !== "active") {
            // Redireciona silenciosamente — não expõe embaixadores válidos
            return Response.redirect(target.toString(), 302);
          }

          const {
            COOKIE_VISITOR,
            COOKIE_CODE,
            buildSetCookie,
            extractIp,
            hashIp,
            parseCookies,
            randomUUID,
          } = await import("@/lib/referrals/attribution.server");
          const { getSettings } = await import("@/lib/referrals/settings.server");

          const settings = await getSettings();
          const cookies = parseCookies(request.headers.get("cookie"));
          const visitorId = cookies[COOKIE_VISITOR] ?? randomUUID();
          const expires = new Date(Date.now() + settings.cookie_days * 86_400_000);

          // registra clique (best-effort)
          try {
            await supabaseAdmin.from("referral_clicks").insert({
              code,
              ip_hash: hashIp(extractIp(request)),
              user_agent: request.headers.get("user-agent") ?? null,
              referer: request.headers.get("referer") ?? null,
              landing_path: to,
            });
          } catch (e) {
            console.warn("[/r] click log", e);
          }

          await supabaseAdmin.from("referral_attributions").upsert(
            {
              visitor_id: visitorId,
              code,
              ambassador_user_id: amb.user_id,
              expires_at: expires.toISOString(),
              consumed_order_id: null,
            },
            { onConflict: "visitor_id" },
          );

          const headers = new Headers();
          headers.append(
            "Set-Cookie",
            buildSetCookie(COOKIE_VISITOR, visitorId, {
              maxAgeSeconds: settings.cookie_days * 86_400,
              httpOnly: true,
              sameSite: "Lax",
            }),
          );
          headers.append(
            "Set-Cookie",
            buildSetCookie(COOKIE_CODE, code, {
              maxAgeSeconds: settings.cookie_days * 86_400,
              sameSite: "Lax",
            }),
          );
          headers.set("Location", target.toString());
          return new Response(null, { status: 302, headers });
        } catch (e) {
          console.error("[/r/$code]", e);
          return Response.redirect(new URL("/", request.url).toString(), 302);
        }
      },
    },
  },
});

function sanitizeReturnPath(input: string | null): string {
  if (!input) return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}