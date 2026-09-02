import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Settings, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadNotificationCount } from "@/lib/notifications-center.functions";

const BLUE = "#335CFF";

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Cabeçalho azul iMAG — avatar, saudação e acessos essenciais. */
export function HomeTopBar({ firstName }: { firstName: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [greeting, setGreeting] = useState(() => greetingFor());
  useEffect(() => {
    const id = setInterval(() => setGreeting(greetingFor()), 60_000);
    return () => clearInterval(id);
  }, []);
  const fetchUnread = useServerFn(getUnreadNotificationCount);
  const { data: notif } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchUnread(),
    refetchInterval: 60_000,
  });
  const hasUnread = (notif?.unread ?? 0) > 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      const raw = (p as { avatar_url?: string | null } | null)?.avatar_url;
      if (!raw) return;
      if (raw.startsWith("http")) {
        if (alive) setAvatarUrl(raw);
        return;
      }
      const { data: s } = await supabase.storage
        .from("avatars")
        .createSignedUrl(raw, 60 * 60 * 24);
      if (alive) setAvatarUrl(s?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header style={{ background: BLUE, paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pb-5 pt-[22px] sm:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/perfil"
            aria-label="Meu perfil"
            className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-[18px] w-[18px]" strokeWidth={1.7} style={{ color: "#FFFFFF" }} />
            )}
          </Link>
          <div className="min-w-0">
            <p
              className="truncate text-[17px] font-semibold"
              style={{ letterSpacing: "-0.03em", color: "#FFFFFF" }}
            >
              {greeting}
              {firstName ? (
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{`, ${firstName}`}</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/notificacoes"
            aria-label="Notificações"
            className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/[0.12]" style={{ color: "#FFFFFF" }}
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.7} />
            {hasUnread && (
              <span className="absolute right-2.5 top-2.5 h-[6px] w-[6px] rounded-full" style={{ background: "#FFFFFF" }} />
            )}
          </Link>
          <a
            href="/configuracoes"
            aria-label="Configurações"
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/[0.12]" style={{ color: "#FFFFFF" }}
          >
            <Settings className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </a>
        </div>
      </div>
    </header>
  );
}
