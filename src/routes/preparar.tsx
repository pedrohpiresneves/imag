import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import { ImagLogo } from "@/components/ImagLogo";
import { MagFull } from "@/components/mag/MagMascot";

const INK = "#0A0A0A";
const MUTED = "#6B7280";
const BLUE = "#335CFF";

export const Route = createFileRoute("/preparar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vamos começar por você · iMAG" },
      {
        name: "description",
        content:
          "Algumas respostas para a MAG entender sua rotina e direcionar melhor seus próximos passos.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PrepararPage,
});

const ease = [0.22, 1, 0.36, 1] as const;

function PrepararPage() {
  const navigate = useNavigate();
  const { isLoggedIn, isLoading, userId } = useAccess();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate({ to: "/auth" });
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const done = (data as { onboarding_completed_at?: string | null } | null)
        ?.onboarding_completed_at;
      if (done) navigate({ to: "/app" });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);

  return (
    <main className="min-h-screen w-full" style={{ background: "#FFFFFF", color: INK }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col items-center px-6 pb-12 pt-10 sm:pt-14">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease }}
        >
          <ImagLogo size={26} />
        </motion.div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <MagFull state="neutral" size={172} />
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
            className="mt-10 text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[42px]"
          >
            Vamos começar por você<span style={{ color: BLUE }}>.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.66, ease }}
            className="mt-4 max-w-[34ch] text-[15px] leading-[1.6]"
            style={{ color: MUTED }}
          >
            Algumas respostas para a MAG entender sua rotina e direcionar melhor seus
            próximos passos.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.82, ease }}
            className="mt-6 text-[12.5px]"
            style={{ color: "#9CA3AF" }}
          >
            ≈ 5 min · suas respostas ficam privadas
          </motion.p>

          <motion.button
            type="button"
            onClick={() => navigate({ to: "/onboarding" })}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.98, ease }}
            className="mt-10 flex w-full max-w-[320px] items-center justify-center gap-2 rounded-[18px] px-6 py-4 text-[15.5px] font-medium transition-transform active:scale-[0.99]"
            style={{ background: BLUE, color: "#FFFFFF" }}
          >
            Começar
            <ArrowRight size={17} strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </main>
  );
}
