import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadNotificationCount } from "@/lib/notifications-center.functions";
import { useSupportUnread } from "@/lib/support/useSupportUnread";
import { useSubscriptionState } from "@/lib/subscription-state";

/**
 * Cabeçalho global compacto.
 * Ícones brancos minimalistas, sem fundo circular, 18×18 px.
 * Ordem dos controles à direita: sino → perfil.
 */
function initialsOf(name: string) {
  const parts = (name || "").trim().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return "";
  const a = parts[0]!.charAt(0);
  const b = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (a + b).toUpperCase();
}

export function AppHeader({
  minimal = false,
  light = true,
}: {
  minimal?: boolean;
  light?: boolean;
}) {

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("");
  const unread = useSupportUnread();
  const fetchUnread = useServerFn(getUnreadNotificationCount);
  const { data: notif } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchUnread(),
    enabled: isLoggedIn,
    refetchInterval: 60_000,
  });
  const hasUnread = (notif?.unread ?? 0) > 0;
  const { data: subState } = useSubscriptionState();
  const trialDays =
    subState?.state === "trialing" && !minimal ? (subState.daysRemaining ?? null) : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (alive) setAvatarUrl(null);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const prof = p as { avatar_url?: string | null; full_name?: string | null } | null;
      if (alive) setInitials(initialsOf(prof?.full_name ?? u.user.email ?? ""));
      const raw = prof?.avatar_url;
      if (!raw) { if (alive) setAvatarUrl(null); return; }
      if (raw.startsWith("http")) { if (alive) setAvatarUrl(raw); return; }
      const { data: s } = await supabase.storage.from("avatars").createSignedUrl(raw, 60 * 60 * 24);
      if (alive) setAvatarUrl(s?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [isLoggedIn]);

  const iconColor = light ? "#335CFF" : "#FFFFFF";

  return (
    <header
      className={`${light ? "" : "app-header "}sticky top-0 z-20 border-b`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        ...(light
          ? { background: "#FFFFFF", borderBottomColor: "transparent", color: "#111111" }
          : {}),
      }}
    >
      <div className="mx-auto flex h-12 max-w-[1180px] items-center justify-end gap-4 px-5 sm:px-10">
        <div className="flex shrink-0 items-center gap-4">
          {trialDays !== null && (
            <Link
              to="/planos"
              className="mr-1 hidden items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] transition hover:opacity-90 sm:inline-flex"
              style={
                light
                  ? { border: "1px solid #335CFF", color: "#335CFF", background: "#FFFFFF" }
                  : { border: "1px solid #FFFFFF", background: "#FFFFFF", color: "#335CFF" }
              }
            >
              {trialDays > 0
                ? `${trialDays} ${trialDays === 1 ? "dia restante" : "dias restantes"} · Assinar`
                : "Teste expirado · Assinar"}
            </Link>
          )}

          {isLoggedIn ? (
            <>
              <Link
                to="/notificacoes"
                aria-label="Notificações"
                className="relative transition hover:opacity-80"
                style={{ color: iconColor }}
              >
                <Bell className="h-[19px] w-[19px]" strokeWidth={1.7} />
                {(hasUnread || unread > 0) && (
                  <span
                    className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full"
                    style={{ background: iconColor }}
                  />
                )}
              </Link>
              <Link
                to="/perfil"
                aria-label="Perfil"
                className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-80"
              >
                <span
                  className="grid h-[32px] w-[32px] place-items-center overflow-hidden rounded-full"
                  style={{ border: `1px solid ${light ? "#ECEDF0" : "rgba(255,255,255,0.25)"}` }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : initials ? (
                    <span
                      className="text-[11px] font-semibold leading-none"
                      style={{ color: light ? "#111111" : "#FFFFFF" }}
                    >
                      {initials}
                    </span>
                  ) : (
                    <User
                      className="h-4 w-4"
                      style={{ color: light ? "#8A8A90" : "rgba(255,255,255,0.7)" }}
                    />
                  )}
                </span>
              </Link>
            </>
          ) : (
            <Link
              to="/auth"
              className="text-[13px] font-medium transition hover:opacity-80"
              style={{ color: light ? "#335CFF" : "#FFFFFF" }}
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

