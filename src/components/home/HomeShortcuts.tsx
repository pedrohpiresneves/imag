import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Target, TrendingUp } from "lucide-react";

const BLUE = "#335CFF";
const INK = "#111111";
const HAIR = "#ECECEF";

export const OPEN_DIRECTION_EVENT = "imag:open-direction";

type Shortcut = {
  key: string;
  label: string;
  Icon: typeof Target;
  to?: string;
  action?: () => void;
};

const ITEMS: Shortcut[] = [
  {
    key: "checkin",
    label: "Check-in",
    Icon: CheckCircle2,
    action: () => window.dispatchEvent(new CustomEvent(OPEN_DIRECTION_EVENT)),
  },
  { key: "historico", label: "Histórico", Icon: Clock3, to: "/historico" },
  { key: "campo", label: "Campo", Icon: Target, to: "/campo-magnetico" },
  { key: "impacto", label: "Impacto", Icon: TrendingUp, to: "/impacto" },
];

/** Atalhos circulares — leves, azuis e com ícone protagonista. */
export function HomeShortcuts() {
  return (
    <nav aria-label="Atalhos" className="mt-6">
      <ul className="grid grid-cols-4 gap-1">
        {ITEMS.map(({ key, label, Icon, to, action }) => {
          const inner = (
            <>
              <span
                className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white transition active:scale-95"
                style={{ border: `1px solid ${HAIR}` }}
              >
                <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={2} style={{ color: BLUE }} />
              </span>
              <span className="mt-2 block w-full truncate text-center text-[11px]" style={{ color: INK }}>
                {label}
              </span>
            </>
          );
          const cls = "flex w-full flex-col items-center transition active:opacity-70";
          return (
            <li key={key} className="min-w-0">
              {to ? (
                <Link to={to} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={action} className={cls}>
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
