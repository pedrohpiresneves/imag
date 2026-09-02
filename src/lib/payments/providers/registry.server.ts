// Seleciona o provedor ativo com base em env vars.
// Ordem de resolução:
//   1. PAYMENT_PROVIDER (override explícito)
//   2. infinitepay se credenciais existirem
//   3. manual (fallback dev)

import type { PaymentProvider, PaymentProviderId } from "../types";
import { manualProvider } from "./manual.server";
import { infinitepayProvider } from "./infinitepay.server";

const REGISTRY: Record<PaymentProviderId, PaymentProvider> = {
  manual: manualProvider,
  infinitepay: infinitepayProvider,
  // stripe e mercadopago: registrar adapters quando forem implementados.
  stripe: manualProvider,
  mercadopago: manualProvider,
};

export function getProvider(id?: PaymentProviderId): PaymentProvider {
  if (id) return REGISTRY[id] ?? manualProvider;
  const override = process.env.PAYMENT_PROVIDER as PaymentProviderId | undefined;
  if (override && REGISTRY[override]?.ready) return REGISTRY[override];
  if (infinitepayProvider.ready) return infinitepayProvider;
  return manualProvider;
}

export function getProviderById(id: PaymentProviderId): PaymentProvider {
  return REGISTRY[id] ?? manualProvider;
}