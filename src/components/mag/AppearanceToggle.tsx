import { Monitor, Moon, Sun } from "lucide-react";
import { useMagTheme, type MagAppearance } from "@/lib/use-mag-theme";

const BLUE = "#335CFF";

const OPTIONS: { value: MagAppearance; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/** Seletor de aparência da MAG: claro, escuro ou seguir o sistema. */
export function AppearanceToggle({ compact = false }: { compact?: boolean }) {
  const { appearance, setAppearance } = useMagTheme();

  return (
    <div
      className="flex w-full items-center gap-1 rounded-full p-1"
      style={{ background: "var(--mag-surface)", border: "1px solid var(--mag-border)" }}
      role="radiogroup"
      aria-label="Aparência"
    >
      {OPTIONS.map((o) => {
        const on = appearance === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setAppearance(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full transition ${
              compact ? "py-1.5 text-[12.5px]" : "py-2 text-[13.5px]"
            } font-medium`}
            style={{
              background: on ? BLUE : "transparent",
              color: on ? "#FFFFFF" : "var(--mag-muted)",
            }}
          >
            <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
