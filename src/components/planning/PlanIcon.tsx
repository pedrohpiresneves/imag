/**
 * Ícone semântico dos itens de Planejamento.
 * Outline minimalista (lucide, mesma biblioteca do app), sempre em azul iMAG.
 */
import {
  ShoppingBag,
  Pill,
  User,
  Users,
  CalendarHeart,
  Briefcase,
  BookOpen,
  Dumbbell,
  Utensils,
  Plane,
  CreditCard,
  Bell,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  PLAN_ICON_KEYS,
  PLAN_ICON_LABEL,
  resolvePlanIcon,
  type PlanIconKey,
} from "@/lib/mag/plan-icons";

const BLUE = "#335CFF";

export const PLAN_ICON_COMPONENT: Record<PlanIconKey, LucideIcon> = {
  shopping: ShoppingBag,
  pharmacy: Pill,
  person: User,
  meeting: Users,
  appointment: CalendarHeart,
  work: Briefcase,
  study: BookOpen,
  gym: Dumbbell,
  food: Utensils,
  travel: Plane,
  payment: CreditCard,
  reminder: Bell,
  task: CheckCircle2,
};

export function PlanIcon({
  icon,
  title,
  info,
  size = 17,
}: {
  icon?: string | null;
  title: string;
  info?: string | null;
  size?: number;
}) {
  const key = resolvePlanIcon(icon, title, info);
  const Cmp = PLAN_ICON_COMPONENT[key];
  return <Cmp size={size} color={BLUE} strokeWidth={1.75} aria-hidden />;
}

/** Seletor manual: "Automático" + as categorias disponíveis. */
export function PlanIconPicker({
  value,
  title,
  info,
  onChange,
}: {
  value: string | null;
  title: string;
  info?: string | null;
  onChange: (v: string | null) => void;
}) {
  const autoKey = resolvePlanIcon(null, title, info);
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A90A2]">Ícone</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px]"
          style={{
            background: value === null ? "#EEF2FF" : "#F6F7FB",
            border: `1px solid ${value === null ? BLUE : "transparent"}`,
            color: "#4B5163",
          }}
        >
          <PlanIcon icon={null} title={title} info={info} size={15} />
          Automático
        </button>
        {PLAN_ICON_KEYS.map((k) => {
          const Cmp = PLAN_ICON_COMPONENT[k];
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              aria-label={PLAN_ICON_LABEL[k]}
              title={PLAN_ICON_LABEL[k]}
              onClick={() => onChange(k)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: active ? "#EEF2FF" : "#F6F7FB",
                border: `1px solid ${active ? BLUE : "transparent"}`,
              }}
            >
              <Cmp
                size={16}
                color={active || k === autoKey ? BLUE : "#8A90A2"}
                strokeWidth={1.75}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
