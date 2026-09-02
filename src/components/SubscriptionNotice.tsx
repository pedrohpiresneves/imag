import { Link } from "@tanstack/react-router";
import { useSubscriptionState } from "@/lib/subscription-state";
import { MagAvatarMascot } from "@/components/mag/MagMascot";

const BLUE_DARK = "#335CFF";

/**
 * Aviso discreto do período gratuito.
 * Dias 1–6: silêncio. Dia 7: 3 dias restantes. Dia 9: termina amanhã.
 * Dia 10: último dia. Encerrado: convite curto para os planos.
 */
export function SubscriptionNotice() {
  const { data } = useSubscriptionState();
  if (!data) return null;

  let message: string | null = null;

  if (data.state === "trialing" && data.daysRemaining != null) {
    const d = data.daysRemaining;
    if (d === 3) message = "Faltam 3 dias do seu período gratuito.";
    else if (d === 2) message = "Seu período gratuito termina amanhã.";
    else if (d <= 1) message = "Último dia de acesso gratuito.";
  } else if (data.state === "past_due") {
    message = "Não conseguimos confirmar seu pagamento.";
  } else if (!data.hasAccess && data.state === "expired") {
    message = "Continue com a MAG todos os dias.";
  }

  if (!message) return null;

  return (
    <div className="mx-auto mt-3 max-w-3xl px-6 sm:px-10">
      <Link
        to="/planos"
        className="flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-2.5 transition active:scale-[0.99]"
        style={{
          border: "1px solid rgba(51,92,255,0.10)",
          boxShadow: "0 14px 34px -26px rgba(51,92,255,0.45), 0 1px 2px rgba(15,23,42,0.03)",
          color: "#111318",
        }}
      >
        <MagAvatarMascot state="attention" size={26} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-light">{message}</span>
        <span
          className="whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-medium text-white"
          style={{ background: BLUE_DARK }}
        >
          Ver planos
        </span>
      </Link>
    </div>
  );
}
