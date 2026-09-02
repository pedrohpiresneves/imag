import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { drawCampoCard, type CampoCardData } from "@/lib/share-cards/campo-card";

const BLUE = "#335CFF";

type Props = {
  data: CampoCardData;
  label?: string;
  /** Futuro: destaque quando houver conquista relevante. */
  highlight?: boolean;
};

export function ShareFieldButton({
  data,
  label = "Compartilhar Campo Magnético",
  highlight = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (busy || !canvasRef.current) return;
    setBusy(true);
    try {
      await drawCampoCard(canvasRef.current, data);
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "imag-campo-magnetico.png", { type: "image/png" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav?.canShare?.({ files: [file] }) && nav?.share) {
        await nav.share({
          files: [file],
          title: "Meu Campo Magnético na iMAG",
          text: "Menos ruído. Mais direção.",
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "imag-campo-magnetico.png";
        a.click();
      }
    } catch {
      /* cancelado ou não suportado */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleShare}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center justify-center gap-2 bg-transparent text-[16.5px] font-medium disabled:opacity-40"
        style={{
          color: BLUE,
          opacity: highlight ? 1 : 0.9,
          fontFamily: "var(--font-sans)",
        }}
        disabled={busy}
        aria-label={label}
      >
        <IosShareIcon />
        {label}
      </motion.button>
      <canvas ref={canvasRef} className="hidden" width={1080} height={1080} />
    </>
  );
}

/** Ícone nativo iOS: square.and.arrow.up */
function IosShareIcon() {
  return (
    <svg width="17" height="19" viewBox="0 0 17 19" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M8.5 1.2v10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5.1 4.4 8.5 1l3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 7.2H2.9A1.9 1.9 0 0 0 1 9.1v7.1A1.9 1.9 0 0 0 2.9 18h11.2a1.9 1.9 0 0 0 1.9-1.8V9.1a1.9 1.9 0 0 0-1.9-1.9h-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
