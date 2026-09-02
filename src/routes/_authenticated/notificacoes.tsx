import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Bell, Send, Target, Sparkles, Activity, CreditCard, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import {
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/notifications-center.functions";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notificações · iMAG" },
      {
        name: "description",
        content: "O que aconteceu com suas direções: metas recebidas, impactos e avisos da conta.",
      },
      { property: "og:title", content: "Notificações · iMAG" },
      { property: "og:description", content: "Menos ruído. Mais direção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotificacoesPage,
});

const INK = "#111111";
const MUTED = "#7B7F89";
const HAIRLINE = "#EFEFF2";
const BLUE = "#335CFF";

function iconFor(kind: string) {
  if (kind === "shared_direction") return Send;
  if (kind === "impact_useful") return Target;
  if (kind === "shared_impact") return Sparkles;
  if (kind === "campo") return Activity;
  if (kind === "access_expiring") return Clock;
  if (kind === "account") return CreditCard;
  return Bell;
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function NotificacoesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
  });

  useEffect(() => {
    void (async () => {
      await markRead({ data: {} });
      await qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    })();
  }, [markRead, qc]);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
    >
      <div className="surface-light">
        <AppHeader />
      </div>

      <main className="mx-auto w-full max-w-[620px] px-5 pb-32 pt-8 sm:px-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Notificações</h1>
        <p className="mt-1 text-[13.5px]" style={{ color: MUTED }}>
          Só o que muda sua direção.
        </p>

        <div className="mt-7">
          {isLoading ? (
            <p className="py-10 text-center text-[13.5px]" style={{ color: MUTED }}>
              Carregando…
            </p>
          ) : data.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="mx-auto h-6 w-6" style={{ color: "#C9CCD3" }} />
              <p className="mt-3 text-[14px]" style={{ color: MUTED }}>
                Nada por aqui. Você está em dia.
              </p>
            </div>
          ) : (
            <ul>
              {data.map((n: AppNotification, i: number) => {
                const Icon = iconFor(n.kind);
                return (
                  <motion.li
                    key={n.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    style={{ borderColor: HAIRLINE }}
                    className="border-b last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (n.link) navigate({ to: n.link as never });
                      }}
                      className="flex w-full items-start gap-3.5 py-4 text-left transition active:opacity-70"
                    >
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
                        style={{ background: "#F5F6F8", color: n.read ? MUTED : BLUE }}
                      >
                        <Icon className="h-[15px] w-[15px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="truncate text-[14.5px] tracking-[-0.01em]"
                            style={{ fontWeight: n.read ? 500 : 600 }}
                          >
                            {n.title}
                          </span>
                          {n.count > 1 && (
                            <span className="shrink-0 text-[12px]" style={{ color: MUTED }}>
                              ·{n.count}
                            </span>
                          )}
                        </span>
                        {n.body && (
                          <span
                            className="mt-0.5 block line-clamp-2 text-[13px] leading-[1.5]"
                            style={{ color: MUTED }}
                          >
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11.5px]" style={{ color: "#A0A4AD" }}>
                          {timeAgo(n.createdAt)}
                        </span>
                        {n.kind === "access_expiring" && (
                          <span
                            className="mt-1.5 block text-[12.5px] font-medium"
                            style={{ color: BLUE }}
                          >
                            Ver planos →
                          </span>
                        )}
                      </span>
                      {!n.read && (
                        <span
                          aria-label="Não lida"
                          className="mt-2 h-[7px] w-[7px] shrink-0 rounded-full"
                          style={{ background: BLUE }}
                        />
                      )}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
