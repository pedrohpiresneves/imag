import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import { useDayContext, localDateNow, formatIn } from "@/components/home/use-day-context";
import { getCurrentPlan } from "@/lib/plans.functions";
import { listGoalHistory } from "@/lib/goal-history.functions";
import { useAccess } from "@/lib/use-access";
import { MAG_CONTEXTUAL_NOTICES_ENABLED } from "@/lib/feature-flags";
import { haptic } from "@/lib/haptics";
import {
  contextCooldownOk,
  finishTour,
  loadPresence,
  markSeen,
  noteDismiss,
  resetDismissals,
  seenToday,
  wasSeen,
  type PresenceMessage,
} from "@/lib/mag/presence";

const BLUE = "#335CFF";

/**
 * Rotas onde a MAG não fala: dentro do próprio chat ela já está presente,
 * e nos fluxos públicos/checkout ela seria interrupção.
 */
const MUTED_ROUTES = [
  "/mentor",
  "/onboarding",
  "/preparar",
  "/auth",
  "/checkout",
  "/planos",
  "/assinar",
  "/pagamento",
];

/**
 * Presença viva da MAG: o mascote permanente é o botão central da barra
 * inferior — aqui vive apenas o balão contextual que aparece acima dele.
 */
export function MagPresence() {
  const { isPaid, isLoggedIn } = useAccess();
  /** Flag desliga toda a presença contextual sem remover a lógica. */
  const flagOn = MAG_CONTEXTUAL_NOTICES_ENABLED;
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => setMounted(true), []);

  const muted = MUTED_ROUTES.some((r) => pathname.startsWith(r));
  const active = flagOn && mounted && isLoggedIn && isPaid && !muted;

  const { data: profile } = useQuery({
    queryKey: ["mag_presence_profile"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, profession")
        .eq("id", uid)
        .maybeSingle();
      return (data as { full_name: string | null; profession: string | null } | null) ?? null;
    },
    enabled: active,
  });

  const { data: plan } = useQuery({
    queryKey: ["current-plan"],
    queryFn: () => getCurrentPlan(),
    enabled: active,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["mag_presence_history"],
    queryFn: () => listGoalHistory({ data: { filter: "all", days: 7 } }),
    enabled: active,
  });

  const day = useDayContext(localDateNow());

  const message = useMemo<PresenceMessage | null>(() => {
    if (!active) return null;
    void tick;
    const state = loadPresence();

    const profileComplete = Boolean(profile?.full_name?.trim() && profile?.profession?.trim());
    const hasDirection = Boolean(plan?.priority_title);
    const directionDone = plan?.status === "completed";
    const organized = day.loaded && (day.totalCount > 0 || day.events.length > 0);

    /* ── Tour guiado ───────────────────────────────────────── */
    if (!state.tourDone) {
      if (!profileComplete && !wasSeen("tour_profile")) {
        return {
          id: "tour_profile",
          text: "Conte um pouco mais sobre você para eu te direcionar melhor.",
          cta: "Completar perfil",
          to: "/perfil",
          mood: "confident",
          tour: true,
        };
      }
      if (directionDone && !wasSeen("tour_progress")) {
        return {
          id: "tour_progress",
          text: "Boa. Mais um passo concluído. Quer ver como isso impactou seu progresso?",
          cta: "Ver progresso",
          to: "/jornada",
          mood: "celebrating",
          tour: true,
        };
      }
      if (wasSeen("tour_progress") && pathname.startsWith("/jornada") && !wasSeen("tour_end")) {
        return {
          id: "tour_end",
          text: "Por enquanto é isso. Eu vou ficar por aqui.",
          then: [
            "Se precisar organizar alguma coisa, decidir algo ou só conversar, é só me tocar aqui embaixo.",
          ],
          cta: "Combinado",
          mood: "confident",
          tour: true,
        };
      }
      return null;
    }

    /* ── Falas contextuais ─────────────────────────────────── */
    if (!contextCooldownOk(state)) return null;

    const recent = history.slice(0, 5);
    const missed = recent.filter((g) => g.status === "missed" || g.status === "expired").length;
    const completed = recent.filter((g) => g.status === "completed").length;

    const candidates: PresenceMessage[] = [];

    /* Perfil incompleto — melhora tudo que vem depois. */
    if (!profileComplete) {
      candidates.push({
        id: "ctx_profile",
        text: "Conte um pouco mais sobre você para eu te direcionar melhor.",
        cta: "Completar perfil",
        to: "/perfil",
        mood: "confident",
      });
    }

    /* Compromisso próximo — editável direto na Atividade. */
    if (
      pathname.startsWith("/atividade") &&
      day.nextEvent &&
      day.minutesToNextEvent !== null &&
      day.minutesToNextEvent <= 240
    ) {
      candidates.push({
        id: "ctx_event",
        text: `Próximo compromisso às ${day.nextEvent.start_time.slice(0, 5)}.`,
        cta: "Editar",
        to: "/atividade",
        event: "imag:edit-next-event",
        mood: "neutral",
      });
    }

    /* Tempo até o próximo compromisso — fala principal da Home. */
    if (day.nextEvent && day.minutesToNextEvent !== null && day.minutesToNextEvent <= 300) {
      candidates.push({
        id: "ctx_time_to_event",
        text:
          day.minutesToNextEvent <= 15
            ? "Seu compromisso começa agora."
            : `${formatIn(day.minutesToNextEvent).replace("em ", "")} até o próximo compromisso.`,
        cta: "Ver meu dia",
        to: "/atividade",
        mood: "neutral",
      });
    }

    /* Progresso das prioridades — não repete dentro da própria Atividade. */
    if (
      day.loaded &&
      !pathname.startsWith("/atividade") &&
      day.totalCount > 0 &&
      day.doneCount > 0 &&
      day.doneCount < day.totalCount
    ) {
      candidates.push({
        id: "ctx_progress",
        text: `${day.doneCount} de ${day.totalCount} prioridades concluídas hoje.`,
        cta: "Ver",
        to: "/atividade",
        mood: "confident",
      });
    }


    /* Direção concluída — leva ao progresso (não repete dentro do próprio Progresso). */
    if (directionDone && !pathname.startsWith("/jornada")) {
      candidates.push({
        id: "ctx_direction_done",
        text: "Mais um passo concluído.",
        cta: "Ver progresso",
        to: "/jornada",
        mood: "celebrating",
      });
    }

    if (missed >= 3) {
      candidates.push({
        id: "ctx_missed",
        text: "Os últimos dias ficaram difíceis. Quer me contar?",
        cta: "Conversar",
        to: "/mentor",
        mood: "empathetic",
      });
    }
    if (day.loaded && !organized) {
      candidates.push({
        id: "ctx_organize",
        text: "Quer que eu organize seu dia com você?",
        cta: "Organizar",
        to: "/atividade",
        event: "imag:open-day-ai",
        mood: "confident",
      });
    }
    if (day.loaded && day.totalCount >= 5) {
      candidates.push({
        id: "ctx_overload",
        text: "Bastante coisa hoje. Quer escolher comigo o que importa?",
        cta: "Escolher",
        to: "/mentor",
        mood: "thinking",
      });
    }
    if (completed >= 3 && !pathname.startsWith("/jornada")) {
      candidates.push({
        id: "ctx_streak",
        text: "Você está mantendo um bom ritmo.",
        cta: "Ver progresso",
        to: "/jornada",
        mood: "celebrating",
      });
    }


    return candidates.find((c) => !seenToday(c.id, state)) ?? null;
  }, [active, profile, plan, day, history, pathname, tick]);

  const visible = message && message.id !== dismissedId ? message : null;

  /** Mensagens que pedem decisão ficam até o usuário responder. */
  const needsAnswer = Boolean(visible && (visible.tour || visible.text.trim().endsWith("?")));

  /* Informativas recolhem sozinhas em 6s — pausa enquanto há interação. */
  useEffect(() => {
    if (!visible || needsAnswer || paused) return;
    const t = setTimeout(() => setDismissedId(visible.id), 6_000);
    return () => clearTimeout(t);
  }, [visible?.id, needsAnswer, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flagOn || !mounted || !active) return null;

  function close() {
    if (!visible) return;
    markSeen(visible.id, { context: !visible.tour });
    noteDismiss();
    setDismissedId(visible.id);
  }

  function act() {
    if (!visible) return;
    haptic(8);
    markSeen(visible.id, { context: !visible.tour });
    resetDismissals();
    if (visible.id === "tour_end") finishTour();
    setDismissedId(visible.id);
    setTick((n) => n + 1);
    if (visible.to) navigate({ to: visible.to });
    if (visible.event) {
      setTimeout(() => window.dispatchEvent(new CustomEvent(visible.event!)), 260);
    }
  }

  /**
   * Notificação interna no topo — estilo iOS: aparece abaixo do cabeçalho,
   * sobrepõe o conteúdo sem deslocá-lo e nunca cobre a navegação inferior.
   */
  const node = (
    <div
      data-app-chrome
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 56px)" }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            role="status"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0 }}
            onDragStart={() => setPaused(true)}
            onDragEnd={(_, info) => {
              if (info.offset.y < -40 || info.velocity.y < -350) close();
              else setPaused(false);
            }}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="pointer-events-auto w-full max-w-[440px] rounded-[18px]"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(17,17,17,0.06)",
              boxShadow: "0 12px 30px -18px rgba(17,17,17,0.35), 0 2px 6px -4px rgba(17,17,17,0.10)",
            }}
          >
            <div className="flex items-start gap-3 px-3.5 py-3">
              <img
                src={magHeadOfficial.url}
                alt=""
                aria-hidden
                width={64}
                height={64}
                className="mt-[1px] h-7 w-7 shrink-0 select-none object-contain"
              />
              <button
                type="button"
                onClick={act}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className="block text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "#9AA0AB" }}
                >
                  MAG
                </span>
                <span
                  className="mt-0.5 block line-clamp-2 text-[13.5px] font-medium leading-[1.35]"
                  style={{ color: "#111111", letterSpacing: "-0.01em" }}
                >
                  {visible.text}
                </span>
                {visible.cta && (
                  <span
                    className="mt-1.5 block text-[13px] font-semibold"
                    style={{ color: BLUE }}
                  >
                    {visible.cta}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={close}
                className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full transition active:scale-95"
                style={{ color: "#B4B9C2" }}
              >
                <X className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(node, document.body);
}


