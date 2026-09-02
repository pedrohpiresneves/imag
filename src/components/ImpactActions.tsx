import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Share, Share2, User, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  drawImpactCardFormat,
  IMPACT_FORMATS,
  type ImpactCardFormat,
} from "@/lib/share-cards/impact-card";
import { submitDirectionImpact } from "@/lib/impact.functions";
import { track } from "@/lib/analytics";

const MUTED = "#8A8D96";
const INK = "#0A0A0A";
const HAIRLINE = "#EDEDF0";
const BLUE = "#335CFF";
const BLUE_BORDER = "#DCE7FB";

type Props = {
  goalId: string;
  metaText: string;
  impactText: string;
  alreadyPublished?: boolean;
  onPublished?: () => void;
};

/** Ações de compartilhamento do impacto (Publicar no Impacto + Instagram 4:5). */
export function ImpactActions({
  goalId,
  metaText,
  impactText,
  alreadyPublished = false,
  onPublished,
}: Props) {
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
  const [published, setPublished] = useState(alreadyPublished);
  const [format, setFormat] = useState<ImpactCardFormat>("feed");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPublished(alreadyPublished);
  }, [alreadyPublished]);

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

  // Pré-gera a imagem para o compartilhamento nativo abrir sem atraso (iOS exige gesto).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await drawImpactCardFormat(
        canvas,
        {
          profession,
          metaText,
          impactText,
          authorName: shortName ? `${shortName} · ${profession}` : profession,
        },
        format,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!cancelled) blobRef.current = blob;
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profession, metaText, impactText, shortName, format]);

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

  async function shareNative() {
    if (busy) return;
    setBusy(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const canvas = canvasRef.current;
        if (canvas) {
          await drawImpactCardFormat(
            canvas,
            {
              profession,
              metaText,
              impactText,
              authorName: shortName ? `${shortName} · ${profession}` : profession,
            },
            format,
          );
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
        track("tool_used", { tool: "impact_share_native" });
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
      onPublished?.();
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
      <p className="mt-4 text-center text-[13px] font-light leading-[1.6]" style={{ color: MUTED }}>
        Seu resultado pode mostrar a outro profissional que essa direção funciona.
      </p>

      <div className="mt-4 space-y-3">
        {published ? (
          <p
            className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-light"
            style={{ color: MUTED }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} /> Publicado no Impacto
          </p>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium transition hover:opacity-80 disabled:opacity-70"
            style={{ background: "#FFFFFF", color: BLUE, border: `1px solid ${BLUE_BORDER}` }}
          >
            {publishing ? (
              "Publicando…"
            ) : (
              <>
                <Share className="h-3.5 w-3.5" strokeWidth={1.7} /> Publicar no Impacto
              </>
            )}
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: "rgba(10,10,10,0.35)", backdropFilter: "blur(6px)" }}
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-8 pt-5 sm:rounded-[28px]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-medium" style={{ color: INK }}>
                        Compartilhar impacto
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="grid h-8 w-8 place-items-center rounded-full"
                        style={{ border: `1px solid ${HAIRLINE}`, color: MUTED }}
                        aria-label="Fechar"
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </div>

                    <div className="mt-4">
                      <SharePreview
                        metaText={metaText}
                        impactText={impactText}
                        author={shortName ? `${shortName} · ${profession}` : profession}
                      />
                    </div>

                    <div className="mt-5 flex justify-center gap-2">
                      {(Object.keys(IMPACT_FORMATS) as ImpactCardFormat[]).map((f) => {
                        const on = f === format;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setFormat(f);
                              setShared(false);
                            }}
                            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition"
                            style={{
                              color: on ? "#FFFFFF" : MUTED,
                              background: on ? BLUE : "#FFFFFF",
                              border: `1px solid ${on ? BLUE : HAIRLINE}`,
                            }}
                          >
                            {IMPACT_FORMATS[f].label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 space-y-2.5">
                      <button
                        type="button"
                        onClick={shareNative}
                        disabled={busy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14.5px] font-medium transition disabled:opacity-60"
                        style={{ background: BLUE, color: "#FFFFFF" }}
                      >
                        {shared ? (
                          <Check className="h-4 w-4" strokeWidth={2} />
                        ) : typeof navigator !== "undefined" && "share" in navigator ? (
                          <Share2 className="h-4 w-4" strokeWidth={1.8} />
                        ) : (
                          <Download className="h-4 w-4" strokeWidth={1.8} />
                        )}
                        {busy ? "Preparando…" : shared ? "Pronto" : "Compartilhar"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Primeira letra maiúscula, restante em minúsculas. */
function sentenceCase(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Prévia animada do card (mesma linguagem visual do arquivo gerado). */
function SharePreview({
  metaText,
  impactText,
  author,
}: {
  metaText: string;
  impactText: string;
  author: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[24px] bg-white px-6 py-9 text-center"
      style={{ border: `1px solid ${HAIRLINE}` }}
    >
      <p className="text-[11px] font-semibold tracking-[0.34em]" style={{ color: INK }}>
        iMAG
      </p>

      <div className="relative mx-auto mt-7 grid h-14 w-14 place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${BLUE}` }}
            initial={{ scale: 1, opacity: 0.22 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 3.4, delay: i * 1.1, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        <span
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{ border: `1px solid ${BLUE_BORDER}` }}
        >
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check className="h-6 w-6" strokeWidth={1.8} style={{ color: BLUE }} />
          </motion.span>
        </span>
      </div>

      <h3
        className="mx-auto mt-7 max-w-[15ch] text-[27px] font-semibold leading-[1.15]"
        style={{ color: INK, letterSpacing: "-0.03em" }}
      >
        Uma direção gerou <span style={{ color: BLUE }}>resultado.</span>
      </h3>

      <div className="mt-8" style={{ borderTop: `1px solid ${HAIRLINE}` }} />
      <p className="mt-5 text-[10px] font-semibold tracking-[0.22em]" style={{ color: MUTED }}>
        MAG META
      </p>
      <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: INK }}>
        {sentenceCase(metaText)}
      </p>

      <div className="mt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }} />
      <p className="mt-5 text-[10px] font-semibold tracking-[0.22em]" style={{ color: MUTED }}>
        IMPACTO
      </p>
      <p className="mt-2 text-[19px] font-medium leading-[1.4]" style={{ color: BLUE }}>
        {impactText}
      </p>

      <div className="mt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }} />
      <p
        className="mt-5 inline-flex items-center gap-1.5 text-[12.5px]"
        style={{ color: MUTED }}
      >
        <User className="h-3.5 w-3.5" strokeWidth={1.6} />
        {author}
      </p>

      <p className="mt-8 text-[14px] font-medium leading-[1.4]" style={{ color: INK }}>
        Menos ruído.
        <br />
        <span style={{ color: BLUE }}>Mais movimento.</span>
      </p>
    </motion.div>
  );
}
