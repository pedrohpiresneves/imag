import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAccess } from "@/lib/use-access";
import { useSubscriptionState, useSubscriptionRefreshOnResume } from "@/lib/subscription-state";
import { AccessLockScreen } from "@/components/AccessLockScreen";

/** Rotas sempre liberadas, mesmo com o período gratuito encerrado. */
const ALLOWED = [
  /^\/$/,
  /^\/auth/,
  /^\/reset-password/,
  /^\/planos/,
  /^\/assinar/,
  /^\/checkout/,
  /^\/pagamento/,
  /^\/perfil/,
  /^\/configuracoes/,
  /^\/suporte/,
  /^\/idioma/,
  /^\/termos/,
  /^\/privacidade/,
  /^\/onboarding/,
  /^\/preparar/,
  /^\/r\//,
  /^\/api\//,
  /^\/lovable\//,
  /^\/sitemap/,
];

function isAllowed(pathname: string) {
  return ALLOWED.some((re) => re.test(pathname));
}

function NeutralLoading() {
  return (
    <div
      className="grid min-h-screen place-items-center"
      style={{ background: "#FFFFFF", colorScheme: "light" }}
    >
      <div
        aria-label="Carregando"
        className="h-7 w-7 animate-spin rounded-full"
        style={{ border: "2px solid #E6EAF2", borderTopColor: "#335CFF" }}
      />
    </div>
  );
}

/**
 * Bloqueio integral do app quando o período gratuito termina sem
 * assinatura ativa. O acesso é decidido pelo servidor/banco — nunca
 * por estado local.
 */
export function AccessGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isLoggedIn, email, isLoading: authLoading } = useAccess();
  const { data, isLoading, isError } = useSubscriptionState();
  useSubscriptionRefreshOnResume();

  const allowed = isAllowed(pathname);
  // Nunca toma decisão enquanto a sessão ou o acesso são desconhecidos.
  if (authLoading) return <NeutralLoading />;
  if (allowed || !isLoggedIn) return <>{children}</>;
  if (isLoading) return <NeutralLoading />;

  // Falha de rede: não bloqueia indevidamente.
  if (isError || !data) return <>{children}</>;

  if (!data.hasAccess) {
    return <AccessLockScreen initial={(email ?? "?").trim().charAt(0).toUpperCase()} />;
  }

  return <>{children}</>;
}
