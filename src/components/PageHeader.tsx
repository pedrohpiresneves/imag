import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

const BLUE = "#335CFF";

/**
 * Cabeçalho padrão das páginas internas da iMAG.
 * Fundo branco, área segura do iOS, seta azul, título e ações à direita.
 * Mesma altura, margens e alinhamentos em todas as telas.
 */
export function PageHeader({
  title,
  right,
  divider = false,
  maxWidth = 520,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  divider?: boolean;
  maxWidth?: number;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <header
      className="sticky top-0 z-20"
      style={{
        background: "#FFFFFF",
        paddingTop: "env(safe-area-inset-top)",
        borderBottom: divider ? "1px solid #EEF0F5" : "1px solid transparent",
      }}
    >
      <div
        className="mx-auto flex h-12 items-center gap-1 px-3 sm:px-5"
        style={{ maxWidth }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (onBack ? onBack() : router.history.back())}
          className="grid h-10 w-10 place-items-center rounded-full transition active:opacity-60"
          style={{ color: BLUE }}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.9} />
        </button>
        <span
          className="min-w-0 flex-1 truncate text-[17px] font-semibold"
          style={{ letterSpacing: "-0.02em", color: "#111111" }}
        >
          {title}
        </span>
        {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
      </div>
    </header>
  );
}
