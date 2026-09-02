import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentVerification = {
  /** active = acesso liberado · processing = pagamento localizado em análise */
  status: "active" | "processing" | "not_found";
  hasAccess: boolean;
};

/**
 * "Já paguei" / verificação automática.
 *
 * Reconcilia com a InfinitePay no servidor e devolve o estado real de acesso.
 * Nunca libera nada por toque do usuário — só por confirmação do provedor.
 */
export const verifyMyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentVerification> => {
    const { userId, supabase } = context;
    const { reconcileUserPayments } = await import("./reconcile.server");

    let status: PaymentVerification["status"] = "not_found";
    try {
      const result = await reconcileUserPayments(userId);
      status = result.status;
    } catch (e) {
      console.error("[verifyMyPayment] reconciliação falhou", {
        userId,
        message: e instanceof Error ? e.message : "unknown",
      });
    }

    const { data } = await supabase.rpc("get_my_access_status");
    const hasAccess =
      !!data && typeof data === "object" && (data as { has_access?: boolean }).has_access === true;

    return { status: hasAccess ? "active" : status, hasAccess };
  });
