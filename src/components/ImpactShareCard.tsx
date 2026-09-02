import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Download, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { drawImpactCard } from "@/lib/share-cards/impact-card";

const INK = "#0A0A0A";
const MUTED = "#7B7F89";
const HAIRLINE = "#ECECEF";
const BLUE = "#335CFF";

export type ImpactPayload = {
  metaText: string;
  impactText: string;
  createdAt: number;
};

const STORAGE_KEY = "imag:last-impact";

export function saveLastImpact(p: ImpactPayload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

export function readLastImpact(): ImpactPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ImpactPayload;
    if (!p?.impactText) return null;
    if (Date.now() - p.createdAt > 1000 * 60 * 60 * 48) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearLastImpact() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function timeAgo(ts: number) {
  const min = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

type Props = {
  metaText: string;
  impactText: string;
  createdAt?: number;
  heading?: string;
};

/** Card de impacto compartilhável: prova social gerada a partir de uma MAG Meta. */
export function ImpactShareCard({ metaText, impactText, createdAt, heading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [profile, setProfile] = useState<{ name: string | null; profession: string | null }>({
    name: null,
    profession: null,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ts = createdAt ?? Date.now();

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

  async function buildBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    await drawImpactCard(canvas, {
      profession,
      metaText,
      impactText,
      authorName: shortName ? `${shortName} · ${profession}` : profession,
    });
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await buildBlob();
      if (blob) {
        const file = new File([blob], "imag-impacto.png", { type: "image/png" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({
            files: [file],
            title: "Uma direção virou movimento.",
            text: "Direção que gera movimento. imag.net.br",
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "imag-impacto.png";
          a.click();
          URL.revokeObjectURL(url);
        }
        setDone(true);
      }
    } catch {}
    setBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[24px] bg-white p-6 sm:p-7"
      style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 1px 2px rgba(10,10,10,0.03)" }}
    >
      {heading ? (
        <p className="mb-5 text-[12.5px]" style={{ color: MUTED }}>
          {heading}
        </p>
      ) : null}

      <h3
        className="text-[26px] font-semibold leading-[1.15] sm:text-[30px]"
        style={{ color: INK, letterSpacing: "-0.03em" }}
      >
        Uma direção virou <span style={{ color: BLUE }}>movimento.</span>
      </h3>

      <div className="mt-6 space-y-3">
        <Block label="Profissional" value={profession} />
        <Block label="MAG Meta" value={metaText} />
        <Block label="Impacto" value={impactText} accent />
      </div>

      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14px] font-medium transition disabled:opacity-60"
        style={{ background: BLUE, color: "#FFFFFF" }}
      >
        {done ? (
          <Check className="h-4 w-4" strokeWidth={2} />
        ) : typeof navigator !== "undefined" && "share" in navigator ? (
          <Share2 className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          <Download className="h-4 w-4" strokeWidth={1.8} />
        )}
        {busy ? "Gerando…" : "Compartilhar meu impacto"}
      </button>

      <p className="mt-4 text-[12px]" style={{ color: MUTED }}>
        {shortName ? `${shortName} · ` : ""}
        {timeAgo(ts)}
        <br />
        <span style={{ opacity: 0.85 }}>{profession}</span>
      </p>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}

function Block({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[16px] px-4 py-3.5" style={{ border: `1px solid ${HAIRLINE}` }}>
      <p className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p
        className="mt-1 text-[15.5px] leading-[1.45]"
        style={{ color: accent ? BLUE : INK, fontWeight: accent ? 500 : 400 }}
      >
        {value}
      </p>
    </div>
  );
}
