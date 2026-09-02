import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ReferralSettings {
  default_rate_bps: number;
  guarantee_days: number;
  cookie_days: number;
  min_payout_cents: number;
}

let cache: { at: number; value: ReferralSettings } | null = null;

export async function getSettings(): Promise<ReferralSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const { data } = await supabaseAdmin
    .from("referral_settings")
    .select("default_rate_bps, guarantee_days, cookie_days, min_payout_cents")
    .eq("id", 1)
    .maybeSingle();
  const value: ReferralSettings = {
    default_rate_bps: data?.default_rate_bps ?? 2000,
    guarantee_days: data?.guarantee_days ?? 7,
    cookie_days: data?.cookie_days ?? 30,
    min_payout_cents: data?.min_payout_cents ?? 5000,
  };
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** Retorna rate_bps efetivo — campanha ativa (global ou específica ao código) sobrepõe default. */
export async function getEffectiveRateBps(code: string | null): Promise<number> {
  const settings = await getSettings();
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("referral_campaigns")
    .select("rate_bps, code")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso);
  if (!data || data.length === 0) return settings.default_rate_bps;
  // Preferência: campanha específica ao código > global
  const specific = data.find((c) => c.code && code && c.code === code);
  if (specific) return specific.rate_bps;
  const global = data.find((c) => !c.code);
  return global ? global.rate_bps : settings.default_rate_bps;
}