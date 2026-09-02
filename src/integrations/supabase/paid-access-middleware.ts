import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Server-side gate for paid content.
 *
 * Depends on `requireSupabaseAuth` (so `context.supabase`, `context.userId`
 * and `context.claims` are populated). Then verifies that the user has an
 * active entitlement for the product, or `profiles.has_access = true` with
 * an `access_type` other than `revoked`.
 *
 * Throws a plain `Error("Forbidden: paid access required")` when the check
 * fails. Callers should surface a friendly message to the UI (paywall) but
 * NEVER trust the client to gate premium content — this middleware is the
 * source of truth.
 */
export const requirePaidAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;

    // Fonte central: trial vigente OU assinatura anual ativa OU vitalício.
    const { data: status, error } = await supabase.rpc("get_my_access_status");
    if (error) {
      console.error("[paid-access] get_my_access_status falhou", {
        userId,
        message: error.message,
        code: error.code,
      });
      throw new Error("Não foi possível validar acesso.");
    }

    if (status && typeof status === "object" && "has_access" in status && status.has_access === true) {
      return next({ context: { paidAccess: true as const } });
    }
    console.warn("[paid-access] acesso negado", { userId, stage: "no_active_access" });
    throw new Error("trial_expired");
  });
