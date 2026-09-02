import type { ReactNode } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMagPush } from "@/hooks/use-mag-push";

/** Card compacto de notificações em Configurações. Detalhes ficam em /preferencias-notificacoes. */
export function MagNotificationsCard({
  Card,
  SectionLabel,
  IconBubble,
}: {
  Card: (p: { children: ReactNode; className?: string }) => ReactNode;
  SectionLabel: (p: { children: ReactNode }) => ReactNode;
  IconBubble: (p: { children: ReactNode }) => ReactNode;
}) {
  const { status, busy, active, enable, disable, message } = useMagPush();

  return (
    <>
      <SectionLabel>Notificações</SectionLabel>
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-3.5">
            <IconBubble>
              <Bell className="h-[18px] w-[18px]" />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium tracking-[-0.01em]" style={{ color: "#111111" }}>Notificações da MAG</p>
              <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "#737373" }}>
                Orientações importantes no momento certo, sem excesso.
              </p>
            </div>
            <PushSwitch
              checked={active}
              disabled={busy || status === "unsupported"}
              onChange={(next) => void (next ? enable() : disable())}
            />
          </div>

          {status === "needs-install" && (
            <p className="mt-3 text-[12.5px] leading-[1.5]" style={{ color: "#737373" }}>
              Para receber notificações, adicione a iMAG à Tela de Início.{" "}
              <Link to="/preferencias-notificacoes" className="font-medium text-[#335CFF]">
                Ver como adicionar
              </Link>
            </p>
          )}
          {status === "denied" && (
            <p className="mt-3 text-[12.5px] leading-[1.5]" style={{ color: "#737373" }}>
              As notificações estão bloqueadas nos Ajustes do seu dispositivo. Você pode liberá-las
              por lá quando quiser.
            </p>
          )}
          {status === "unsupported" && (
            <p className="mt-3 text-[12.5px]" style={{ color: "#A3A3A3" }}>
              Este navegador ainda não suporta notificações.
            </p>
          )}
          {message && <p className="mt-3 text-[12.5px] text-[#C0453B]">{message}</p>}
        </div>

        <Link
          to="/preferencias-notificacoes"
          className="flex items-center gap-3.5 border-t px-4 py-3.5"
          style={{ borderColor: "#F0F1F4" }}
        >
          <span className="flex-1 text-[14.5px] font-medium tracking-[-0.01em]" style={{ color: "#111111" }}>
            Preferências de notificação
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-neutral-300" />
        </Link>
      </Card>
    </>
  );
}

export function PushSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition disabled:opacity-40"
      style={{ background: checked ? "#335CFF" : "#E3E6EC" }}
    >
      <span
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? 23 : 3 }}
      />
    </button>
  );
}
