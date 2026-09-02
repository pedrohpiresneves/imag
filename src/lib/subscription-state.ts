import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getSubscriptionState,
  type SubscriptionState,
  type SubState,
} from "@/lib/subscription-state.functions";
import { useAccess } from "@/lib/use-access";

export type { SubscriptionState, SubState };

export const subscriptionQueryKey = (userId: string | null) =>
  ["subscription-state", userId ?? "anonymous"] as const;
export const SUBSCRIPTION_QUERY_KEY = ["subscription-state"] as const;

/**
 * Hook único de assinatura. Todos os componentes leem daqui — nunca
 * calculam o status por conta própria.
 */
export function useSubscriptionState() {
  const { userId, isLoggedIn, isLoading: authLoading } = useAccess();
  const query = useQuery({
    queryKey: subscriptionQueryKey(userId),
    queryFn: () => getSubscriptionState({ data: undefined as never }),
    enabled: isLoggedIn,
    staleTime: 30_000,
    // Nunca substitui um estado conhecido por "sem assinatura" ao falhar.
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    data: query.data ?? null,
    /** Enquanto verificando, não exiba "Sem assinatura ativa". */
    isLoading: authLoading || (isLoggedIn && !query.data && query.isPending),
    isError: query.isError && !query.data,
    refresh: query.refetch,
  };
}

/** Força a releitura do status (pós-checkout, retorno ao app, etc.). */
export function useRefreshSubscription() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
}

/** Atualiza ao voltar para o app (aba/PWA em foreground). */
export function useSubscriptionRefreshOnResume() {
  const refresh = useRefreshSubscription();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);
}

function fmt(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export type SubscriptionCopy = {
  /** Rótulo curto (menu lateral, badges). */
  short: string;
  title: string;
  subtitle: string;
  action: { label: string; kind: "portal" | "plans" | "details" } | null;
  secondaryAction: { label: string; kind: "plans" | "details" } | null;
  showPlans: boolean;
};

const FALLBACK: SubscriptionCopy = {
  short: "Verificando assinatura…",
  title: "Verificando assinatura…",
  subtitle: "Só um instante.",
  action: null,
  secondaryAction: null,
  showPlans: false,
};

/** Texto oficial exibido para cada estado — igual em todas as telas. */
export function describeSubscription(
  data: SubscriptionState | null,
  opts?: { loading?: boolean; error?: boolean },
): SubscriptionCopy {
  if (opts?.loading || !data) {
    if (opts?.error) {
      return {
        ...FALLBACK,
        short: "Assinatura indisponível",
        title: "Não foi possível atualizar sua assinatura",
        subtitle: "Tente novamente em instantes.",
      };
    }
    return FALLBACK;
  }

  const name = data.planName ?? "Plano iMAG";
  const end = fmt(data.endsAt);

  if (data.isAmbassador) {
    return {
      short: "Embaixador iMAG",
      title: "Embaixador iMAG",
      subtitle: "Acesso completo",
      action: null,
      secondaryAction: null,
      showPlans: false,
    };
  }

  switch (data.state) {
    case "active":
      return {
        short: `${name} ativo`,
        title: name,
        subtitle: end ? `Ativa · Próxima renovação em ${end}` : "Ativa",
        action: { label: "Gerenciar assinatura", kind: "portal" },
        secondaryAction: null,
        showPlans: false,
      };
    case "trialing":
      return {
        short: "Período gratuito",
        title: "Período gratuito ativo",
        subtitle: end
          ? `Seu acesso gratuito termina em ${end}.`
          : "Seu acesso gratuito está ativo.",
        action: { label: "Escolher plano", kind: "plans" },
        secondaryAction: { label: "Ver detalhes", kind: "details" },
        showPlans: false,
      };
    case "past_due":
      return {
        short: "Pagamento pendente",
        title: "Pagamento pendente",
        subtitle: "Não foi possível confirmar a renovação da sua assinatura.",
        action: { label: "Atualizar pagamento", kind: "portal" },
        secondaryAction: null,
        showPlans: false,
      };
    case "canceled":
      return {
        short: "Cancelamento agendado",
        title: "Cancelamento agendado",
        subtitle: end
          ? `Seu acesso permanece ativo até ${end}.`
          : "Seu acesso permanece ativo até o fim do período.",
        action: { label: "Reativar assinatura", kind: "portal" },
        secondaryAction: null,
        showPlans: false,
      };
    case "expired":
    case "inactive":
    default:
      return {
        short: "Sem assinatura ativa",
        title: "Sem assinatura ativa",
        subtitle:
          "Escolha um plano para continuar utilizando todos os recursos da iMAG.",
        action: { label: "Ver planos", kind: "plans" },
        secondaryAction: null,
        showPlans: true,
      };
  }
}
