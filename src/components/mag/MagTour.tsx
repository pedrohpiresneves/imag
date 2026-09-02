import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import { haptic } from "@/lib/haptics";
import {
  TOUR_RESTART_EVENT,
  fetchTourDone,
  localTourDone,
  markTourDone,
} from "@/lib/mag/tour";

const BLUE = "#335CFF";
const INK = "#111111";

type Step = {
  id: string;
  /** seletor do elemento destacado — ausente = mascote centralizado */
  target?: string;
  text: (name: string) => string;
  cta: string;
  /** raio do recorte iluminado */
  radius?: number;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    text: (name) =>
      `Oi${name ? `, ${name}` : ""}! Eu sou a MAG. Vou te mostrar como tudo funciona.`,
    cta: "Vamos lá",
  },
  {
    id: "hoje",
    target: '[data-tour="nav-hoje"]',
    text: () =>
      "Aqui está o que merece sua atenção hoje: sua direção, compromissos e prioridades.",
    cta: "Continuar",
    radius: 22,
  },
  {
    id: "direcao",
    target: '[data-tour="direction"]',
    text: () => "Todos os dias, eu transformo suas prioridades em um próximo passo claro.",
    cta: "Entendi",
    radius: 24,
  },
  {
    id: "mag",
    target: '[data-tour="nav-mag"]',
    text: () => "Quando quiser organizar, decidir ou conversar, é só me chamar.",
    cta: "Continuar",
    radius: 999,
  },
  {
    id: "progresso",
    target: '[data-tour="nav-progresso"]',
    text: () => "Aqui você acompanha sua execução, constância e evolução.",
    cta: "Continuar",
    radius: 22,
  },
  {
    id: "fim",
    text: () => "Pronto. Agora vamos organizar seu primeiro dia?",
    cta: "Organizar meu dia",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function readRect(selector: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Tutorial guiado da MAG sobre a interface real — sem telas separadas.
 * Aparece uma única vez, após o onboarding, e some para sempre ao concluir.
 */
export function MagTour() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 390, h: 800 });

  useEffect(() => setMounted(true), []);

  /* Só entra em cena depois do onboarding, com o dia real já na tela. */
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    (async () => {
      if (localTourDone()) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, onboarding_completed_at")
        .eq("id", u.user.id)
        .maybeSingle();
      const row = data as
        | { full_name?: string | null; onboarding_completed_at?: string | null }
        | null;
      if (!row?.onboarding_completed_at) return;
      const done = await fetchTourDone();
      if (!alive || done !== false) return;
      setFirstName((row.full_name ?? "").trim().split(" ")[0] ?? "");
      setIndex(0);
      setRunning(true);
    })();
    return () => {
      alive = false;
    };
  }, [mounted]);

  /* Reabertura manual pelo Perfil/Configurações. */
  useEffect(() => {
    function onRestart() {
      setIndex(0);
      setRunning(true);
    }
    window.addEventListener(TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, onRestart);
  }, []);

  /* O tutorial acontece sobre a tela Hoje. */
  useEffect(() => {
    if (running && !pathname.startsWith("/atividade")) {
      navigate({ to: "/atividade" });
    }
  }, [running, pathname, navigate]);

  const step = STEPS[index];

  const measure = useCallback(() => {
    if (typeof window === "undefined") return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    setRect(step?.target ? readRect(step.target) : null);
  }, [step?.target]);

  useLayoutEffect(() => {
    if (!running) return;
    measure();
    const id = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [running, measure]);

  const finish = useCallback(
    (go?: string) => {
      setRunning(false);
      void markTourDone();
      if (go) navigate({ to: go });
    },
    [navigate],
  );

  function next() {
    haptic(8);
    if (index >= STEPS.length - 1) {
      finish();
      setTimeout(() => window.dispatchEvent(new CustomEvent("imag:open-day-ai")), 240);
      return;
    }
    setIndex((i) => i + 1);
  }

  /** Card e mascote se ajustam ao espaço livre da tela. */
  const placement = useMemo(() => {
    const cardW = Math.min(viewport.w - 32, 400);
    const left = Math.round((viewport.w - cardW) / 2);
    if (!rect) {
      return { cardW, left, top: Math.round(viewport.h / 2 - 120), centered: true };
    }
    const below = rect.top + rect.height + 22;
    const fitsBelow = below + 200 < viewport.h;
    const top = fitsBelow ? below : Math.max(84, rect.top - 218);
    return { cardW, left, top, centered: false };
  }, [rect, viewport]);

  if (!mounted || !running || !step) return null;

  const spotlight = rect
    ? {
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        radius: step.radius ?? 20,
      }
    : null;

  const node = (
    <div className="fixed inset-0 z-[999] select-none" aria-live="polite">
      {/* Overlay + recorte iluminado */}
      {spotlight ? (
        <motion.div
          onClick={next}
          initial={false}
          animate={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          transition={reduce ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="absolute"
          style={{
            borderRadius: spotlight.radius,
            boxShadow:
              "0 0 0 9999px rgba(9,12,20,0.56), 0 0 0 1px rgba(255,255,255,0.85), 0 0 34px 4px rgba(51,92,255,0.28)",
          }}
        />
      ) : (
        <div className="absolute inset-0" onClick={next} style={{ background: "rgba(9,12,20,0.56)" }} />
      )}

      {/* Pular tutorial — sempre acessível, acima do overlay */}
      <button
        type="button"
        onClick={() => finish()}
        className="absolute right-4 z-10 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          background: "rgba(255,255,255,0.16)",
          color: "#FFFFFF",
          backdropFilter: "blur(8px)",
        }}
      >
        Pular tutorial
      </button>

      {/* Mascote + balão */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={{ duration: reduce ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="absolute"
          style={{ left: placement.left, top: placement.top, width: placement.cardW }}
        >
          <motion.img
            src={magHeadOfficial.url}
            alt=""
            aria-hidden
            width={128}
            height={128}
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={
              reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
            }
            className="relative z-10 mx-auto mb-[-16px] block h-[62px] w-[62px] object-contain drop-shadow-[0_10px_20px_rgba(9,12,20,0.35)]"
            style={{ marginLeft: placement.centered ? undefined : 14 }}
          />
          <div
            className="rounded-[22px] px-5 pb-4 pt-5"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 24px 60px -28px rgba(9,12,20,0.6)",
            }}
          >
            <span
              className="block text-[11px] font-semibold uppercase tracking-[0.09em]"
              style={{ color: "#9AA0AB" }}
            >
              MAG
            </span>
            <p
              className="mt-1.5 text-[15px] font-medium leading-[1.4]"
              style={{ color: INK, letterSpacing: "-0.01em" }}
            >
              {step.text(firstName)}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className="block rounded-full transition-all"
                    style={{
                      width: i === index ? 14 : 5,
                      height: 5,
                      background: i === index ? BLUE : "#DDE0E6",
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-white transition active:scale-95"
                style={{ background: BLUE }}
              >
                {step.cta}
              </button>
            </div>

            {step.id === "fim" && (
              <button
                type="button"
                onClick={() => finish()}
                className="mt-2 w-full py-1 text-[13px] font-medium"
                style={{ color: "#8A8F98" }}
              >
                Explorar sozinho
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(node, document.body);
}
