import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarRange, History, Settings, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImagLockup } from "@/components/ImagLogo";
import { describeSubscription, useSubscriptionState } from "@/lib/subscription-state";
import { countActiveReceived } from "@/lib/shared-directions.functions";
import { useT } from "@/lib/i18n";

const INK = "#0A0A0A";
const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";
const easeOut = [0.22, 1, 0.36, 1] as const;

type Profile = { full_name: string | null; handle: string | null; avatar_url: string | null };

function usePlanLabel() {
  const { data, isLoading, isError } = useSubscriptionState();
  return describeSubscription(data, { loading: isLoading, error: isError }).short;
}

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const t = useT();
  const planLabel = usePlanLabel();
  const countFn = useServerFn(countActiveReceived);

  const { data: received = 0 } = useQuery({
    queryKey: ["received-count"],
    queryFn: () => countFn(),
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, handle, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!alive || !p) return;
      setProfile(p as Profile);
      const raw = (p as Profile).avatar_url;
      if (!raw) return;
      if (raw.startsWith("http")) {
        setAvatar(raw);
        return;
      }
      const { data: s } = await supabase.storage.from("avatars").createSignedUrl(raw, 3600);
      if (alive) setAvatar(s?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  const name = profile?.full_name ?? profile?.handle ?? t("common", "myAccount");
  const initial = name.trim().charAt(0).toUpperCase();

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90]">
          <motion.button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 h-full w-full"
            style={{ background: "rgba(10,10,10,0.32)", backdropFilter: "blur(2px)" }}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.34, ease: easeOut }}
            className="absolute inset-y-0 left-0 flex w-[75%] max-w-[360px] flex-col rounded-r-[26px] px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-[calc(env(safe-area-inset-top)+20px)]"
            style={{ background: "#FFFFFF", boxShadow: "0 18px 60px rgba(10,10,10,0.14)" }}
          >
            <div className="flex items-start justify-between">
              <ImagLockup size={18} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar menu"
                className="-mr-1 -mt-1 rounded-full p-1.5 transition hover:bg-black/[0.04]"
              >
                <X className="h-4 w-4" strokeWidth={1.6} style={{ color: MUTED }} />
              </button>
            </div>

            <Link
              to="/perfil"
              onClick={onClose}
              className="mt-7 flex items-center gap-3"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="h-10 w-10 rounded-full object-cover"
                  style={{ border: `1px solid ${HAIRLINE}` }}
                />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-medium"
                  style={{ background: "#F4F4F1", color: INK }}
                >
                  {initial}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium" style={{ color: INK }}>
                  {name}
                </span>
                <span className="block truncate text-[12.5px]" style={{ color: MUTED }}>
                  {planLabel}
                </span>
              </span>
            </Link>

            <nav className="mt-8 flex flex-col">
              <SidebarItem
                to="/historico"
                onClose={onClose}
                icon={<History className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                label={t("sidebar", "history")}
                badge={received > 0 ? received : undefined}
              />
              <SidebarItem
                to="/resumo-semanal"
                onClose={onClose}
                icon={<CalendarRange className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                label={t("sidebar", "weeklyRecap")}
              />
            </nav>

            <div className="mt-auto pt-8">
              <div className="h-px w-full" style={{ background: HAIRLINE }} />
              <SidebarItem
                to="/configuracoes"
                onClose={onClose}
                icon={<Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                label={t("sidebar", "settings")}
              />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SidebarItem({
  to,
  label,
  icon,
  badge,
  onClose,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClose: () => void;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      onClick={onClose}
      className="flex items-center gap-3 rounded-[14px] px-2 py-3.5 transition hover:bg-black/[0.03]"
      style={{ color: INK }}
    >
      <span style={{ color: MUTED }}>{icon}</span>
      <span className="text-[15px]">{label}</span>
      {badge !== undefined && (
        <span
          className="ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-medium text-white"
          style={{ background: BLUE }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
