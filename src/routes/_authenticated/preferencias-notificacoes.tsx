import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useMagPush } from "@/hooks/use-mag-push";
import { sendMagTestPush } from "@/lib/push.functions";
import { PushSwitch } from "@/components/MagNotificationsCard";

export const Route = createFileRoute("/_authenticated/preferencias-notificacoes")({
  component: NotificationPreferencesPage,
  head: () => ({
    meta: [
      { title: "Preferências de notificação · iMAG" },
      {
        name: "description",
        content:
          "Escolha quais orientações da MAG você quer receber, o horário silencioso e a privacidade na Tela Bloqueada.",
      },
      { property: "og:title", content: "Preferências de notificação · iMAG" },
      {
        property: "og:description",
        content: "Controle as notificações inteligentes da MAG na iMAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function NotificationPreferencesPage() {
  const { prefs, patch, status, active, busy, enable, disable } = useMagPush();
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const categories: {
    key: "direction" | "appointments" | "priorities" | "checkin" | "dayClose" | "insights";
    label: string;
  }[] = [
    { key: "direction", label: "Direção do Dia" },
    { key: "appointments", label: "Próximos compromissos" },
    { key: "priorities", label: "Prioridades" },
    { key: "checkin", label: "Check-in" },
    { key: "dayClose", label: "Encerramento do dia" },
    { key: "insights", label: "Insights da MAG" },
  ];

  return (
    <main className="force-light-surface mx-auto min-h-screen w-full max-w-[560px] bg-white px-4 pb-28 pt-4"
      style={{ background: "#FFFFFF", color: "#111111" }}>
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/configuracoes"
          aria-label="Voltar"
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: "#EDEFF3" }}
        >
          <ArrowLeft className="h-[18px] w-[18px]" style={{ color: "#111111" }} />
        </Link>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: "#111111" }}>
          Preferências de notificação
        </h1>
      </div>

      <Card>
        <Row
          title="Notificações da MAG"
          subtitle="Orientações importantes no momento certo, sem excesso."
        >
          <PushSwitch
            checked={active}
            disabled={busy || status === "unsupported"}
            onChange={(next) => void (next ? enable() : disable())}
          />
        </Row>
      </Card>

      {status === "needs-install" && (
        <div
          className="mt-3 rounded-2xl border p-4 text-[13px] leading-[1.6] txt-secondary"
          style={{ borderColor: "#E9EBEF", background: "#FAFBFF" }}
        >
          <p className="font-medium" style={{ color: "#111111" }}>Como adicionar à Tela de Início</p>
          <p className="mt-1">
            No Safari do iPhone, toque no botão de compartilhar, escolha “Adicionar à Tela de
            Início” e abra a iMAG pelo ícone. Depois volte aqui e ative as notificações.
          </p>
        </div>
      )}

      {active && (
        <>
          <SectionLabel>Categorias</SectionLabel>
          <Card>
            {categories.map((category, index) => (
              <div key={category.key} style={index > 0 ? { borderTop: "1px solid #F0F1F4" } : undefined}>
                <Row title={category.label}>
                  <PushSwitch
                    checked={Boolean(prefs?.[category.key])}
                    onChange={(next) => void patch({ [category.key]: next })}
                  />
                </Row>
              </div>
            ))}
          </Card>

          <SectionLabel>Encerramento do dia</SectionLabel>
          <Card>
            <div className="flex items-center gap-3 p-4">
              <span className="flex-1 text-[14.5px]" style={{ color: "#111111" }}>
                Horário
              </span>
              <HourSelect
                value={prefs?.dayCloseHour ?? 20}
                onChange={(v) => void patch({ dayCloseHour: v })}
              />
            </div>
            <p className="txt-secondary px-4 pb-4 text-[12.5px]">
              Se houver compromisso depois desse horário, aviso 30 minutos após o último — nunca
              depois das 21h30. Só chega quando há algo real para organizar.
            </p>
          </Card>

          <SectionLabel>Horário silencioso</SectionLabel>
          <Card>
            <div className="flex items-center gap-3 p-4">
              <span className="flex-1 text-[14.5px]" style={{ color: "#111111" }}>De</span>
              <HourSelect
                value={prefs?.quietStart ?? 22}
                onChange={(v) => void patch({ quietStart: v })}
              />
              <span className="text-[14.5px]" style={{ color: "#111111" }}>até</span>
              <HourSelect
                value={prefs?.quietEnd ?? 8}
                onChange={(v) => void patch({ quietEnd: v })}
              />
            </div>
            <p className="txt-secondary px-4 pb-4 text-[12.5px]">
              Nada é enviado nesse intervalo. No máximo duas notificações inteligentes por dia.
            </p>
          </Card>

          <SectionLabel>Privacidade na Tela Bloqueada</SectionLabel>
          <Card>
            <PrivacyOption
              label="Mostrar conteúdo completo"
              active={(prefs?.lockScreenPrivacy ?? "context") === "context"}
              onSelect={() => void patch({ lockScreenPrivacy: "context" })}
            />
            <div style={{ borderTop: "1px solid #F0F1F4" }}>
              <PrivacyOption
                label="Ocultar conteúdo sensível"
                active={prefs?.lockScreenPrivacy === "minimal"}
                onSelect={() => void patch({ lockScreenPrivacy: "minimal" })}
              />
            </div>
          </Card>

          <div className="mt-6">
            <button
              type="button"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setTestMsg(null);
                try {
                  const result = await sendMagTestPush({});
                  setTestMsg(
                    result.ok
                      ? "Notificação enviada."
                      : "Não foi possível enviar a notificação. Tente novamente.",
                  );
                } catch {
                  setTestMsg("Não foi possível enviar a notificação. Tente novamente.");
                }
                setTesting(false);
              }}
              className="w-full rounded-full border px-4 py-3 text-[14px] font-medium disabled:opacity-60"
              style={{ borderColor: "#E9EBEF", color: "#111111", background: "#FFFFFF" }}
            >
              {testing ? "Enviando…" : "Enviar notificação de teste"}
            </button>
            {testMsg && <p className="txt-secondary mt-2 text-center text-[12.5px]">{testMsg}</p>}
          </div>
        </>
      )}
    </main>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border bg-white" style={{ borderColor: "#EDEFF3" }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="txt-section mb-2 mt-6 px-1 text-[12px] font-medium uppercase tracking-[0.08em]">
      {children}
    </p>
  );
}

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium tracking-[-0.01em]" style={{ color: "#111111" }}>{title}</p>
        {subtitle && <p className="txt-secondary mt-0.5 text-[12.5px] leading-snug">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl border px-3 py-2 text-[14px]"
      style={{ borderColor: "#E9EBEF", color: "#111111", background: "#FFFFFF", WebkitTextFillColor: "currentColor", opacity: 1 }}
      aria-label="Hora"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, "0")}h
        </option>
      ))}
    </select>
  );
}

function PrivacyOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 p-4 text-left">
      <span className="flex-1 text-[14.5px] tracking-[-0.01em]" style={{ color: "#111111" }}>{label}</span>
      <span
        className="h-[18px] w-[18px] shrink-0 rounded-full border"
        style={{
          borderColor: active ? "#335CFF" : "#D8DBE2",
          background: active ? "#335CFF" : "transparent",
          boxShadow: active ? "inset 0 0 0 3px #fff" : undefined,
        }}
      />
    </button>
  );
}
