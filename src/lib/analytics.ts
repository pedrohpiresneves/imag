// Analytics helper — compatível com Plausible (window.plausible).
// No-op quando o script não está carregado (ex.: dev/preview).
// Para ativar em produção, defina VITE_PLAUSIBLE_DOMAIN (ex.: "imag.net.br").

type Props = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Props; callback?: () => void },
    ) => void;
  }
}

export type AnalyticsEvent =
  | "cta_click"
  | "checkout_start"
  | "payment_confirmed"
  | "access_granted"
  | "login"
  | "tool_used"
  | "page_view"
  | "onboarding_completed"
  | "profile_updated"
  | "mag_plan_from_profile"
  | "signup_started"
  | "signup_completed"
  | "trial_started"
  | "trial_expired"
  | "subscription_started"
  | "subscription_activated"
  | "subscription_canceled"
  | "handle_created"
  | "handle_updated"
  | "onboarding_ready_shown"
  | "onboarding_first_meta_cta";

export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    if (typeof window === "undefined") return;
    const fn = window.plausible;
    if (typeof fn === "function") fn(event, props ? { props } : undefined);
    if (import.meta.env.DEV) console.debug("[analytics]", event, props);
  } catch (e) {
    console.warn("[analytics] track failed", e);
  }
}

export const PLAUSIBLE_DOMAIN: string | undefined = import.meta.env
  .VITE_PLAUSIBLE_DOMAIN as string | undefined;