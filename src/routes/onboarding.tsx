import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import { track } from "@/lib/analytics";
import { getMagneticProfile } from "@/lib/magnetic-profile.functions";
import { saveOnboardingAnswers } from "@/lib/onboarding-answers.functions";
import { getMyHandle, setMyHandle, isValidHandleBody } from "@/lib/handle.functions";
import { ImagHandleField } from "@/components/ImagHandleField";
import { ImagLogo } from "@/components/ImagLogo";
import { MagFull } from "@/components/mag/MagMascot";
import {
  ONBOARDING_QUESTIONS,
  buildInsights,
  type OnboardingAnswers,
} from "@/lib/onboarding/questions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seu momento · iMAG" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OnboardingPage,
});

const BLUE = "#335CFF";
const BG = "#FCFBF8";

function OnboardingPage() {
  const navigate = useNavigate();
  const { userId, email, isLoggedIn, isLoading } = useAccess();
  const [bootReady, setBootReady] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate({ to: "/auth" });
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [profile, mine] = await Promise.all([getMagneticProfile(), getMyHandle()]);
        if (cancelled) return;
        setHandle(mine?.handle ?? null);
        if (profile?.onboarding_state === "completed") setAlreadyDone(true);
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();
          if (!cancelled) setFullName((prof?.full_name as string | null) ?? "");
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.error("[onboarding] boot", e);
      } finally {
        if (!cancelled) setBootReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (alreadyDone) navigate({ to: "/app", replace: true });
  }, [alreadyDone, navigate]);

  if (isLoading || !bootReady) {
    return (
      <div
        className="grid min-h-screen place-items-center"
        style={{ background: BG, color: "#8A8A90" }}
      >
        <span className="text-[11px] uppercase tracking-[0.28em]">Preparando…</span>
      </div>
    );
  }

  if (!handle) {
    return <HandleGate seed={fullName || email || ""} onDone={setHandle} />;
  }

  return <OnboardingFlow />;
}

/* ------------------------------------------------------------------ */
/* Fluxo guiado                                                        */
/* ------------------------------------------------------------------ */

function OnboardingFlow() {
  const navigate = useNavigate();
  const total = ONBOARDING_QUESTIONS.length;
  // 0..total-1 = perguntas · total = análise
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const current = step >= 0 && step < total ? ONBOARDING_QUESTIONS[step] : null;
  const selected = current ? (answers[current.id] ?? []) : [];
  const insights = useMemo(() => buildInsights(answers), [answers]);

  function choose(option: string) {
    if (!current) return;
    if (current.multi) {
      const has = selected.includes(option);
      const max = current.max ?? 99;
      if (!has && selected.length >= max) return;
      setAnswers((a) => ({
        ...a,
        [current.id]: has ? selected.filter((s) => s !== option) : [...selected, option],
      }));
    } else {
      setAnswers((a) => ({ ...a, [current.id]: [option] }));
      window.setTimeout(() => setStep((s) => s + 1), 220);
    }
  }

  async function persist(next: OnboardingAnswers) {
    if (savedRef.current) return;
    savedRef.current = true;
    const mindset: Record<string, string[]> = {};
    const objectives: Record<string, string[]> = {};
    for (const q of ONBOARDING_QUESTIONS) {
      const v = next[q.id] ?? [];
      if (!v.length) continue;
      (q.dimension === "mindset" ? mindset : objectives)[q.key] = v;
    }
    await saveOnboardingAnswers({ data: { mindset, objectives } }).catch((e) =>
      console.error("[onboarding] salvar respostas falhou", e),
    );
  }

  function advance() {
    if (step === total - 1) {
      track("onboarding_completed");
      void persist(answers);
    }
    setStep((s) => s + 1);
  }

  const progress = step < 0 ? 0 : Math.min(step / total, 1);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: BG, color: "#0A0A0A", fontFamily: "var(--font-sans)" }}
    >
      <header className="px-5 pt-5">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-3">
          {step > 0 && step < total ? (
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => setStep((s) => s - 1)}
              className="grid h-8 w-8 place-items-center rounded-full transition active:scale-95"
              style={{ background: "#FFFFFF", border: "1px solid #ECEBE5" }}
            >
              <ArrowLeft className="h-4 w-4" style={{ color: "#6B6B70" }} />
            </button>
          ) : (
            <div className="h-8 w-8" />
          )}
          <div className="flex flex-1 justify-center">
            <ImagLogo size={20} color="#0A0A0A" />
          </div>
          <div className="h-8 w-8" />
        </div>
        {step >= 0 && step < total && (
          <div
            className="mx-auto mt-4 h-[3px] w-full max-w-[560px] overflow-hidden rounded-full"
            style={{ background: "#EDECE6" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: BLUE }}
              animate={{ width: `${Math.max(progress, 0.06) * 100}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 26 }}
            />
          </div>
        )}
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-28 pt-8 sm:items-center sm:pb-16">
        <div className="w-full max-w-[560px]">
          <AnimatePresence mode="wait">
            {current && (
              <Screen key={current.id}>
                <p
                  className="text-[10px] uppercase tracking-[0.3em] text-[#9A9AA1]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {step + 1} de {total}
                </p>
                <h2
                  className="mt-3 text-[23px] leading-[1.25] font-medium tracking-[-0.02em] sm:text-[26px]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {current.question}
                </h2>
                {current.hint && (
                  <p className="mt-2 text-[13px] text-[#8A8A90]">{current.hint}</p>
                )}

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {current.options.map((opt, i) => {
                    const active = selected.includes(opt);
                    return (
                      <motion.button
                        key={opt}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i, duration: 0.25 }}
                        onClick={() => choose(opt)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] transition active:scale-[0.98]"
                        style={{
                          background: active ? BLUE : "#FFFFFF",
                          color: active ? "#FFFFFF" : "#26262B",
                          border: `1px solid ${active ? BLUE : "#ECEBE5"}`,
                          boxShadow: active
                            ? "0 10px 24px -14px rgba(51,92,255,0.6)"
                            : "0 1px 2px rgba(16,24,40,0.03)",
                        }}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>

                {current.multi && (
                  <PrimaryButton disabled={selected.length === 0} onClick={advance}>
                    Continuar
                  </PrimaryButton>
                )}
                {!current.multi && step === total - 1 && selected.length > 0 && (
                  <PrimaryButton onClick={advance}>Continuar</PrimaryButton>
                )}
              </Screen>
            )}

            {step >= total && (
              <Screen key="insights">
                <div className="flex flex-col items-center text-center">
                  <MagFull state="success" size={116} />
                  <h2
                    className="mt-5 text-[25px] leading-[1.2] font-medium tracking-[-0.02em] sm:text-[28px]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Entendi seu momento.
                  </h2>
                </div>

                <div className="mt-7 flex flex-col gap-2.5">
                  {insights.map((it, i) => (
                    <motion.div
                      key={it.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 * i, duration: 0.35 }}
                      className="rounded-[18px] bg-white px-5 py-4"
                      style={{
                        border: "1px solid #ECEBE5",
                        boxShadow: "0 1px 2px rgba(16,24,40,0.03)",
                      }}
                    >
                      <p className="text-[11.5px] uppercase tracking-[0.12em] text-[#9A9AA1]">
                        {it.label}
                      </p>
                      <p className="mt-1 text-[15.5px] font-medium tracking-[-0.01em]">
                        {it.value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <p className="mt-6 text-center text-[14px] leading-[1.6] text-[#5C5C63]">
                  Vou usar isso para organizar seus dias e escolher direções mais
                  coerentes com a sua rotina.
                </p>

                <div className="flex justify-center">
                  <PrimaryButton
                    onClick={async () => {
                      setSaving(true);
                      await persist(answers);
                      track("onboarding_first_meta_cta");
                      navigate({ to: "/onboarding/pronto", replace: true });
                    }}
                    disabled={saving}
                  >
                    {saving ? "Preparando…" : "Organizar meu primeiro dia"}
                  </PrimaryButton>
                </div>
              </Screen>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 inline-flex h-12 w-full max-w-[320px] items-center justify-center rounded-full px-6 text-[15px] font-medium text-white transition active:scale-[0.99] disabled:opacity-40"
      style={{ background: BLUE, boxShadow: "0 14px 32px -16px rgba(51,92,255,0.65)" }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* iMAG ID                                                             */
/* ------------------------------------------------------------------ */

function HandleGate({ seed, onDone }: { seed: string; onDone: (h: string) => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "error"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidHandleBody(value) || status !== "available") return;
    setSaving(true);
    setError(null);
    try {
      const res = await setMyHandle({ data: { handle: value } });
      if (res.ok) {
        track("handle_created", { handle: res.handle });
        onDone(res.handle);
      } else if (res.reason === "taken") {
        setError("Essa identidade acabou de ser reservada. Tente outra.");
      } else if (res.reason === "cooldown") {
        setError("Você alterou sua identidade recentemente. Tente novamente mais tarde.");
      } else {
        setError("Não foi possível salvar agora. Tente novamente.");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[iMAG handle] falha ao salvar", err);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ background: BG, color: "#111318", fontFamily: "var(--font-sans)" }}
    >
      <form
        onSubmit={handleContinue}
        className="w-full max-w-[440px] rounded-[22px] border bg-white p-6 sm:p-8"
        style={{ borderColor: "#ECEBE5", boxShadow: "0 1px 3px rgba(16,24,40,0.04)" }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BLUE }}>
          Antes de começar
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-neutral-900 sm:text-[26px]">
          Escolha sua identidade iMAG
        </h1>
        <p className="mt-2 text-[13.5px] text-neutral-500">
          Ela vai representar você no Círculo iMAG, indicações e no seu perfil público.
        </p>

        <div className="mt-6">
          <ImagHandleField
            value={value}
            onChange={setValue}
            onStatusChange={setStatus}
            autoFocus
            suggestFrom={seed}
          />
        </div>

        {error && (
          <p className="mt-3 text-[12.5px]" style={{ color: "#C0453B" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status !== "available" || saving || !isValidHandleBody(value)}
          className="mt-6 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-[14px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Salvando…" : "Continuar"}
        </button>
      </form>
    </div>
  );
}
