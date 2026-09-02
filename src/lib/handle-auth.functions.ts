import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeHandleBody, isValidHandleBody } from "./handle.functions";

// Resolve iMAG ID → account e-mail on the server and dispatch a magic-link OTP.
// Always returns { ok: true } to avoid leaking whether the handle exists.
// Rate-limited by IP (8/10min) and by identifier (5/10min).
export const signInWithImagId = createServerFn({ method: "POST" })
  .inputValidator((d: { handle: string }) => ({ handle: String(d?.handle ?? "").slice(0, 60) }))
  .handler(async ({ data }) => {
    const req = getRequest();
    const salt = process.env.REFERRAL_IP_SALT ?? "";
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-real-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ipHash = createHash("sha256").update(`${salt}:ip:${ip}`).digest("hex");

    const raw = data.handle.trim().replace(/^@/, "").replace(/^im\./i, "");
    const normalized = normalizeHandleBody(raw);
    const idHash = createHash("sha256").update(`${salt}:id:${normalized}`).digest("hex");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit window: 10 minutes.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [{ count: ipCount }, { count: idCount }] = await Promise.all([
      supabaseAdmin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("attempted_at", since),
      normalized
        ? supabaseAdmin
            .from("login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("identifier_hash", idHash)
            .gte("attempted_at", since)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);

    // Always record the attempt (even if invalid) — helps limit brute force.
    await supabaseAdmin
      .from("login_attempts")
      .insert({ ip_hash: ipHash, identifier_hash: normalized ? idHash : null });

    if ((ipCount ?? 0) >= 8 || (idCount ?? 0) >= 5) {
      return { ok: true as const };
    }

    if (!normalized || !isValidHandleBody(normalized)) {
      return { ok: true as const };
    }

    // Resolve handle → email via service role (never returned to the client).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("handle", normalized)
      .maybeSingle();

    if (!profile?.email) return { ok: true as const };

    // Dispatch OTP via the publishable-key client (public auth endpoint).
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const publicClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (anon.startsWith("sb_") && h.get("Authorization") === `Bearer ${anon}`) h.delete("Authorization");
          h.set("apikey", anon);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const origin = req?.headers.get("origin") ?? "https://imag.net.br";
    await publicClient.auth.signInWithOtp({
      email: profile.email,
      options: {
        emailRedirectTo: `${origin}/app`,
        shouldCreateUser: false,
      },
    });

    return { ok: true as const };
  });