import { Link } from "@tanstack/react-router";
import { CalendarDays, Users, Wallet } from "lucide-react";
import { haptic } from "@/lib/haptics";

const BLUE = "#335CFF";
const CIRCLE = "#F4F4F6";
const HAIR = "#ECEDF0";
const INK = "#3A3A40";

type Item = {
  key: string;
  label: string;
  Icon: typeof CalendarDays;
  to?: string;
  action?: () => void;
};

const ITEMS: Item[] = [
  { key: "agenda", label: "Agenda", Icon: CalendarDays, to: "/planejamento" },
  { key: "dinheiro", label: "Dinheiro", Icon: Wallet, to: "/dinheiro" },
  { key: "circulos", label: "Círculos", Icon: Users, to: "/circulos" },
];


/**
 * Atalhos circulares secundários — cinza muito claro, ícone linear azul.
 * A Direção do Dia segue como protagonista logo acima.
 */
export function QuickShortcuts({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Atalhos"
      className={`-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <ul className="flex min-w-full items-start justify-center gap-9">
        {ITEMS.map(({ key, label, Icon, to, action }) => {
          const inner = (
            <>
              <span
                className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full transition active:scale-95"
                style={{ background: CIRCLE, border: `1px solid ${HAIR}` }}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} style={{ color: BLUE }} />
              </span>
              <span
                className="text-center text-[13px] font-medium leading-tight"
                style={{ color: INK }}
              >
                {label}
              </span>
            </>
          );
          const cls =
            "flex w-[70px] flex-col items-center gap-1.5 transition active:opacity-70";
          return (
            <li key={key}>
              {to ? (
                <Link to={to} onClick={() => haptic(6)} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    haptic(6);
                    action?.();
                  }}
                  className={cls}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
