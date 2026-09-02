import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MagnetoReward } from "@/components/MagnetoReward";
import { useT } from "@/lib/i18n";
import { MagPresence } from "@/components/mag/MagPresence";
import { MagTour } from "@/components/mag/MagTour";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";


/** Barras ascendentes — inteligência coletiva (Impacto). */
function ImpactMark({
  className,
  strokeWidth = 1.7,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      style={style}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <path d="M5 18v-4.2" />
      <path d="M12 18V9" />
      <path d="M19 18V5.5" />
    </svg>
  );
}

const LEFT = [{ to: "/atividade", label: "Hoje", Icon: CalendarDays }] as const;

const RIGHT = [{ to: "/jornada", label: "Progresso", Icon: ImpactMark }] as const;

/** Spacer so page content is never hidden behind the floating bar. */
export function BottomNavSpacer() {
  return (
    <div
      aria-hidden
      style={{ height: "calc(124px + env(safe-area-inset-bottom))" }}
    />
  );
}

const itemClass =
  "group flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-[color:var(--text-muted)] transition-all duration-[250ms] ease-out";
const iconClass =
  "h-[22px] w-[22px] transition-transform duration-[250ms] ease-out group-data-[status=active]:-translate-y-[1px] group-data-[status=active]:scale-[1.06]";

export function BottomNav({ dark = false, spacer = true }: { dark?: boolean; spacer?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const qc = useQueryClient();
  const t = useT();
  useEffect(() => setMounted(true), []);

  /* Chegada da antena: pulso único + saldo de Magnetos atualizado. */
  const onReward = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["antenna-state"] });
    setPulse(true);
    window.setTimeout(() => setPulse(false), 480);
  }, [qc]);

  const bar = (
    <>
      <nav
        aria-label={t("nav", "main")}
        data-app-chrome
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-[4%]"
        style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }}
      >
      <div className="pointer-events-auto relative w-full max-w-[460px]">
        {/* Botão central MAG — acesso direto ao chat */}
        <Link
          to="/mentor"
          aria-label="MAG"
          data-tour="nav-mag"
          onClick={() => {
            try {
              navigator.vibrate?.(8);
            } catch {
              /* ignore */
            }
          }}
          className="absolute left-1/2 top-0 z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full transition active:scale-95"
          style={{
            width: 64,
            height: 64,
            background: dark ? "var(--mag-surface)" : "#FFFFFF",
            border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.8)",
            boxShadow: dark
              ? "0 10px 24px -12px rgba(0,0,0,0.6)"
              : "0 10px 24px -12px rgba(15,23,42,0.28), 0 2px 6px -3px rgba(15,23,42,0.10)",
          }}
        >
          <img
            src={magHeadOfficial.url}
            alt=""
            aria-hidden
            width={92}
            height={92}
            className="h-[54px] w-[54px] select-none object-contain"
          />
        </Link>


        <ul
          className="grid grid-cols-[1fr_72px_1fr] items-stretch overflow-hidden rounded-[26px]"
          style={{
            background: dark ? "rgba(10,16,32,0.72)" : "rgba(255,255,255,0.72)",
            backdropFilter: "saturate(180%) blur(24px)",
            border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.6)",
            boxShadow: dark
              ? "0 8px 30px -12px rgba(0,0,0,0.55)"
              : "0 8px 30px -12px rgba(15,23,42,0.18), 0 2px 8px -4px rgba(15,23,42,0.08)",
          }}
        >
          {LEFT.map(({ to, label, Icon }) => (
            <li key={to} className="flex" data-tour="nav-hoje">
              <Link
                to={to}
                className={itemClass}
                style={dark ? { color: "var(--mag-muted)" } : undefined}
                activeProps={{ style: { color: "var(--blue)" } }}
                activeOptions={{ exact: true }}
              >
                <Icon className={iconClass} strokeWidth={1.7} />
                <span className="tracking-[0.02em]">{label}</span>
              </Link>
            </li>
          ))}
          <li aria-hidden className="flex items-end justify-center pb-2.5">
            <span
              className="text-[10px] font-medium"
              style={{ color: dark ? "var(--blue)" : "var(--text-muted)" }}
            >
              MAG
            </span>
          </li>
          {RIGHT.map(({ to, label, Icon }) => (
            <li key={to} className="flex" data-tour="nav-progresso">
              <Link
                to={to}
                className={itemClass}
                style={dark ? { color: "var(--mag-muted)" } : undefined}
                activeProps={{ style: { color: "var(--blue)" } }}
                activeOptions={{ exact: true }}
              >
                <Icon
                  className={iconClass}
                  strokeWidth={1.7}
                  style={{
                    transform: pulse ? "scale(1.22)" : undefined,
                    color: pulse ? "var(--blue)" : undefined,
                    transition: "transform 240ms cubic-bezier(0.22,1,0.36,1), color 240ms ease",
                  }}
                />
                <span className="tracking-[0.02em]">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      </nav>
    </>
  );


  return (
    <>
      {spacer && <BottomNavSpacer />}
      {/* Portal para o body: garante position: fixed real, sem ser afetado
          por ancestrais com transform/filter em qualquer página. */}
      {mounted ? createPortal(bar, document.body) : bar}
      <MagnetoReward onArrive={onReward} />
      <MagPresence />
      <MagTour />
    </>
  );
}
