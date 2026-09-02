import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Check, Download, User, Target, CheckCircle2, TrendingUp, Share } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { drawImpactPostCard } from "@/lib/share-cards/impact-card";
import { submitDirectionImpact } from "@/lib/impact.functions";
import { track } from "@/lib/analytics";

const INK = "#0A0A0A";
const MUTED = "#7B7F89";
const HAIRLINE = "#ECECEF";
const BLUE = "#335CFF";
const BLUE_SOFT = "#EEF4FF";
const BLUE_BORDER = "#DCE7FB";
const easeOut = [0.22, 1, 0.36, 1] as const;

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: 6 + ((i * 37) % 88),
        delay: (i % 7) * 0.06,
        size: i % 3 === 0 ? 7 : 5,
        color: i % 3 === 0 ? BLUE : i % 3 === 1 ? "#9FB6FF" : "#D9E2FF",
        rotate: (i % 2 ? 1 : -1) * (40 + i * 7),
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0, y: -18, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: 132, rotate: p.rotate }}
          transition={{ duration: 2.1, delay: p.delay, ease: "easeOut" }}
          className="absolute block rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.8,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

type Props = {
  goalId: string;
  metaText: string;
  impactText: string;
};

/** Card comemorativo exibido quando uma MAG Meta gera resultado. */
export function ImpactCelebration({ goalId, metaText, impactText }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const submitImpact = useServerFn(submitDirectionImpact);

  const [profile, setProfile] = useState<{ name: string | null; profession: string | null }>({
    name: null,
    profession: null,
  });
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, profession")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled || !data) return;
      setProfile({ name: data.full_name ?? null, profession: data.profession ?? null });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const profession = profile.profession?.trim() || "Profissional iMAG";
  const shortName = (() => {
    const n = profile.name?.trim();
    if (!n) return null;
    const parts = n.split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[1]![0]!.toUpperCase()}.` : parts[0]!;
  })();

  // Pré-gera a imagem para que o compartilhamento nativo abra sem atraso (iOS exige gesto).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await drawImpactPostCard(canvas, {
        profession,
        metaText,
        impactText,
        authorName: shortName ? `${shortName} · ${profession}` : profession,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!cancelled) blobRef.current = blob;
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profession, metaText, impactText, shortName]);

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imag-impacto.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function shareToInstagram() {
    if (busy) return;
    setBusy(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const canvas = canvasRef.current;
        if (canvas) {
          await drawImpactPostCard(canvas, {
            profession,
            metaText,
            impactText,
            authorName: shortName ? `${shortName} · ${profession}` : profession,
          });
          blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/png"),
          );
          blobRef.current = blob;
        }
      }
      if (!blob) return;
      const file = new File([blob], "imag-impacto.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: unknown) => boolean;
        share?: (d: unknown) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Uma direção gerou resultado.",
          text: "Direção que gera movimento. imag.net.br",
        });
      } else {
        download(blob);
      }
      setShared(true);
      try {
        track("tool_used", { tool: "impact_share_instagram" });
      } catch {
        /* ignore */
      }
    } catch {
      const blob = blobRef.current;
      if (blob) download(blob);
    }
    setBusy(false);
  }

  async function publish() {
    if (publishing || published) return;
    setPublishing(true);
    try {
      await submitImpact({
        data: {
          goal_id: goalId,
          useful: true,
          direction_title: metaText,
          outcome_text: impactText,
          published: true,
          author_name: shortName,
          profession,
        },
      });
      setPublished(true);
      try {
        track("tool_used", { tool: "impact_publish" });
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    setPublishing(false);
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.08 }}
        className="relative overflow-hidden rounded-[24px] bg-white p-6 sm:p-7"
        style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 24px rgba(10,10,10,0.05)" }}
      >
        <Confetti />
        <div className="relative">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: easeOut, delay: 0.1 }}
            className="mx-auto grid h-14 w-14 place-items-center rounded-full"
            style={{ background: BLUE }}
          >
            <TrendingUp className="h-6 w-6" style={{ color: "#FFFFFF" }} strokeWidth={2} />
          </motion.div>
          <h4
            className="mx-auto mt-4 max-w-[18ch] text-center text-[22px] font-semibold leading-[1.2] sm:text-[25px]"
            style={{ color: INK, letterSpacing: "-0.025em" }}
          >
            Uma direção gerou <span style={{ color: BLUE }}>resultado.</span> 🎉
          </h4>

          <div className="mt-6 space-y-3">
            <Block Icon={User} label="Profissional" value={profession} delay={0.18} />
            <Block Icon={Target} label="MAG Meta" value={metaText} delay={0.24} />
            <Block Icon={CheckCircle2} label="Impacto" value={impactText} accent delay={0.3} />
          </div>
        </div>
      </motion.div>

      <p
        className="mx-auto mt-6 max-w-[38ch] text-center text-[13px] font-light leading-[1.6]"
        style={{ color: MUTED }}
      >
        Compartilhe seu impacto e inspire outros profissionais a executarem também.
      </p>

      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={publish}
          disabled={publishing || published}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium transition disabled:opacity-60"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          {published ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2} /> Publicado no Impacto
            </>
          ) : publishing ? (
            "Publicando…"
          ) : (
            <>
              <Share className="h-4 w-4" strokeWidth={1.8} /> Publicar no Impacto
            </>
          )}
        </button>

        <button
          type="button"
          onClick={shareToInstagram}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium transition disabled:opacity-60"
          style={{ background: "#FFFFFF", color: BLUE, border: `1px solid ${BLUE_BORDER}` }}
        >
          {shared ? (
            <Check className="h-4 w-4" strokeWidth={2} />
          ) : typeof navigator !== "undefined" && "share" in navigator ? (
            <Instagram className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={1.8} />
          )}
          {busy ? "Gerando imagem…" : shared ? "Imagem pronta" : "Compartilhar no Instagram"}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function Block({
  Icon,
  label,
  value,
  accent,
  delay,
}: {
  Icon: typeof User;
  label: string;
  value: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut, delay }}
      className="flex items-center gap-3.5 rounded-[16px] px-4 py-3.5"
      style={{
        border: `1px solid ${accent ? BLUE_BORDER : HAIRLINE}`,
        background: accent ? BLUE_SOFT : "#FFFFFF",
      }}
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: accent ? "#FFFFFF" : BLUE_SOFT }}
      >
        <Icon className="h-4 w-4" style={{ color: BLUE }} strokeWidth={1.7} />
      </span>
      <span className="min-w-0">
        <p className="text-[11.5px]" style={{ color: MUTED }}>
          {label}
        </p>
        <p
          className="mt-0.5 text-[15px] leading-[1.4]"
          style={{ color: accent ? BLUE : INK, fontWeight: accent ? 500 : 400 }}
        >
          {value}
        </p>
      </span>
    </motion.div>
  );
}
