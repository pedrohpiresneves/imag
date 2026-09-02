/**
 * Preços oficiais da iMAG.
 *
 * A fase de lançamento usa o "Preço de Fundador". Para encerrar essa fase
 * basta trocar FOUNDER_PRICING_ACTIVE para false: o layout permanece igual e
 * os planos voltam automaticamente aos valores oficiais.
 *
 * Assinantes ativos permanecem no preço contratado (a Stripe mantém o price
 * original da assinatura); apenas novas assinaturas usam os valores abaixo.
 */
export const FOUNDER_PRICING_ACTIVE = true;

export type PlanKey = "annual" | "monthly";

/** Formata centavos em BRL (R$ 197 / R$ 24,90). Fonte única de exibição. */
export const PLAN_CHECKOUT_URLS: Record<PlanKey, string> = {
  annual: "https://invoice.infinitepay.io/plans/drabrunathais/HAYeQ4T4Jg",
  monthly: "https://invoice.infinitepay.io/plans/drabrunathais/fKGAfcClcV",
};
export function formatBRL(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value)
    ? `R$ ${value.toLocaleString("pt-BR")}`
    : `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PlanPricing = {
  key: PlanKey;
  priceId: string;
  name: string;
  price: string;
  /** Valor em centavos — fonte única para cobrança e validações. */
  amountCents: number;
  cadence: string;
  /** Texto secundário abaixo do preço */
  note: string | null;
  renewalLabel: string;
  cta: string;
  benefits: string[];
  featured: boolean;
  /** Selo discreto exibido no card (apenas na fase de fundador) */
  badge?: string;
  /** Selo de economia (ex.: "Economize R$ 101,80") */
  savingsBadge?: string;
};

/** Valores oficiais em centavos — ÚNICA fonte de verdade de preço. */
const FOUNDER_CENTS: Record<PlanKey, number> = { annual: 19700, monthly: 2490 };
const OFFICIAL_CENTS: Record<PlanKey, number> = { annual: 39900, monthly: 4990 };

/** Economia do anual frente a 12x o mensal. */
export function annualSavings(annualCents: number, monthlyCents: number): string {
  return formatBRL(monthlyCents * 12 - annualCents);
}

/** Equivalente mensal de um plano anual (ex.: R$ 24,75). */
export function monthlyEquivalent(annualCents: number): string {
  return formatBRL(Math.round(annualCents / 12));
}

const ANNUAL_BENEFITS = [
  "Acesso completo",
  "Renovação anual",
  "Valor de fundador garantido",
];

const ANNUAL_BENEFITS_OFFICIAL = [
  "Todos os recursos da iMAG",
  "10 dias gratuitos",
  "Economia em relação ao mensal",
];

const MONTHLY_BENEFITS = [
  "Acesso completo",
  "Cancele quando quiser",
  "Valor de fundador garantido",
];

const FOUNDER_PLANS: Record<PlanKey, PlanPricing> = {
  annual: {
    key: "annual",
    priceId: "imag_fundador_anual",
    name: "Anual",
    price: formatBRL(FOUNDER_CENTS.annual),
    amountCents: FOUNDER_CENTS.annual,
    cadence: "/ano",
    note: `Equivale a ${monthlyEquivalent(FOUNDER_CENTS.annual)}/mês`,
    renewalLabel: `Renovação automática anual (${formatBRL(FOUNDER_CENTS.annual)})`,
    cta: "Escolher anual",
    benefits: ANNUAL_BENEFITS,
    featured: true,
    badge: "Mais vantajoso",
    savingsBadge: `Economize ${annualSavings(FOUNDER_CENTS.annual, FOUNDER_CENTS.monthly)}`,
  },
  monthly: {
    key: "monthly",
    priceId: "imag_mensal_fundador",
    name: "Mensal",
    price: formatBRL(FOUNDER_CENTS.monthly),
    amountCents: FOUNDER_CENTS.monthly,
    cadence: "/mês",
    note: null,
    renewalLabel: `Renovação automática mensal (${formatBRL(FOUNDER_CENTS.monthly)})`,
    cta: "Escolher mensal",
    benefits: MONTHLY_BENEFITS,
    featured: false,
  },
};


const OFFICIAL_PLANS: Record<PlanKey, PlanPricing> = {
  annual: {
    key: "annual",
    priceId: "imag_anual_v2",
    name: "Anual",
    price: formatBRL(OFFICIAL_CENTS.annual),
    amountCents: OFFICIAL_CENTS.annual,
    cadence: "/ano",
    note: `Equivale a ${monthlyEquivalent(OFFICIAL_CENTS.annual)} por mês.`,
    renewalLabel: `Renovação automática anual (${formatBRL(OFFICIAL_CENTS.annual)})`,
    cta: "Começar gratuitamente",
    benefits: ANNUAL_BENEFITS_OFFICIAL,
    featured: true,
  },
  monthly: {
    key: "monthly",
    priceId: "imag_mensal_v2",
    name: "Mensal",
    price: formatBRL(OFFICIAL_CENTS.monthly),
    amountCents: OFFICIAL_CENTS.monthly,
    cadence: "/mês",
    note: null,
    renewalLabel: `Renovação automática mensal (${formatBRL(OFFICIAL_CENTS.monthly)})`,
    cta: `Começar por ${formatBRL(OFFICIAL_CENTS.monthly)}`,
    benefits: MONTHLY_BENEFITS,
    featured: false,
  },
};

export const PLAN_PRICING: Record<PlanKey, PlanPricing> = FOUNDER_PRICING_ACTIVE
  ? FOUNDER_PLANS
  : OFFICIAL_PLANS;

/** Anual sempre primeiro (mobile e desktop). */
export const PLANS_ORDERED: PlanPricing[] = [
  PLAN_PRICING.annual,
  PLAN_PRICING.monthly,
];

/** Preços oficiais em centavos — usados por checkout, webhooks e comissões. */
export const PRICE_CENTS: Record<PlanKey, number> = {
  annual: PLAN_PRICING.annual.amountCents,
  monthly: PLAN_PRICING.monthly.amountCents,
};

/** Rótulos oficiais prontos para exibição. */
export const PRICE_LABELS = {
  annual: PLAN_PRICING.annual.price,
  monthly: PLAN_PRICING.monthly.price,
  annualMonthlyEquivalent: monthlyEquivalent(PLAN_PRICING.annual.amountCents),
};

export function planByPriceId(priceId: string): PlanPricing | null {
  return (
    [FOUNDER_PLANS.annual, FOUNDER_PLANS.monthly, OFFICIAL_PLANS.annual, OFFICIAL_PLANS.monthly].find(
      (p) => p.priceId === priceId,
    ) ?? null
  );
}

export const PRICING_INTRO = {
  title: "Garanta o valor de fundador.",
  body: "Seu valor permanece enquanto a assinatura estiver ativa.",
  footnote: "Renovação automática. Cancele quando quiser.",
};

export const PRICING_INTRO_OFFICIAL = {
  title: "Escolha o seu plano.",
  body: "Acesso completo à iMAG, com 10 dias gratuitos para começar.",
  footnote: "",
};

export const PRICING_COPY = FOUNDER_PRICING_ACTIVE
  ? PRICING_INTRO
  : PRICING_INTRO_OFFICIAL;
