import { Link } from "@tanstack/react-router";
import { MagAvatarMascot } from "@/components/mag/MagMascot";

const INK = "#111318";
const MUTED = "#6B7280";
const BLUE = "#335CFF";

/** Card único exibido quando o período gratuito termina. Nada é apagado. */
export function TrialEndedScreen() {
  return (
    <div
      className="mt-4 rounded-[22px] px-5 py-5"
      style={{
        background: "linear-gradient(180deg, #F7F9FF 0%, #FFFFFF 62%)",
        border: "1px solid rgba(51,92,255,0.10)",
        boxShadow: "0 22px 50px -34px rgba(51,92,255,0.45), 0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <MagAvatarMascot state="empathetic" size={44} />
        <div className="min-w-0 flex-1">
          <h2
            className="text-[16.5px] font-semibold leading-[1.25]"
            style={{ color: INK, letterSpacing: "-0.02em" }}
          >
            Seu período gratuito terminou.
          </h2>
          <p className="mt-1 text-[13px] font-light leading-[1.5]" style={{ color: MUTED }}>
            Continue sua jornada escolhendo um plano.
          </p>
        </div>
      </div>

      <Link
        to="/planos"
        className="mt-4 inline-flex w-full items-center justify-center rounded-full py-2.5 text-[13.5px] font-medium text-white transition active:scale-[0.99]"
        style={{ background: BLUE, boxShadow: "0 16px 32px -20px rgba(51,92,255,0.7)" }}
      >
        Continuar com a iMAG
      </Link>

      <p className="mt-2.5 text-center text-[11.5px] font-light" style={{ color: "#9AA1AC" }}>
        Seu histórico, jornada e conversas continuam salvos.
      </p>
    </div>
  );
}
