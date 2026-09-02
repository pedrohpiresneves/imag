// Helpers server-only para atribuição de indicação.
// - Cookies HttpOnly (visitor_id opaco) + cookie legível (código)
// - Hash de IP com salt para LGPD
// - Parser de cookies

import { createHash, randomUUID } from "node:crypto";

export const COOKIE_VISITOR = "am_ref_v";
export const COOKIE_CODE = "am_ref_c";
export const DEFAULT_COOKIE_DAYS = 30;

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.REFERRAL_IP_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function extractIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export function buildSetCookie(name: string, value: string, opts: {
  maxAgeSeconds: number;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  path?: string;
}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? "/"}`,
    `Max-Age=${opts.maxAgeSeconds}`,
    `SameSite=${opts.sameSite ?? "Lax"}`,
  ];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  return parts.join("; ");
}

export { randomUUID };

/**
 * Resolve a atribuição vigente a partir do header de cookies do request.
 * Retorna null se não houver cookie, atribuição expirada, ou embaixador bloqueado.
 */
export async function resolveAttributionFromCookie(cookieHeader: string | null): Promise<{
  attributionId: string;
  code: string;
  ambassadorUserId: string;
} | null> {
  const cookies = parseCookies(cookieHeader);
  const visitorId = cookies[COOKIE_VISITOR];
  if (!visitorId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("referral_attributions")
    .select("id, code, ambassador_user_id, expires_at, consumed_order_id")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (!data) return null;
  if (data.consumed_order_id) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  const { data: amb } = await supabaseAdmin
    .from("ambassadors")
    .select("status")
    .eq("user_id", data.ambassador_user_id)
    .maybeSingle();
  if (!amb || amb.status !== "active") return null;
  return {
    attributionId: data.id,
    code: data.code,
    ambassadorUserId: data.ambassador_user_id,
  };
}