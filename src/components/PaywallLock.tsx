import { usePaid } from "@/lib/use-paid";
import { ButtonLink, Eyebrow } from "@/components/ui-imag";
import { PRICE_LABELS } from "@/lib/pricing";

type Props = {
  children: React.ReactNode;
  label?: string;
  compact?: boolean;
};

/**
 * Renders children as a visual preview but blocks all interaction
 * (pointer events + keyboard focus) with a subtle overlay + CTA
 * when the current user has not paid yet.
 */
export function PaywallLock({ children, label = "Desbloqueie para usar", compact = false }: Props) {
  const { isPaid, isLoading } = usePaid();
  if (isPaid || isLoading) return <>{children}</>;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none select-none opacity-50 blur-[2px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--paper)]/60 backdrop-blur-[3px]">
        <div
          className={`flex flex-col items-center gap-4 rounded-[20px] border border-[color:var(--hair)] bg-[color:var(--surface)] text-center shadow-[var(--shadow-card)] ${
            compact ? "px-6 py-5" : "px-10 py-8"
          }`}
        >
          <Eyebrow>Acesso restrito</Eyebrow>
          <p
            className={`font-medium tracking-[-0.015em] text-[color:var(--ink)] ${
              compact ? "text-[15px]" : "text-[17px]"
            }`}
          >
            {label}
          </p>
          <ButtonLink to="/planos" variant="primary" size="md" className="mt-1">
            Assinar iMAG a partir de {PRICE_LABELS.monthly}/mês
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}