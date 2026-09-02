import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { adminSendMagNotification } from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  component: AdminNotificationsPage,
  head: () => ({
    meta: [
      { title: "Teste de notificações · iMAG" },
      { name: "description", content: "Ferramenta interna para disparar cada tipo de notificação da MAG." },
      { property: "og:title", content: "Teste de notificações · iMAG" },
      { property: "og:description", content: "Ferramenta interna de notificações da iMAG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TYPES = [
  "context",
  "appointment",
  "direction",
  "firmness",
  "checkin",
  "reorganize",
  "test",
] as const;

function AdminNotificationsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white px-4 pb-28 pt-6">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Teste de notificações</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Dispara cada tipo para os seus próprios dispositivos. Acesso restrito a administradores.
      </p>

      <div className="mt-5 grid gap-2">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(type);
              try {
                const result = await adminSendMagNotification({ data: { type } });
                setLog((prev) => [
                  `${type}: ${result.ok ? "enviada" : `não enviada (${result.reason})`}`,
                  ...prev,
                ]);
              } catch {
                setLog((prev) => [`${type}: erro`, ...prev]);
              }
              setBusy(null);
            }}
            className="rounded-2xl border px-4 py-3 text-left text-[14.5px] font-medium disabled:opacity-60"
            style={{ borderColor: "#EDEFF3" }}
          >
            {busy === type ? "Enviando…" : type}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mt-6 rounded-2xl border p-4 text-[12.5px] text-neutral-600" style={{ borderColor: "#EDEFF3" }}>
          {log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </main>
  );
}
